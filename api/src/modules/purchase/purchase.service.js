/**
 * Service: Business logic layer for purchases
 * Orchestrates use cases and coordinates between repository and business rules.
 * Optional customersRepository and productsRepository enable name resolution for import-from-spreadsheet.
 */
export class PurchaseService {
  constructor(repository, options = {}) {
    this.repository = repository
    this.customersRepository = options.customersRepository || null
    this.productsRepository = options.productsRepository || null
  }

  /**
   * Lookup products for dropdown/search
   */
  async getProducts(params = {}) {
    const { search, limit } = params
    const products = await this.repository.findProducts({ search, limit })
    return products.map(p => ({
      id: p.id,
      product_code: p.product_code,
      name: p.name,
      unit: null,
      category: p.category || null
    }))
  }

  /**
   * Lookup suppliers for dropdown/search
   */
  async getSuppliers(params = {}) {
    const { search, limit } = params
    const suppliers = await this.repository.findSuppliers({ search, limit })
    return suppliers
  }

  /**
   * Get withhold percentage from system settings
   */
  async getWithholdPercentage() {
    const value = await this.repository.getWithholdPercentageSetting()
    return {
      setting_name: 'withhold_percentage',
      withhold_percentage: value
    }
  }

  /**
   * Create purchase order with items, optional initial payment, and receipt snapshot.
   * Handles financial calculations according to payment mode rules.
   */
  async createOrder(payload, user) {
    const userId = user?.id || null

    const {
      supplier_id,
      order_date,
      invoice_no,
      items,
      payment_mode,
      withhold_percentage,
      first_payment,
      cheque_details,
      notes,
      status,
      hold_order_id
    } = payload

    if (!items || !Array.isArray(items) || items.length === 0) {
      const error = new Error('At least one item is required')
      error.status = 400
      throw error
    }

    // 1) Compute subtotal
    const enrichedItems = items.map(it => {
      const total_price = it.quantity * it.unit_price
      return { ...it, total_price }
    })

    const subtotal = enrichedItems.reduce((sum, it) => sum + it.total_price, 0)

    // 2) Resolve withhold percentage
    let appliedWithholdPercentage = withhold_percentage
    if (appliedWithholdPercentage == null) {
      const setting = await this.repository.getWithholdPercentageSetting()
      appliedWithholdPercentage = setting != null ? setting : null
    }

    const withholdAmount =
      appliedWithholdPercentage != null
        ? (subtotal * appliedWithholdPercentage) / 100
        : 0

    const netAmount = subtotal - withholdAmount

    // 3) Determine initial payment based on payment_mode
    let initialPayment = null
    let amountPaid = 0

    if (payment_mode === 'cash') {
      amountPaid = netAmount
      initialPayment = {
        amount: netAmount,
        payment_date: order_date,
        payment_method: 'cash',
        note: notes || null
      }
    } else if (payment_mode === 'credit') {
      const first = first_payment || 0
      amountPaid = first
      if (first > 0) {
        initialPayment = {
          amount: first,
          payment_date: order_date,
          payment_method: 'credit',
          note: notes || 'First payment for credit purchase'
        }
      }
    } else if (payment_mode === 'cheque') {
      if (!cheque_details) {
        const error = new Error('cheque_details is required for cheque payment')
        error.status = 400
        throw error
      }
      const amount = cheque_details.amount
      amountPaid = amount
      initialPayment = {
        amount,
        payment_date: order_date,
        payment_method: 'cheque',
        note: notes || null,
        cheque_no: cheque_details.cheque_number,
        bank_name: cheque_details.bank_name,
        branch_name: null,
        cheque_date: cheque_details.cheque_date
      }
    }

    const remaining = netAmount - amountPaid

    let payment_status = 'unpaid'
    if (remaining <= 0.009 && amountPaid > 0) {
      payment_status = 'paid'
    } else if (amountPaid > 0 && remaining > 0.009) {
      payment_status = 'partial'
    }

    // 4) Generate receipt number
    const receipt_no = await this.repository.generateNextReceiptNumber()

    // 5) Build order payload for repository
    const orderData = {
      supplier_id,
      order_date,
      invoice_no: invoice_no ?? null,
      remark: notes || null,
      payment_mode,
      payment_status,
      total_amount: subtotal,
      amount_paid: amountPaid,
      withhold_percentage: appliedWithholdPercentage,
      withhold_amount: withholdAmount,
      withhold_settled: false,
      receipt_no,
      status: status || 'completed',
      encoder_fullname: user?.full_name || null,
      hold_order_id: hold_order_id || null
    }

    // 6) Prepare receipt snapshot structure
    const snapshotOrderMeta = {
      supplier_id,
      order_date,
      payment_mode,
      payment_status,
      subtotal,
      withhold_percentage: appliedWithholdPercentage,
      withhold_amount: withholdAmount,
      net_amount: netAmount,
      notes: notes || null
    }

    const snapshotItems = enrichedItems.map(it => ({
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total_price: it.total_price,
      batch_number: it.batch_number || null,
      expiry_date: it.expiry_date || null
    }))

    const snapshotPayment = {
      initial_payment_mode: payment_mode,
      initial_payment_amount: amountPaid,
      remaining_balance: remaining
    }

    const snapshotData = {
      order: snapshotOrderMeta,
      items: snapshotItems,
      payments: initialPayment ? [snapshotPayment] : [],
      supplier: null // can be populated lazily when reading
    }

    const receiptSnapshot = {
      snapshot_data: snapshotData,
      order_meta: snapshotOrderMeta,
      order_items: snapshotItems,
      order_payment: snapshotPayment
    }

    const result = await this.repository.createOrderWithItemsAndReceipt(
      {
        order: orderData,
        items: enrichedItems,
        initialPayment,
        receiptSnapshot
      },
      userId
    )

    // Shape response per design
    const order = result.order
    return {
      id: order.id,
      receipt_number: order.receipt_no,
      supplier_id: order.supplier_id,
      order_date: order.order_date,
      subtotal,
      withhold_amount: withholdAmount,
      net_amount: netAmount,
      payment_mode,
      status: order.status,
      created_at: order.created_at
    }
  }

  /**
   * List orders with filters + stats
   */
  async listOrders(params = {}) {
    return this.repository.listOrders(params)
  }

  /** Export purchase orders to CSV. Grouped by order: order meta only on first row of each order (like import purchase preview). */
  async exportPurchaseOrder() {
    const result = await this.repository.exportPurchaseOrder()
    const rows = result.export || []

    const headers = [
      '#', 'Order ID', 'Receipt No', 'Order Date', 'Invoice No', 'Total Amount',
      'Withhold Percentage', 'Withhold Amount', 'Amount Paid', 'Payment Mode',
      'Payment Status', 'Encoder Fullname', 'Supplier Name', 'Supplier Address',
      'Supplier Phone', 'Supplier Contact', 'Supplier TIN', 'Product Code',
      'Product Name', 'Quantity', 'Unit Price', 'Total Price', 'Batch Number',
      'Expiry Date'
    ]

    const escapeCSV = (field) => {
      if (field === null || field === undefined) return ''
      const str = String(field)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return ''
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return ''
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = date.getFullYear()
        return `${day}/${month}/${year}`
      } catch (error) {
        return ''
      }
    }

    const byOrderId = new Map()
    for (const row of rows) {
      const id = row.order_id != null ? row.order_id : row.receipt_no
      if (!byOrderId.has(id)) byOrderId.set(id, [])
      byOrderId.get(id).push(row)
    }

    let serial = 0
    const csvRows = []
    for (const [, orderRows] of byOrderId) {
      orderRows.forEach((row, itemIndex) => {
        serial += 1
        const isFirstRowOfOrder = itemIndex === 0
        const orderMeta = isFirstRowOfOrder
          ? [
              escapeCSV(row.order_id || ''),
              escapeCSV(row.receipt_no || ''),
              escapeCSV(formatDate(row.order_date)),
              escapeCSV(row.invoice_no || ''),
              escapeCSV(row.total_amount ?? ''),
              escapeCSV(row.withhold_percentage ?? ''),
              escapeCSV(row.withhold_amount ?? ''),
              escapeCSV(row.amount_paid ?? ''),
              escapeCSV(row.payment_mode || ''),
              escapeCSV(row.payment_status || ''),
              escapeCSV(row.encoder_fullname || ''),
              escapeCSV(row.supplier_name || ''),
              escapeCSV(row.supplier_address || ''),
              escapeCSV(row.supplier_phone || ''),
              escapeCSV(row.supplier_contact || ''),
              escapeCSV(row.supplier_tin || '')
            ]
          : ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
        const lineItem = [
          escapeCSV(row.product_code || ''),
          escapeCSV(row.product_name || ''),
          escapeCSV(row.quantity ?? ''),
          escapeCSV(row.unit_price ?? ''),
          escapeCSV(row.total_price ?? ''),
          escapeCSV(row.batch_number || ''),
          escapeCSV(formatDate(row.expiry_date))
        ]
        csvRows.push([escapeCSV(serial), ...orderMeta, ...lineItem].join(','))
      })
    }

    return [headers.join(','), ...csvRows].join('\n')
  }

  /**
   * Get full order details
   */
  async getOrderDetails(id) {
    const full = await this.repository.getOrderById(id)
    if (!full) {
      const error = new Error('Order not found')
      error.status = 404
      throw error
    }

    return full
  }

  /**
   * Get receipt for an order (by order ID)
   */
  async getOrderReceipt(id) {
    const receipt = await this.repository.getReceiptByOrderId(id)
    if (!receipt) {
      const error = new Error('Receipt not found')
      error.status = 404
      throw error
    }
    return receipt
  }

  /**
   * Record payment for an order
   */
  async payOrder(id, body, user) {
    const userId = user?.id || null

    const paymentData = {
      amount: body.payment_amount,
      payment_date: body.payment_date,
      payment_method: body.payment_mode,
      note: body.notes || null,
      cheque_no: body.cheque_details?.cheque_number || null,
      bank_name: body.cheque_details?.bank_name || null,
      cheque_date: body.cheque_details?.cheque_date || null
    }

    const { payment, remaining_balance } = await this.repository.recordPayment(id, paymentData, userId)

    return {
      id: payment.id,
      purchase_order_id: payment.purchase_order_id,
      payment_amount: payment.amount,
      remaining_balance
    }
  }

  /**
   * Reverse purchase order
   */
  async reverseOrder(id, body, user) {
    const userId = user?.id || null

    return await this.repository.reverseOrder(id, {
      reason: body.reason,
      reverse_inventory: body.reverse_inventory !== false,
      reverse_ledger: body.reverse_ledger !== false,
      userId
    })
  }

  /**
   * Bulk import purchases
   */
  async bulkImport(body, user) {
    const userId = user?.id || null

    return await this.repository.bulkImportPurchases(body, userId)
  }

  /**
   * Resolve supplier name to ID: find existing (supplier/both) or create new supplier.
   */
  async resolveSupplierId(supplierName) {
    if (!this.customersRepository) {
      const err = new Error('Supplier resolution not available: customersRepository not configured')
      err.status = 500
      throw err
    }
    const name = String(supplierName || '').trim()
    if (!name) {
      const err = new Error('Supplier name is required')
      err.status = 400
      throw err
    }
    let supplier = await this.customersRepository.findSupplierByName(name)
    if (supplier) return supplier.id
    const created = await this.customersRepository.create({ name, customer_type: 'supplier' })
    return created.id
  }

  /**
   * Resolve product name to ID: find existing or create new product (default category/unit).
   */
  async resolveProductId(productName, categoryName = null, unitName = null) {
    if (!this.productsRepository) {
      const err = new Error('Product resolution not available: productsRepository not configured')
      err.status = 500
      throw err
    }
    const name = String(productName || '').trim()
    if (!name) {
      const err = new Error('Product name is required')
      err.status = 400
      throw err
    }
    let product = await this.productsRepository.findByName(name)
    if (product) return product.id
    let category = null
    let unit = null
    if (categoryName && String(categoryName).trim()) {
      category = await this.productsRepository.findCategoryByName(String(categoryName).trim())
    }
    if (!category) category = await this.productsRepository.getDefaultCategory()
    if (unitName && String(unitName).trim()) {
      unit = await this.productsRepository.findUnitByName(String(unitName).trim())
    }
    if (!unit) unit = await this.productsRepository.getDefaultUnit()
    if (!category || !unit) {
      const err = new Error('Cannot create product: no default category or unit in database. Please add at least one category and one unit.')
      err.status = 400
      throw err
    }
    const nextNum = await this.productsRepository.getMaxProductCodeNumber()
    const productCode = `PRD${String(nextNum + 1).padStart(4, '0')}`
    const result = await this.productsRepository.create({
      product_code: productCode,
      name,
      description: null,
      category_id: category.id,
      unit_id: unit.id,
      remark: null
    })
    const created = Array.isArray(result) ? result[0] : result
    return created.id
  }

  /**
   * Import orders from spreadsheet payload (supplier/product names). Resolves names to IDs (find or create) then creates each order.
   */
  async importFromSpreadsheet(body, user) {
    const { orders } = body
    if (!this.customersRepository || !this.productsRepository) {
      const err = new Error('Import from spreadsheet requires customers and products repositories')
      err.status = 500
      throw err
    }
    const successful = []
    const failed = []
    for (let i = 0; i < orders.length; i++) {
      const orderInput = orders[i]
      try {
        const supplier_id = await this.resolveSupplierId(orderInput.supplier_name)
        const items = []
        for (const it of orderInput.items) {
          const product_id = await this.resolveProductId(it.product_name, it.category || null, it.unit || null)
          items.push({
            product_id,
            quantity: it.quantity,
            unit_price: it.unit_price,
            batch_number: it.batch_number || null,
            expiry_date: it.expiry_date || null
          })
        }
        const payload = {
          supplier_id,
          order_date: orderInput.order_date,
          invoice_no: orderInput.invoice_number || null,
          items,
          payment_mode: orderInput.payment_mode,
          withhold_percentage: orderInput.withhold_percentage ?? null,
          first_payment: orderInput.payment_mode === 'credit' ? (orderInput.amount_paid ?? 0) : null,
          notes: 'Bulk import from spreadsheet'
        }
        const order = await this.createOrder(payload, user)
        successful.push({ index: i, order, purchase_order_id: order.id, receipt_number: order.receipt_number })
      } catch (err) {
        failed.push({
          index: i,
          order: orderInput,
          error: err.message || 'Unknown error'
        })
      }
    }
    return {
      successful,
      failed,
      summary: {
        total: orders.length,
        successful: successful.length,
        failed: failed.length
      }
    }
  }

  /**
   * Payment history
   */
  async getPaymentHistory(id) {
    return this.repository.getPaymentHistory(id)
  }

  /**
   * Hold orders
   */
  async listHoldOrders(params = {}) {
    return this.repository.listHoldOrders(params)
  }

  async getHoldOrder(id) {
    const hold = await this.repository.getHoldOrderById(id)
    if (!hold) {
      const error = new Error('Hold order not found')
      error.status = 404
      throw error
    }
    return hold
  }

  /**
   * Create hold order: full current-order snapshot for UI restore.
   * @param {Object} body - Validated createHoldOrder payload
   * @param {Object} user - { id, full_name }
   */
  async createHoldOrder(body, user) {
    return await this.repository.createHoldOrder(body, user || null)
  }

  async archiveHoldOrder(id) {
    await this.repository.archiveHoldOrder(id)
  }

  /**
   * Receipt list / get / void
   */
  async listReceipts(params = {}) {
    return this.repository.listReceipts(params)
  }

  async getReceiptByNo(receiptNo) {
    const receipt = await this.repository.getReceiptByReceiptNo(receiptNo)
    if (!receipt) {
      const error = new Error('Receipt not found')
      error.status = 404
      throw error
    }
    return receipt
  }

  async voidReceipt(id) {
    const receipt = await this.repository.voidReceipt(id)
    if (!receipt) {
      const error = new Error('Receipt not found')
      error.status = 404
      throw error
    }
    return receipt
  }
}

