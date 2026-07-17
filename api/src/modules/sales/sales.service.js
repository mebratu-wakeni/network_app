/**
 * Service: Business logic for sales orders.
 * createOrder builds sales_orders + sales_order_items payload and delegates to repository.
 */
import { assertFiscalYearOpen } from '../../services/fiscal-year.guard.js'

export class SalesService {
  constructor(repository) {
    this.repository = repository
  }

  /**
   * Create sales order with items. Each item is persisted in sales_order_items; inventory is decremented.
   */
  async createOrder(payload, user) {
    const {
      customer_id,
      order_date,
      invoice_no,
      withhold_ref,
      remark,
      withhold_reference,
      payment_type,
      withhold_percentage,
      amount_paid,
      cheque_details,
      items,
      hold_order_id
    } = payload

    if (!items || !Array.isArray(items) || items.length === 0) {
      const err = new Error('At least one item is required')
      err.status = 400
      throw err
    }

    const enrichedItems = items.map(it => ({
      ...it,
      total_price: it.quantity * it.unit_price
    }))
    const total_amount = enrichedItems.reduce((sum, it) => sum + it.total_price, 0)

    let appliedWithhold = withhold_percentage != null ? Number(withhold_percentage) : null
    const withhold_amount = appliedWithhold != null ? (total_amount * appliedWithhold) / 100 : 0
    const received_amount = total_amount - withhold_amount

    let paid = amount_paid != null ? Number(amount_paid) : 0
    if (payment_type === 'cash' && (paid === 0 || paid == null)) {
      paid = received_amount
    }
    if (payment_type === 'cheque' && cheque_details?.amount != null) {
      paid = Number(cheque_details.amount)
    }

    let payment_status = 'unpaid'
    if (paid >= received_amount - 0.009 && paid > 0) payment_status = 'paid'
    else if (paid > 0) payment_status = 'partial'

    const receipt_no = await this.repository.generateNextSalesReceiptNumber()

    // Optional note only (e.g. customer will provide withholding receipt later). Not the same as withhold_ref.
    const hasWithholdRef = withhold_reference && String(withhold_reference).trim()
    const withholdRefTrimmed = hasWithholdRef ? String(withhold_reference).trim() : null
    let finalRemark = remark ?? null
    if (withholdRefTrimmed) {
      finalRemark = finalRemark
        ? `${finalRemark}\nWithhold Ref: ${withholdRefTrimmed}`
        : `Withhold Ref: ${withholdRefTrimmed}`
    }

    const trimmedWithholdRef =
      withhold_ref != null && String(withhold_ref).trim() !== ''
        ? String(withhold_ref).trim()
        : null
    const hasWithhold = Number(withhold_amount || 0) > 0.009
    const resolvedWithholdRef = hasWithhold ? trimmedWithholdRef : null
    // Enforced: non-null withhold_ref ⇒ withhold_confirmation true; promise-only ⇒ both null/false.
    const withholdConfirmed = Boolean(resolvedWithholdRef)

    // Enforce fiscal year: block if no open year covers the order date
    const fy = await assertFiscalYearOpen(this.repository.knex, order_date)

    const orderPayload = {
      customer_id: customer_id ?? null,
      order_date,
      fiscal_year: fy.fiscal_year,
      invoice_no: invoice_no ?? null,
      withhold_ref: resolvedWithholdRef,
      remark: finalRemark,
      payment_type,
      payment_status,
      total_amount,
      amount_paid: paid,
      withhold_percentage: appliedWithhold,
      withhold_amount: withhold_amount || null,
      received_amount,
      withhold_settled: false,
      withhold_confirmation: withholdConfirmed,
      receipt_no,
      status: 'completed',
      is_reversed: false,
      encoder_fullname: user?.display_name ?? user?.full_name ?? null
    }

    // Prepare initial payment data for sales_payments table
    let initialPayment = null
    if (payment_type === 'cash' && paid > 0) {
      initialPayment = {
        amount: paid,
        payment_date: order_date,
        payment_method: 'cash',
        note: remark || null
      }
    } else if (payment_type === 'credit' && paid > 0) {
      initialPayment = {
        amount: paid,
        payment_date: order_date,
        payment_method: 'credit',
        note: remark || 'First payment for credit sale'
      }
    } else if (payment_type === 'cheque' && cheque_details && cheque_details.amount != null) {
      initialPayment = {
        amount: Number(cheque_details.amount),
        payment_date: order_date,
        payment_method: 'cheque',
        note: remark || null,
        cheque_no: cheque_details.cheque_number || null,
        bank_name: cheque_details.bank_name || null,
        cheque_date: cheque_details.cheque_date || null
      }
    }

    const result = await this.repository.createOrderWithItems(
      { order: orderPayload, items: enrichedItems, initialPayment },
      user?.id ?? null
    )

    const order = result.order
    return {
      id: order.id,
      receipt_no: order.receipt_no,
      customer_id: order.customer_id,
      order_date: order.order_date,
      total_amount: Number(order.total_amount),
      withhold_amount: Number(order.withhold_amount || 0),
      received_amount: Number(order.received_amount || 0),
      payment_type: order.payment_type,
      payment_status: order.payment_status,
      status: order.status,
      created_at: order.created_at,
      items_count: result.items?.length ?? 0
    }
  }

  /**
   * Get order details including items (from sales_orders + sales_order_items).
   */
  async getOrderDetails(orderId) {
    return this.repository.getOrderById(Number(orderId))
  }

  /**
   * Get receipt for a sales order (built from order + items + customer).
   */
  async getOrderReceipt(id) {
    const receipt = await this.repository.getReceiptByOrderId(id)
    if (!receipt) {
      const err = new Error('Receipt not found')
      err.status = 404
      throw err
    }
    return receipt
  }

  /** Get withhold percentage from system_settings (same global key as purchase). */
  async getWithholdPercentage() {
    const value = await this.repository.getWithholdPercentageSetting()
    return { setting_name: 'withhold_percentage', withhold_percentage: value }
  }

  /** List orders with filters and stats. */
  async listOrders(params) {
    return this.repository.listOrders(params)
  }

  /** Create hold order: full snapshot + index columns for list. */
  async createHoldOrder(snapshot, user) {
    const indexColumns = {
      customer_id: snapshot.customer_id ?? null,
      order_date: snapshot.order_date ?? snapshot.sale_date,
      total_amount: snapshot.total_amount ?? 0,
      payment_type: snapshot.payment_type ?? snapshot.payment_mode ?? 'cash',
      encoder_fullname: user?.display_name ?? user?.full_name ?? null
    }
    const row = await this.repository.createHoldOrder(snapshot, indexColumns, user?.id ?? null)
    return { id: row.id, ...indexColumns, created_at: row.created_at }
  }

  /** List hold orders. */
  async listHoldOrders(params) {
    return this.repository.listHoldOrders(params)
  }

  /** Get one hold order (snapshot for restore). */
  async getHoldOrderById(holdOrderId) {
    return this.repository.getHoldOrderById(Number(holdOrderId))
  }

  /** Archive hold order. */
  async archiveHoldOrder(holdOrderId) {
    return this.repository.archiveHoldOrder(Number(holdOrderId))
  }

  /** Outstanding completed sales for one customer (for bulk payment preview). */
  async getCustomerOutstandingForPayment(customerId) {
    return this.repository.getCustomerOutstandingForPayment(Number(customerId))
  }

  /**
   * Apply one customer payment across outstanding orders (FIFO, LIFO, or manual allocations).
   */
  async recordBulkCustomerSales(payload, userId = null) {
    const {
      customer_id: customerId,
      payment_amount: paymentAmount,
      allocation,
      manual_allocations: manualAllocations,
      payment_mode,
      payment_date,
      cheque_details,
      notes
    } = payload

    const paymentDate = payment_date || new Date().toISOString().split('T')[0]
    await assertFiscalYearOpen(this.repository.knex, paymentDate)

    return this.repository.recordBulkCustomerPayment({
      customerId: Number(customerId),
      paymentAmount: Number(paymentAmount),
      allocation: allocation || 'fifo',
      manualAllocations: manualAllocations || null,
      paymentPayload: {
        payment_mode: payment_mode || 'cash',
        payment_date,
        cheque_details: cheque_details || null,
        notes: notes ?? null
      },
      userId
    })
  }

  /** Record payment on a sales order (supports cash and cheque with details). */
  async recordPayment(orderId, payload, userId = null) {
    const amount = Number(payload.payment_amount)
    const paymentMode = (payload.payment_mode || payload.payment_type || 'cash').toLowerCase()
    const paymentDate = payload.payment_date || new Date().toISOString().split('T')[0]
    await assertFiscalYearOpen(this.repository.knex, paymentDate)
    const chequeDetails = paymentMode === 'cheque' ? payload.cheque_details : null
    const paymentData = {
      amount,
      payment_method: paymentMode,
      payment_date: paymentDate,
      note: payload.notes || null,
      bank_name: chequeDetails?.bank_name || null,
      cheque_no: chequeDetails?.cheque_number || chequeDetails?.cheque_no || null,
      cheque_date: chequeDetails?.cheque_date || null,
    }
    return this.repository.recordPayment(Number(orderId), paymentData, userId)
  }

  /** Confirm withhold: requires non-empty withhold_ref; sets withhold_confirmation true. */
  async confirmWithhold(orderId, withholdRef) {
    const t = withholdRef != null ? String(withholdRef).trim() : ''
    if (!t) {
      const err = new Error('Withhold ref is required')
      err.status = 400
      throw err
    }
    return this.repository.confirmWithhold(Number(orderId), t)
  }

  /** Rollback withhold: clear withhold_ref and withhold_confirmation. */
  async rollbackWithhold(orderId) {
    return this.repository.rollbackWithhold(Number(orderId))
  }

  /** Reverse sales order: restore inventory, set is_reversed. */
  async reverseOrder(orderId, user) {
    const reversalDate = new Date().toISOString().split('T')[0]
    await assertFiscalYearOpen(this.repository.knex, reversalDate)
    return this.repository.reverseOrder(Number(orderId), user?.id ?? null)
  }

  /** Export sales order to CSV. Grouped by order: order meta only on first row of each order (like import purchase preview). */
  async exportSalesOrder() {
    const result = await this.repository.exportSalesOrder()
    const rows = result.export || []
    
    // CSV Headers - serial # first, then order meta, then line item columns
    const headers = [
      '#', 'Order ID', 'Receipt No', 'Order Date', 'Invoice No', 'Total Amount',
      'Withhold Percentage', 'Withhold Amount', 'Amount Paid', 'Payment Type',
      'Payment Status', 'Encoder Fullname', 'Customer Name', 'Customer Address',
      'Customer Phone', 'Customer Contact', 'Customer TIN', 'Product Code',
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
    
    // Group by order_id (rows are already ordered by query; group to get first-row flag per order)
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
              escapeCSV(row.payment_type || ''),
              escapeCSV(row.payment_status || ''),
              escapeCSV(row.encoder_fullname || ''),
              escapeCSV(row.customer_name || ''),
              escapeCSV(row.customer_address || ''),
              escapeCSV(row.customer_phone || ''),
              escapeCSV(row.customer_contact || ''),
              escapeCSV(row.customer_tin || '')
            ]
          : [
              '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
            ]
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
    
    const csvContent = [
      headers.join(','),
      ...csvRows
    ].join('\n')
    
    return csvContent
  }
}
