/**
 * Repository: Data access layer for purchases
 * Encapsulates all DB queries for purchase_orders and related tables.
 */
import { LedgerHelper } from '../../services/ledger.helper.js'

export class PurchaseRepository {
  constructor(knex) {
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  /**
   * Helper: Get last product balance for bin card
   */
  async getLastProductBalance(productId, trx = null) {
    const db = trx || this.knex
    const lastTransaction = await db('bin_cards')
      .where({ product_id: productId })
      .orderBy('transaction_date', 'desc')
      .orderBy('id', 'desc')
      .select('balance')
      .first()
    
    return lastTransaction ? parseInt(lastTransaction.balance, 10) : 0
  }

  /**
   * Helper: Generate inventory code
   */
  async generateInventoryCode(productCode, trx = null) {
    const db = trx || this.knex
    
    // Extract numeric part from product code (e.g., "PRD0001" -> "0001")
    const productCodeDigits = productCode.replace(/\D/g, '').slice(-4) || '0000'
    
    // Find max variation for this product code pattern
    const existing = await db('inventories')
      .leftJoin('products', 'inventories.product_id', 'products.id')
      .where('products.product_code', 'like', `${productCode}%`)
      .select('inventories.inventory_code')
      .orderBy('inventories.id', 'desc')
      .limit(100)
    
    let maxVariation = 0
    existing.forEach(inv => {
      if (inv.inventory_code) {
        const match = inv.inventory_code.match(/^I(\d{3})/)
        if (match) {
          const variation = parseInt(match[1], 10)
          if (variation > maxVariation) maxVariation = variation
        }
      }
    })
    
    const nextVariation = maxVariation + 1
    const variationStr = String(nextVariation).padStart(3, '0')
    
    return `I${variationStr}${productCodeDigits}`
  }

  /**
   * Helper: Find existing inventory by product and variation details
   */
  async findExistingInventory(productId, batchNo, expiryDate, purchasePrice, trx = null) {
    const db = trx || this.knex
    let query = db('inventories')
      .where({ product_id: productId })
      .where({ purchase_price: purchasePrice })

    if (batchNo) {
      query = query.where({ batch_no: batchNo })
    } else {
      query = query.whereNull('batch_no')
    }

    if (expiryDate) {
      query = query.where({ expiry_date: expiryDate })
    } else {
      query = query.whereNull('expiry_date')
    }

    return query.first()
  }

  /**
   * Helper: Create bin card transaction
   */
  async createBinCardTransaction(params, trx = null) {
    const {
      productId,
      inventoryId,
      batchNo,
      expiryDate,
      transactionDate,
      quantity,
      unitCost,
      openingBalance,
      reason,
      notes,
      createdBy
    } = params

    const db = trx || this.knex
    const totalCost = quantity * unitCost
    const balance = openingBalance + quantity

    const [binCard] = await db('bin_cards')
      .insert({
        product_id: productId,
        inventory_id: inventoryId,
        batch_no: batchNo || null,
        expiry_date: expiryDate || null,
        transaction_date: transactionDate,
        transaction_type: 'received',
        reference_id: inventoryId,
        reference_table: 'inventories',
        opening_balance: openingBalance,
        quantity_in: quantity,
        quantity_out: 0,
        balance: balance,
        unit_cost: unitCost,
        total_cost: totalCost,
        reason: reason || 'Purchase Order',
        notes: notes || null,
        created_by: createdBy || null,
        created_at: db.fn.now(),
        last_updated: db.fn.now()
      })
      .returning('*')

    return binCard
  }

  /**
   * Lookup products for dropdown/search
   */
  async findProducts({ search, limit = 50 }) {
    const q = this.knex('products')
      .select('id', 'product_code', 'name', 'description as category') // category name requires join; keep simple here
      .limit(limit)

    if (search) {
      const term = `%${search}%`
      q.where(builder => {
        builder
          .whereILike('name', term)
          .orWhereILike('product_code', term)
      })
    }

    return q
  }

  /**
   * Lookup suppliers (customers with customer_type including 'supplier')
   */
  async findSuppliers({ search, limit = 50 }) {
    const q = this.knex('customers')
      .select('id', 'name', 'customer_type', 'contact_person', 'phone', 'email')
      .whereIn('customer_type', ['supplier', 'both'])
      .limit(limit)

    if (search) {
      const term = `%${search}%`
      q.andWhere(builder => {
        builder.whereILike('name', term)
      })
    }

    return q
  }

  /**
   * Get withhold percentage from system_settings
   */
  async getWithholdPercentageSetting() {
    const hasTable = await this.knex.schema.hasTable('system_settings')
    if (!hasTable) return null
    const setting = await this.knex('system_settings')
      .where({ setting_key: 'withhold_percentage' })
      .first()

    if (!setting || setting.setting_value == null || setting.setting_value === '') return null

    const numeric = Number(setting.setting_value)
    return Number.isFinite(numeric) ? numeric : null
  }

  /**
   * Create purchase order, items, optional initial payment and receipt snapshot in a transaction.
   * Expects all computed financials (subtotal, withhold, net, payment_status, amount_paid, etc.) in payload.
   */
  async createOrderWithItemsAndReceipt(payload, userId = null) {
    return this.knex.transaction(async (trx) => {
      const {
        order,
        items,
        initialPayment, // optional
        receiptSnapshot // { snapshot_data, order_meta, order_items, order_payment }
      } = payload

      // 0) Cash balance validation: prevent negative cash for cash purchases
      if (order.payment_mode === 'cash') {
        const netAmount = Number(order.total_amount || 0) - Number(order.withhold_amount || 0)
        if (netAmount > 0) {
          const hasLedger = await trx.schema.hasTable('account_ledger')
          if (hasLedger) {
            const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx)
            const cashBalance = Number(balances['1100'] ?? 0)
            if (cashBalance < netAmount) {
              const err = new Error(
                `Insufficient cash balance. Current cash: ${cashBalance.toFixed(2)}. Required: ${netAmount.toFixed(2)}.`
              )
              err.status = 400
              throw err
            }
          }
        }
      }

      // 1) Insert order
      const [insertedOrder] = await trx('purchase_orders')
        .insert({
          supplier_id: order.supplier_id,
          order_date: order.order_date,
          invoice_no: order.invoice_no || null,
          remark: order.remark || null,
          payment_mode: order.payment_mode,
          payment_status: order.payment_status,
          total_amount: order.total_amount,
          amount_paid: order.amount_paid,
          withhold_percentage: order.withhold_percentage,
          withhold_amount: order.withhold_amount,
          withhold_settled: order.withhold_settled || false,
          receipt_no: order.receipt_no,
          status: order.status || 'completed',
          encoder_id: userId || null,
          encoder_fullname: order.encoder_fullname || null,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now(),
          sync_status: 'pending'
        })
        .returning('*')

      const orderId = insertedOrder.id

      // 2) Insert items
      const itemsToInsert = items.map(it => ({
        purchase_order_id: orderId,
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_price,
        inventory_id: null,
        created_at: trx.fn.now(),
        last_updated: trx.fn.now(),
        sync_status: 'pending'
      }))

      const insertedItems = await trx('purchase_order_items')
        .insert(itemsToInsert)
        .returning('*')

      // 3) Optional initial payment record
      let paymentRecord = null
      if (initialPayment && initialPayment.amount > 0) {
        const [payment] = await trx('purchase_payments')
          .insert({
            purchase_order_id: orderId,
            payment_date: initialPayment.payment_date,
            amount: initialPayment.amount,
            note: initialPayment.note || null,
            payment_method: initialPayment.payment_method,
            cheque_no: initialPayment.cheque_no || null,
            bank_name: initialPayment.bank_name || null,
            branch_name: initialPayment.branch_name || null,
            cheque_date: initialPayment.cheque_date || null,
            cleared_date: null,
            created_at: trx.fn.now(),
            last_updated: trx.fn.now(),
            sync_status: 'pending'
          })
          .returning('*')

        paymentRecord = payment
      }

      // 4) Insert receipt snapshot (purchase_receipts)
      if (receiptSnapshot) {
        const snapshot = {
          receipt_no: insertedOrder.receipt_no,
          purchase_order_id: orderId,
          snapshot_data: typeof receiptSnapshot.snapshot_data === 'string'
            ? receiptSnapshot.snapshot_data
            : JSON.stringify(receiptSnapshot.snapshot_data || {}),
          order_meta: typeof receiptSnapshot.order_meta === 'string'
            ? receiptSnapshot.order_meta
            : JSON.stringify(receiptSnapshot.order_meta || {}),
          order_items: typeof receiptSnapshot.order_items === 'string'
            ? receiptSnapshot.order_items
            : JSON.stringify(receiptSnapshot.order_items || []),
          order_payment: typeof receiptSnapshot.order_payment === 'string'
            ? receiptSnapshot.order_payment
            : JSON.stringify(receiptSnapshot.order_payment || {}),
          voided: false,
          generated_at: trx.fn.now(),
          created_at: trx.fn.now(),
          last_updated: trx.fn.now(),
          sync_status: 'pending'
        }

        await trx('purchase_receipts').insert(snapshot)
      }

      // 5) Create inventory records, bin cards, and ledger entries for each item
      const inventoryIds = []
      for (const item of insertedItems) {
        // Get product details
        const product = await trx('products').where({ id: item.product_id }).first()
        if (!product) {
          throw new Error(`Product ${item.product_id} not found`)
        }

        // Find or create inventory record
        const batchNo = items.find(i => i.product_id === item.product_id)?.batch_number || null
        const expiryDate = items.find(i => i.product_id === item.product_id)?.expiry_date || null
        
        let inventory = await this.findExistingInventory(
          item.product_id,
          batchNo,
          expiryDate,
          item.unit_price,
          trx
        )

        let inventoryId
        if (inventory) {
          // Update existing inventory quantity
          await trx('inventories')
            .where({ id: inventory.id })
            .update({
              quantity: trx.raw('quantity + ?', [item.quantity]),
              last_updated: trx.fn.now()
            })
          inventoryId = inventory.id
        } else {
          // Create new inventory record
          const inventoryCode = await this.generateInventoryCode(product.product_code, trx)
          const [newInventory] = await trx('inventories')
            .insert({
              product_id: item.product_id,
              inventory_code: inventoryCode,
              batch_no: batchNo,
              expiry_date: expiryDate,
              purchase_date: order.order_date,
              acquisition_type: order.payment_mode,
              purchase_price: item.unit_price,
              quantity: item.quantity,
              selling_price: null,
              settlement_status: order.payment_mode === 'cash' ? 'fully_settled' : 'unsettled',
              location: null,
              notes: `Purchase Order ${order.receipt_no}`,
              created_at: trx.fn.now(),
              last_updated: trx.fn.now(),
              sync_status: 'pending'
            })
            .returning('id')
          
          inventoryId = newInventory.id || newInventory
        }

        // Update purchase_order_items with inventory_id
        await trx('purchase_order_items')
          .where({ id: item.id })
          .update({ inventory_id: inventoryId })

        inventoryIds.push(inventoryId)

        // Create bin card entry
        const openingBalance = await this.getLastProductBalance(item.product_id, trx)
        await this.createBinCardTransaction({
          productId: item.product_id,
          inventoryId: inventoryId,
          batchNo: batchNo,
          expiryDate: expiryDate,
          transactionDate: order.order_date,
          quantity: item.quantity,
          unitCost: item.unit_price,
          openingBalance: openingBalance,
          reason: `Purchase Order ${order.receipt_no}`,
          notes: `Item: ${product.name}`,
          createdBy: userId
        }, trx)
      }

      // 6) Create ledger entries based on payment mode (when account_ledger exists)
      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        if (order.payment_mode === 'cash') {
          await this.ledgerHelper.recordPurchaseCash({
            purchaseOrderId: orderId,
            totalAmount: order.total_amount,
            withholdAmount: order.withhold_amount || 0,
            transactionDate: order.order_date,
            referenceNumber: order.receipt_no,
            memo: order.remark || null,
            createdBy: userId
          }, trx)
        } else if (order.payment_mode === 'credit') {
          await this.ledgerHelper.recordPurchaseCredit({
            purchaseOrderId: orderId,
            totalAmount: order.total_amount,
            withholdAmount: order.withhold_amount || 0,
            firstPayment: initialPayment?.amount || 0,
            transactionDate: order.order_date,
            referenceNumber: order.receipt_no,
            memo: order.remark || null,
            createdBy: userId
          }, trx)
        } else if (order.payment_mode === 'cheque') {
          await this.ledgerHelper.recordPurchaseCheque({
            purchaseOrderId: orderId,
            totalAmount: order.total_amount,
            withholdAmount: order.withhold_amount || 0,
            chequeAmount: initialPayment?.amount || 0,
            transactionDate: order.order_date,
            referenceNumber: order.receipt_no,
            memo: order.remark || null,
            createdBy: userId
          }, trx)
        }
      }

      return {
        order: insertedOrder,
        items: insertedItems,
        initialPayment: paymentRecord,
        inventoryIds
      }
    })
  }

  /**
   * Generate next purchase receipt number (PO000001, PO000002, ...)
   */
  async generateNextReceiptNumber() {
    // Get max existing receipt_no that matches PO pattern
    const row = await this.knex('purchase_orders')
      .where('receipt_no', 'like', 'PO%')
      .orderBy('id', 'desc')
      .select('receipt_no')
      .first()

    if (!row || !row.receipt_no) {
      return 'PO000001'
    }

    const match = row.receipt_no.match(/^PO(\d{6,})$/)
    if (!match) {
      // Fallback if pattern changed
      return 'PO000001'
    }

    const current = parseInt(match[1], 10)
    const next = current + 1
    return `PO${String(next).padStart(match[1].length, '0')}`
  }

  /**
   * Get purchase order by ID with supplier, items, and payments.
   */
  async getOrderById(orderId) {
    const order = await this.knex('purchase_orders as po')
      .leftJoin('customers as c', 'po.supplier_id', 'c.id')
      .where('po.id', orderId)
      .select(
        'po.*',
        'c.name as supplier_name'
      )
      .first()

    if (!order) return null

    const items = await this.knex('purchase_order_items as i')
      .leftJoin('products as p', 'i.product_id', 'p.id')
      .where('i.purchase_order_id', orderId)
      .select(
        'i.*',
        'p.product_code',
        'p.name as product_name'
      )

    const payments = await this.knex('purchase_payments')
      .where('purchase_order_id', orderId)
      .orderBy('created_at', 'asc')

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const subtotal = Number(order.total_amount || 0)
    const withholdAmount = Number(order.withhold_amount || 0)
    const netAmount = subtotal - withholdAmount
    const outstanding = netAmount - totalPaid

    return {
      order: {
        ...order,
        supplier_name: order.supplier_name,
        subtotal,
        withhold_amount: withholdAmount,
        net_amount: netAmount,
        total_paid: totalPaid,
        outstanding_balance: outstanding
      },
      items,
      payments
    }
  }

  /**
   * List orders with filters and computed stats.
   * Returns { orders, total, stats }
   */
  async listOrders(filters) {
    const {
      limit = 20,
      offset = 0,
      search,
      status,
      supplier_id,
      payment_mode,
      date_from,
      date_to,
      has_outstanding_balance,
      sort_by = 'order_date',
      order_by = 'desc'
    } = filters

    const base = this.knex('purchase_orders as po')
      .leftJoin('customers as c', 'po.supplier_id', 'c.id')

    // Filters
    base.where(builder => {
      builder.whereIn('po.status', ['completed', 'archived', 'reversed'])
    })

    if (status) {
      base.andWhere('po.status', status)
    } else {
      base.andWhere('po.status', 'completed')
    }

    if (supplier_id) {
      base.andWhere('po.supplier_id', supplier_id)
    }

    if (payment_mode) {
      base.andWhere('po.payment_mode', payment_mode)
    }

    if (date_from) {
      base.andWhere('po.order_date', '>=', date_from)
    }

    if (date_to) {
      base.andWhere('po.order_date', '<=', date_to)
    }

    if (search) {
      const term = `%${search}%`
      base.andWhere(builder => {
        builder
          .whereILike('po.receipt_no', term)
          .orWhereILike('c.name', term)
      })
    }

    // Subquery for total paid per order
    const paymentsSubquery = this.knex('purchase_payments')
      .select('purchase_order_id')
      .sum({ total_paid: 'amount' })
      .groupBy('purchase_order_id')
      .as('pp')

    base
      .leftJoin(paymentsSubquery, 'po.id', 'pp.purchase_order_id')
      .select(
        'po.id',
        'po.receipt_no',
        'c.name as supplier_name',
        'po.order_date',
        'po.total_amount',
        'po.withhold_amount',
        'po.payment_mode',
        'po.status',
        this.knex.raw('(coalesce(po.total_amount,0) - coalesce(po.withhold_amount,0)) as net_amount'),
        this.knex.raw('coalesce(pp.total_paid,0) as total_paid'),
        this.knex.raw('(coalesce(po.total_amount,0) - coalesce(po.withhold_amount,0) - coalesce(pp.total_paid,0)) as outstanding_balance')
      )

    if (has_outstanding_balance === true || has_outstanding_balance === 'true') {
      base.andWhereRaw('(coalesce(po.total_amount,0) - coalesce(po.withhold_amount,0) - coalesce(pp.total_paid,0)) > 0.009')
    } else if (has_outstanding_balance === false || has_outstanding_balance === 'false') {
      base.andWhereRaw('(coalesce(po.total_amount,0) - coalesce(po.withhold_amount,0) - coalesce(pp.total_paid,0)) <= 0.009')
    }

    // Total count (without limit/offset)
    const totalResult = await base.clone().clearSelect().clearOrder().countDistinct({ count: 'po.id' }).first()
    const total = Number(totalResult?.count || 0)

    // Sorting & pagination
    const allowedSort = ['order_date', 'id', 'receipt_no', 'net_amount', 'supplier_name']
    const sortColumn = allowedSort.includes(sort_by) ? sort_by : 'order_date'
    const sortDir = order_by === 'asc' ? 'asc' : 'desc'

    const orders = await base
      .orderBy(sortColumn, sortDir)
      .limit(limit)
      .offset(offset)

    // Stats: static (no list filters) — only completed/archived/reversed orders
    const statsBase = this.knex('purchase_orders as po')
      .leftJoin(paymentsSubquery, 'po.id', 'pp.purchase_order_id')
      .whereIn('po.status', ['completed', 'archived', 'reversed'])

    const statsRows = await statsBase
      .select(
        'po.payment_mode',
        'po.status',
        this.knex.raw('(coalesce(po.total_amount,0) - coalesce(po.withhold_amount,0)) as net_amount'),
        this.knex.raw('coalesce(pp.total_paid,0) as total_paid'),
        'po.withhold_amount'
      )

    const stats = {
      total_orders: { count: 0, value: 0 },
      cash_orders: { count: 0, value: 0 },
      credit_orders: { count: 0, value: 0 },
      cheque_orders: { count: 0, value: 0 },
      outstanding_balance: { count: 0, value: 0 },
      total_withhold_amount: { count: 0, value: 0 },
      reversed_orders: { count: 0, value: 0 }
    }

    for (const row of statsRows) {
      const net = Number(row.net_amount || 0)
      const paid = Number(row.total_paid || 0)
      const withhold = Number(row.withhold_amount || 0)
      const outstanding = net - paid

      stats.total_orders.count += 1
      stats.total_orders.value += net

      if (row.payment_mode === 'cash') {
        stats.cash_orders.count += 1
        stats.cash_orders.value += net
      } else if (row.payment_mode === 'credit') {
        stats.credit_orders.count += 1
        stats.credit_orders.value += net
      } else if (row.payment_mode === 'cheque') {
        stats.cheque_orders.count += 1
        stats.cheque_orders.value += net
      }

      if (outstanding > 0.009) {
        stats.outstanding_balance.count += 1
        stats.outstanding_balance.value += outstanding
      }

      if (withhold > 0.009) {
        stats.total_withhold_amount.count += 1
        stats.total_withhold_amount.value += withhold
      }

      if (row.status === 'reversed') {
        stats.reversed_orders.count += 1
        stats.reversed_orders.value += net
      }
    }

    return { orders, total, stats }
  }

  /**
   * Record payment against a purchase order within a transaction.
   * Also updates purchase_orders.amount_paid and payment_status.
   * Validates against overpayment.
   */
  async recordPayment(orderId, paymentData, userId = null) {
    return this.knex.transaction(async (trx) => {
      const order = await trx('purchase_orders').where({ id: orderId }).first()
      if (!order) {
        const error = new Error('Purchase order not found')
        error.status = 404
        throw error
      }

      // Check if order is already fully paid or reversed
      if (order.status === 'reversed') {
        const error = new Error('Cannot record payment for a reversed order')
        error.status = 400
        throw error
      }

      const subtotal = Number(order.total_amount || 0)
      const withholdAmount = Number(order.withhold_amount || 0)
      const netAmount = subtotal - withholdAmount

      // Current paid
      const paymentsAgg = await trx('purchase_payments')
        .where('purchase_order_id', orderId)
        .sum({ total_paid: 'amount' })
        .first()

      const alreadyPaid = Number(paymentsAgg?.total_paid || 0)
      const newTotalPaid = alreadyPaid + paymentData.amount
      const remaining = netAmount - newTotalPaid

      // Validate: prevent overpayment (allow small rounding differences)
      if (remaining < -0.01) {
        const error = new Error(
          `Payment amount exceeds outstanding balance. Outstanding: ${(netAmount - alreadyPaid).toFixed(2)}, Payment: ${paymentData.amount.toFixed(2)}`
        )
        error.status = 400
        throw error
      }

      // Validate: payment amount must be positive
      if (paymentData.amount <= 0) {
        const error = new Error('Payment amount must be greater than zero')
        error.status = 400
        throw error
      }

      // Cash balance validation: prevent negative cash for cash payments
      if (paymentData.payment_method === 'cash') {
        const hasLedger = await trx.schema.hasTable('account_ledger')
        if (hasLedger) {
          const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx)
          const cashBalance = Number(balances['1100'] ?? 0)
          if (cashBalance < paymentData.amount) {
            const err = new Error(
              `Insufficient cash balance. Current cash: ${cashBalance.toFixed(2)}. Payment amount: ${paymentData.amount.toFixed(2)}.`
            )
            err.status = 400
            throw err
          }
        }
      }

      // Insert payment row
      const [payment] = await trx('purchase_payments')
        .insert({
          purchase_order_id: orderId,
          payment_date: paymentData.payment_date,
          amount: paymentData.amount,
          note: paymentData.note || null,
          payment_method: paymentData.payment_method,
          cheque_no: paymentData.cheque_no || null,
          bank_name: paymentData.bank_name || null,
          branch_name: paymentData.branch_name || null,
          cheque_date: paymentData.cheque_date || null,
          cleared_date: null,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now(),
          sync_status: 'pending'
        })
        .returning('*')

      // Update order: amount_paid = sum total of all payments; payment_status from remaining balance
      let paymentStatus = 'paid'
      if (remaining > 0.009 && newTotalPaid > 0) {
        paymentStatus = 'partial'
      } else if (newTotalPaid <= 0.009) {
        paymentStatus = 'unpaid'
      }

      await trx('purchase_orders')
        .where({ id: orderId })
        .update({
          amount_paid: newTotalPaid, // sum of all purchase_payments for this order
          payment_status: paymentStatus,
          last_updated: trx.fn.now()
        })

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        await this.ledgerHelper.recordPurchasePayment({
          purchaseOrderId: orderId,
          paymentId: payment.id,
          amount: paymentData.amount,
          paymentMethod: paymentData.payment_method,
          transactionDate: paymentData.payment_date,
          referenceNumber: order.receipt_no,
          memo: paymentData.note || null,
          createdBy: userId
        }, trx)
      }

      return {
        payment,
        remaining_balance: Math.max(0, remaining) // Ensure non-negative
      }
    })
  }

  /**
   * Get payment history for an order.
   */
  async getPaymentHistory(orderId) {
    const payments = await this.knex('purchase_payments')
      .where('purchase_order_id', orderId)
      .orderBy('created_at', 'asc')

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

    const order = await this.knex('purchase_orders').where({ id: orderId }).first()

    const subtotal = Number(order?.total_amount || 0)
    const withholdAmount = Number(order?.withhold_amount || 0)
    const netAmount = subtotal - withholdAmount
    const outstanding = netAmount - totalPaid

    return {
      payments,
      total_paid: totalPaid,
      outstanding_balance: outstanding
    }
  }

  /**
   * Reverse purchase order: reverses inventory, bin cards, and ledger entries
   * @param {number} orderId - Purchase order ID
   * @param {Object} options - { reason, reverse_inventory, reverse_ledger, userId }
   */
  async reverseOrder(orderId, options = {}) {
    const { reason, reverse_inventory = true, reverse_ledger = true, userId = null } = options

    return this.knex.transaction(async (trx) => {
      // Get order with items
      const order = await trx('purchase_orders').where({ id: orderId }).first()
      if (!order) {
        const error = new Error('Purchase order not found')
        error.status = 404
        throw error
      }

      if (order.status === 'reversed') {
        const error = new Error('Order is already reversed')
        error.status = 400
        throw error
      }

      const items = await trx('purchase_order_items')
        .where('purchase_order_id', orderId)
        .whereNotNull('inventory_id')

      // Reverse inventory entries
      if (reverse_inventory) {
        for (const item of items) {
          if (!item.inventory_id) continue

          const inventory = await trx('inventories').where({ id: item.inventory_id }).first()
          if (!inventory) continue

          // Get current balance
          const openingBalance = await this.getLastProductBalance(item.product_id, trx)

          // Reduce inventory quantity
          const newQuantity = Math.max(0, inventory.quantity - item.quantity)
          await trx('inventories')
            .where({ id: item.inventory_id })
            .update({
              quantity: newQuantity,
              last_updated: trx.fn.now()
            })

          // Create reverse bin card entry (issued)
          await trx('bin_cards').insert({
            product_id: item.product_id,
            inventory_id: item.inventory_id,
            batch_no: inventory.batch_no,
            expiry_date: inventory.expiry_date,
            transaction_date: new Date().toISOString().split('T')[0],
            transaction_type: 'issued',
            reference_id: orderId,
            reference_table: 'purchase_orders',
            opening_balance: openingBalance,
            quantity_in: 0,
            quantity_out: item.quantity,
            balance: openingBalance - item.quantity,
            unit_cost: item.unit_price,
            total_cost: item.quantity * item.unit_price,
            reason: `REVERSAL: Purchase Order ${order.receipt_no}`,
            notes: reason || 'Order reversal',
            created_by: userId,
            created_at: trx.fn.now(),
            last_updated: trx.fn.now()
          })
        }
      }

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (reverse_ledger && hasLedger) {
        await this.ledgerHelper.reversePurchaseOrder({
          purchaseOrderId: orderId,
          transactionDate: new Date().toISOString().split('T')[0],
          reason: reason || 'Order reversal',
          referenceNumber: `REV-${order.receipt_no}`,
          createdBy: userId
        }, trx)
      }

      // Update order status
      await trx('purchase_orders')
        .where({ id: orderId })
        .update({
          status: 'reversed',
          last_updated: trx.fn.now()
        })

      return {
        order_id: orderId,
        status: 'reversed',
        reversal_date: new Date().toISOString()
      }
    })
  }

  /**
   * Bulk import purchases: creates purchase orders from CSV-style data
   * Creates a single purchase order with multiple items
   * @param {Object} importData - { purchase_date, supplier_id, payment_mode, withhold_percentage, stock_items }
   * @param {number} userId - User ID
   */
  async bulkImportPurchases(importData, userId = null) {
    const {
      purchase_date,
      supplier_id,
      payment_mode = 'cash',
      withhold_percentage,
      stock_items
    } = importData

    const successful = []
    const failed = []

    // Validate all products first
    const validatedItems = []
    for (let i = 0; i < stock_items.length; i++) {
      const item = stock_items[i]

      try {
        // Find product by name or code
        let product = null
        if (item.product_code) {
          product = await this.knex('products')
            .where({ product_code: item.product_code })
            .first()
        }

        if (!product && item.product_name) {
          product = await this.knex('products')
            .whereRaw('LOWER(name) = LOWER(?)', [item.product_name])
            .first()
        }

        if (!product) {
          failed.push({
            index: i,
            item,
            error: `Product not found: ${item.product_code || item.product_name}`
          })
          continue
        }

        validatedItems.push({ ...item, product, index: i })
      } catch (error) {
        failed.push({
          index: i,
          item,
          error: error.message || 'Unknown error during validation'
        })
      }
    }

    if (validatedItems.length === 0) {
      return {
        successful: [],
        failed,
        summary: {
          total: stock_items.length,
          successful: 0,
          failed: failed.length
        }
      }
    }

    // Create single purchase order with all items
    try {
      const receiptNo = await this.generateNextReceiptNumber()

      // Calculate totals
      const items = validatedItems.map(v => ({
        product_id: v.product.id,
        quantity: v.quantity,
        unit_price: v.unit_cost,
        total_price: v.quantity * v.unit_cost,
        batch_number: v.batch_number || null,
        expiry_date: v.expiry_date || null
      }))

      const subtotal = items.reduce((sum, it) => sum + it.total_price, 0)
      const appliedWithhold = withhold_percentage != null ? withhold_percentage : (await this.getWithholdPercentageSetting())
      const withholdAmount = appliedWithhold != null ? (subtotal * appliedWithhold) / 100 : 0
      const netAmount = subtotal - withholdAmount

      // Determine payment status
      let amountPaid = 0
      let paymentStatus = 'unpaid'
      if (payment_mode === 'cash') {
        amountPaid = netAmount
        paymentStatus = 'paid'
      }

      // Create order in transaction (reuse createOrderWithItemsAndReceipt logic)
      const result = await this.createOrderWithItemsAndReceipt({
        order: {
          supplier_id,
          order_date: purchase_date,
          invoice_no: null,
          remark: 'Bulk Import',
          payment_mode,
          payment_status: paymentStatus,
          total_amount: subtotal,
          amount_paid: amountPaid,
          withhold_percentage: appliedWithhold,
          withhold_amount: withholdAmount,
          withhold_settled: false,
          receipt_no: receiptNo,
          status: 'completed',
          encoder_fullname: null
        },
        items,
        initialPayment: payment_mode === 'cash' ? {
          amount: netAmount,
          payment_date: purchase_date,
          payment_method: 'cash',
          note: 'Bulk Import'
        } : null,
        receiptSnapshot: null // Skip receipt snapshot for bulk import
      }, userId)

      // Mark all items as successful
      validatedItems.forEach(v => {
        successful.push({
          index: v.index,
          item: stock_items[v.index],
          purchase_order_id: result.order.id,
          receipt_no: receiptNo,
          inventory_id: result.inventoryIds?.[validatedItems.indexOf(v)] || null
        })
      })
    } catch (error) {
      // If order creation fails, mark all items as failed
      validatedItems.forEach(v => {
        failed.push({
          index: v.index,
          item: stock_items[v.index],
          error: error.message || 'Failed to create purchase order'
        })
      })
    }

    return {
      successful,
      failed,
      summary: {
        total: stock_items.length,
        successful: successful.length,
        failed: failed.length
      }
    }
  }

  /**
   * Simple hold orders list / get / delete
   */
  async listHoldOrders({ limit = 20, offset = 0, search, sort_by, order_by, filter = 'active' }) {
    const q = this.knex('purchase_hold_orders as h')
      .leftJoin('customers as c', 'h.supplier_id', 'c.id')

    if (filter === 'active') {
      q.where('h.is_archive', false)
    } else if (filter === 'archived') {
      q.where('h.is_archive', true)
    }
    // filter === 'all': no is_archive filter

    if (search) {
      const term = `%${search}%`
      q.andWhere(builder => {
        builder
          .whereILike('c.name', term)
          .orWhereILike('h.invoice_no', term)
      })
    }

    const totalRow = await q.clone().clearSelect().clearOrder().countDistinct({ count: 'h.id' }).first()
    const total = Number(totalRow?.count || 0)

    const sortCol = sort_by || 'created_at'
    const sortDir = order_by === 'asc' ? 'asc' : 'desc'

    const hold_orders = await q
      .select(
        'h.id',
        'c.name as supplier_name',
        'h.order_date',
        'h.total_amount as net_amount',
        'h.items',
        'h.created_at'
      )
      .orderBy(sortCol, sortDir)
      .limit(limit)
      .offset(offset)

    return { hold_orders, total }
  }

  async getHoldOrderById(id) {
    const hold = await this.knex('purchase_hold_orders as h')
      .leftJoin('customers as c', 'h.supplier_id', 'c.id')
      .where('h.id', id)
      .select('h.*', 'c.name as supplier_name')
      .first()

    return hold || null
  }

  /**
   * Create hold order: full current-order snapshot for UI restore.
   * @param {Object} snapshot - Validated createHoldOrder payload
   * @param {Object} user - { id, full_name }
   */
  async createHoldOrder(snapshot, user) {
    const itemsJson = typeof snapshot.items === 'string' ? snapshot.items : JSON.stringify(snapshot.items || [])
    const chequeDetailsJson =
      snapshot.cheque_details == null
        ? null
        : typeof snapshot.cheque_details === 'string'
          ? snapshot.cheque_details
          : JSON.stringify(snapshot.cheque_details)

    const [row] = await this.knex('purchase_hold_orders')
      .insert({
        supplier_id: snapshot.supplier_id,
        order_date: snapshot.order_date,
        invoice_no: snapshot.invoice_no || null,
        remark: snapshot.remark || null,
        payment_mode: snapshot.payment_mode,
        total_amount: snapshot.total_amount,
        amount_paid: snapshot.amount_paid != null ? snapshot.amount_paid : null,
        withhold_percentage: snapshot.withhold_percentage != null ? snapshot.withhold_percentage : null,
        withhold_amount: snapshot.withhold_amount != null ? snapshot.withhold_amount : null,
        first_payment: snapshot.first_payment != null ? snapshot.first_payment : null,
        cheque_details: chequeDetailsJson,
        items: itemsJson,
        is_archive: false,
        encoder_id: user?.id ?? null,
        encoder_fullname: user?.full_name ?? null
      })
      .returning('*')

    return row
  }

  async archiveHoldOrder(id) {
    await this.knex('purchase_hold_orders')
      .where({ id })
      .update({
        is_archive: true,
        last_updated: this.knex.fn.now()
      })
  }

  /**
   * Receipt APIs
   */
  async getReceiptByOrderId(orderId) {
    const row = await this.knex('purchase_receipts')
      .where({ purchase_order_id: orderId, voided: false })
      .orderBy('generated_at', 'desc')
      .orderBy('id', 'desc')
      .first()
    if (!row) return null
    return this._enrichReceipt(row)
  }

  async _enrichReceipt(row) {
    let order_meta = {}
    let order_items = []
    let order_payment = {}
    try {
      order_meta = typeof row.order_meta === 'string' ? JSON.parse(row.order_meta) : (row.order_meta || {})
      order_items = typeof row.order_items === 'string' ? JSON.parse(row.order_items) : (row.order_items || [])
      order_payment = typeof row.order_payment === 'string' ? JSON.parse(row.order_payment) : (row.order_payment || {})
    } catch (e) { /* keep defaults */ }
    const productIds = [...new Set((order_items || []).map(it => it.product_id).filter(Boolean))]
    let productMap = {}
    if (productIds.length > 0) {
      const products = await this.knex('products').whereIn('id', productIds).select('id', 'name', 'product_code')
      products.forEach(p => { productMap[p.id] = { name: p.name, product_code: p.product_code } })
    }
    const enrichedItems = (order_items || []).map(it => ({
      ...it,
      product_name: (productMap[it.product_id] && productMap[it.product_id].name) || `Product #${it.product_id}`,
      product_code: (productMap[it.product_id] && productMap[it.product_id].product_code) || ''
    }))
    let supplier_name = null
    let supplier_address = null
    let supplier_phone = null
    let supplier_contact = null
    let supplier_email = null
    let supplier_tin = null
    if (order_meta && order_meta.supplier_id) {
      const supplier = await this.knex('customers')
        .where({ id: order_meta.supplier_id })
        .select('name', 'address', 'phone', 'contact_person', 'email', 'tin_no')
        .first()
      if (supplier) {
        supplier_name = supplier.name
        supplier_address = supplier.address || null
        supplier_phone = supplier.phone || null
        supplier_contact = supplier.contact_person || null
        supplier_email = supplier.email || null
        supplier_tin = supplier.tin_no || null
      }
    }
    let encoder_fullname = null
    if (row.purchase_order_id) {
      const order = await this.knex('purchase_orders')
        .where({ id: row.purchase_order_id })
        .select('encoder_fullname')
        .first()
      encoder_fullname = order ? order.encoder_fullname : null
    }
    return {
      ...row,
      order_meta: {
        ...order_meta,
        supplier_name,
        supplier_address,
        supplier_phone,
        supplier_contact,
        supplier_email,
        supplier_tin
      },
      order_items: enrichedItems,
      order_payment,
      encoder_fullname
    }
  }

  async getReceiptByReceiptNo(receiptNo) {
    return this.knex('purchase_receipts')
      .where({ receipt_no: receiptNo })
      .first()
  }

  async listReceipts({ limit = 20, offset = 0, search, voided, date_from, date_to, sort_by, order_by }) {
    const q = this.knex('purchase_receipts as r')

    if (search) {
      const term = `%${search}%`
      q.andWhere(builder => {
        builder.whereILike('r.receipt_no', term)
      })
    }

    if (voided === true || voided === 'true') {
      q.andWhere('r.voided', true)
    } else if (voided === false || voided === 'false') {
      q.andWhere('r.voided', false)
    }

    if (date_from) q.andWhere('r.generated_at', '>=', date_from)
    if (date_to) q.andWhere('r.generated_at', '<=', date_to)

    const totalRow = await q.clone().clearSelect().clearOrder().countDistinct({ count: 'r.id' }).first()
    const total = Number(totalRow?.count || 0)

    const sortCol = sort_by || 'generated_at'
    const sortDir = order_by === 'asc' ? 'asc' : 'desc'

    const receipts = await q
      .select(
        'r.id',
        'r.receipt_no',
        'r.purchase_order_id',
        'r.order_meta',
        'r.voided',
        'r.generated_at'
      )
      .orderBy(sortCol, sortDir)
      .limit(limit)
      .offset(offset)

    return { receipts, total }
  }

  async voidReceipt(id) {
    const [receipt] = await this.knex('purchase_receipts')
      .where({ id })
      .update({
        voided: true,
        last_updated: this.knex.fn.now()
      })
      .returning('*')

    return receipt
  }

  /**
   * Export purchase orders (completed). One row per line item; order fields repeated.
   * Schema: purchase_orders (po), customers (c) as supplier, purchase_order_items (i), products (p), inventories (inv).
   */
  async exportPurchaseOrder() {
    const rows = await this.knex('purchase_orders as po')
      .select(
        'po.id as order_id',
        'po.receipt_no as receipt_no',
        'po.order_date as order_date',
        'po.invoice_no as invoice_no',
        'po.total_amount as total_amount',
        'po.withhold_percentage as withhold_percentage',
        'po.withhold_amount as withhold_amount',
        'po.amount_paid as amount_paid',
        'po.payment_mode as payment_mode',
        'po.payment_status as payment_status',
        'po.encoder_fullname as encoder_fullname',
        'c.name as supplier_name',
        'c.address as supplier_address',
        'c.phone as supplier_phone',
        'c.contact_person as supplier_contact',
        'c.tin_no as supplier_tin',
        'p.product_code as product_code',
        'p.name as product_name',
        'i.quantity as quantity',
        'i.unit_price as unit_price',
        'i.total_price as total_price',
        'inv.batch_no as batch_number',
        'inv.expiry_date as expiry_date'
      )
      .leftJoin('customers as c', 'po.supplier_id', 'c.id')
      .leftJoin('purchase_order_items as i', 'po.id', 'i.purchase_order_id')
      .leftJoin('products as p', 'i.product_id', 'p.id')
      .leftJoin('inventories as inv', 'i.inventory_id', 'inv.id')
      .where('po.status', 'completed')
    return { export: rows }
  }
}

