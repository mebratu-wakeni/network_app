/**
 * Repository: Data access for sales_orders and sales_order_items.
 * Order creation inserts into both tables, decrements inventory quantities,
 * records ledger entries, and creates bin card transactions.
 */
import { LedgerHelper } from '../../services/ledger.helper.js'
import {
  effectiveWithholdConfirmed,
  rawWithholdEffectivelyConfirmed
} from '../../utils/salesWithhold.js'

export class SalesRepository {
  constructor(knex) {
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  /**
   * Get last product balance for bin card (from bin_cards by product_id).
   */
  async getLastProductBalance(productId, trx = null) {
    const db = trx || this.knex
    const last = await db('bin_cards')
      .where({ product_id: productId })
      .orderBy('transaction_date', 'desc')
      .orderBy('id', 'desc')
      .select('balance')
      .first()
    return last ? parseInt(last.balance, 10) : 0
  }

  /**
   * Generate next sales receipt number (SO000001, SO000002, ...)
   */
  async generateNextSalesReceiptNumber() {
    const hasTable = await this.knex.schema.hasTable('sales_orders')
    if (!hasTable) return 'SO000001'

    const row = await this.knex('sales_orders')
      .where('receipt_no', 'like', 'SO%')
      .orderBy('id', 'desc')
      .select('receipt_no')
      .first()

    if (!row || !row.receipt_no) return 'SO000001'
    const match = row.receipt_no.match(/^SO(\d{6,})$/)
    if (!match) return 'SO000001'
    const next = parseInt(match[1], 10) + 1
    return `SO${String(next).padStart(match[1].length, '0')}`
  }

  /**
   * Create sales order and its items in one transaction; decrement inventory for each item.
   * Payload: { order, items } where order has sales_orders columns, items have product_id, inventory_id, quantity, unit_price (total_price computed).
   */
  async createOrderWithItems(payload, userId = null) {
    return this.knex.transaction(async (trx) => {
      const { order, items } = payload

      // 1) Insert sales_orders — enforce: non-empty withhold_ref ⇒ withhold_confirmation true; else false and no ref.
      const trimmedInv =
        order.withhold_ref != null && String(order.withhold_ref).trim() !== ''
          ? String(order.withhold_ref).trim()
          : null
      const withholdConfirmed = Boolean(trimmedInv)
      const [insertedOrder] = await trx('sales_orders')
        .insert({
          customer_id: order.customer_id ?? null,
          order_date: order.order_date,
          invoice_no: order.invoice_no ?? null,
          remark: order.remark ?? null,
          payment_type: order.payment_type,
          payment_status: order.payment_status,
          total_amount: order.total_amount,
          amount_paid: order.amount_paid ?? 0,
          withhold_percentage: order.withhold_percentage ?? null,
          withhold_amount: order.withhold_amount ?? null,
          received_amount: order.received_amount ?? null,
          withhold_settled: order.withhold_settled ?? false,
          withhold_confirmation: withholdConfirmed,
          withhold_ref: trimmedInv,
          receipt_no: order.receipt_no,
          status: order.status ?? 'completed',
          is_reversed: order.is_reversed ?? false,
          encoder_id: userId ?? null,
          encoder_fullname: order.encoder_fullname ?? null,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now(),
          sync_status: 'pending'
        })
        .returning('*')

      const orderId = insertedOrder.id

      // 2) Insert sales_order_items (each with sales_order_id, product_id, inventory_id, quantity, unit_price, total_price)
      const itemsToInsert = items.map(it => ({
        sales_order_id: orderId,
        product_id: it.product_id,
        inventory_id: it.inventory_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_price,
        created_at: trx.fn.now(),
        last_updated: trx.fn.now(),
        sync_status: 'pending'
      }))

      const insertedItems = await trx('sales_order_items')
        .insert(itemsToInsert)
        .returning('*')

      // 3) Optional initial payment record (sales_payments)
      let paymentRecord = null
      const { initialPayment } = payload
      if (initialPayment && initialPayment.amount > 0) {
        const hasPaymentsTable = await trx.schema.hasTable('sales_payments')
        if (hasPaymentsTable) {
          const [payment] = await trx('sales_payments')
            .insert({
              sales_order_id: orderId,
              payment_date: initialPayment.payment_date,
              amount: initialPayment.amount,
              note: initialPayment.note || null,
              payment_method: initialPayment.payment_method,
              cheque_no: initialPayment.cheque_no || null,
              bank_name: initialPayment.bank_name || null,
              cheque_date: initialPayment.cheque_date || null,
              cleared_date: null,
              created_at: trx.fn.now(),
              last_updated: trx.fn.now(),
              sync_status: 'pending'
            })
            .returning('*')

          paymentRecord = payment
        }
      }

      // 4) Decrement inventory quantity and collect cost for each item
      let totalCoGS = 0
      const itemsWithInv = []
      for (const item of insertedItems) {
        const inv = await trx('inventories')
          .where({ id: item.inventory_id })
          .select('quantity', 'purchase_price', 'batch_no', 'expiry_date', 'product_id')
          .first()
        if (!inv) {
          throw new Error(`Inventory ${item.inventory_id} not found`)
        }
        const currentQty = Number(inv.quantity ?? 0)
        if (currentQty < item.quantity) {
          throw new Error(`Insufficient quantity for inventory ${item.inventory_id}: has ${currentQty}, need ${item.quantity}`)
        }
        await trx('inventories')
          .where({ id: item.inventory_id })
          .update({
            quantity: trx.raw('quantity - ?', [item.quantity]),
            last_updated: trx.fn.now()
          })
        const unitCost = Number(inv.purchase_price ?? 0)
        totalCoGS += unitCost * Number(item.quantity)
        itemsWithInv.push({ ...item, inv })
      }

      // 5) Bin card: one issued transaction per item (quantity_out)
      const orderDate = order.order_date || insertedOrder.order_date
      const txnDate = typeof orderDate === 'string' && orderDate.includes('T') ? orderDate.slice(0, 10) : orderDate
      for (const { inv, quantity, inventory_id, product_id } of itemsWithInv) {
        const openingBalance = await this.getLastProductBalance(product_id, trx)
        const qtyOut = Number(quantity)
        const balance = openingBalance - qtyOut
        const unitCost = Number(inv.purchase_price ?? 0)
        const totalCost = unitCost * qtyOut
        await trx('bin_cards').insert({
          product_id: product_id,
          inventory_id: inventory_id,
          batch_no: inv.batch_no ?? null,
          expiry_date: inv.expiry_date ?? null,
          transaction_date: txnDate,
          transaction_type: 'issued',
          reference_id: orderId,
          reference_table: 'sales_orders',
          document_no: insertedOrder.receipt_no ?? null,
          opening_balance: openingBalance,
          quantity_in: 0,
          quantity_out: qtyOut,
          balance: balance,
          unit_cost: unitCost,
          total_cost: totalCost,
          reason: 'Sales Order',
          notes: insertedOrder.receipt_no ?? null,
          created_by: userId ?? null,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now(),
          sync_status: 'pending'
        })
      }

      // 6) Ledger: DR Cash / AR, CR Revenue (net), CR Withhold Payable; DR COGS, CR Inventory
      const subtotal = Number(order.total_amount ?? 0)
      const withholdAmount = Number(order.withhold_amount ?? 0)
      const firstPayment = Number(order.amount_paid ?? 0)
      // AR = full amount customer owes (subtotal - firstPayment); withhold reduces our revenue, not AR
      const outstandingBalance = Math.max(0, subtotal - firstPayment)

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        await this.ledgerHelper.recordSalesOrder({
          salesOrderId: orderId,
          firstPayment,
          outstandingBalance,
          withholdAmount,
          subtotal,
          totalCoGS,
          transactionDate: txnDate,
          referenceNumber: insertedOrder.receipt_no ?? null,
          memo: order.remark ?? null,
          createdBy: userId
        }, trx)
      }

      return {
        order: insertedOrder,
        items: insertedItems
      }
    })
  }

  /**
   * Get withhold percentage from system_settings (same key as purchase).
   */
  async getWithholdPercentageSetting() {
    const hasTable = await this.knex.schema.hasTable('system_settings')
    if (!hasTable) return null
    const row = await this.knex('system_settings')
      .where({ setting_key: 'withhold_percentage' })
      .first()
    if (!row || row.setting_value == null || row.setting_value === '') return null
    const num = parseFloat(row.setting_value)
    return Number.isFinite(num) ? num : null
  }

  /**
   * List sales orders with filters, pagination, and stats.
   * net_amount = total_amount - withhold_amount; outstanding = net - amount_paid.
   * Stats are static (no list filters). 'all' excludes reversed and archived.
   */
  async listOrders(params = {}) {
    const hasOrders = await this.knex.schema.hasTable('sales_orders')
    if (!hasOrders) return { orders: [], total: 0, stats: {} }

    const {
      limit = 20,
      offset = 0,
      search,
      status,
      customer_id,
      payment_type,
      date_from,
      date_to,
      has_outstanding_balance,
      stat_filter,
      sort_by = 'order_date',
      order_by = 'desc'
    } = params

    const base = this.knex('sales_orders as so')
      .leftJoin('customers as c', 'so.customer_id', 'c.id')

    base.where(builder => {
      builder.whereIn('so.status', ['pending', 'completed', 'archived'])
    })

    // Status filter: reversed = is_reversed; completed = status completed and not reversed; archived = status archived
    if (status === 'reversed') {
      base.andWhere('so.is_reversed', true)
    } else if (status === 'completed') {
      base.andWhere('so.status', 'completed').andWhere('so.is_reversed', false)
    } else if (status === 'archived') {
      base.andWhere('so.status', 'archived')
    } else if (status) {
      base.andWhere('so.status', status)
    }

    if (customer_id) base.andWhere('so.customer_id', customer_id)
    if (payment_type) base.andWhere('so.payment_type', payment_type)
    if (date_from) base.andWhere('so.order_date', '>=', date_from)
    if (date_to) base.andWhere('so.order_date', '<=', date_to)
    if (search) {
      const term = `%${search}%`
      base.andWhere(builder => {
        builder.whereILike('so.receipt_no', term).orWhereILike('c.name', term)
      })
    }

    // Stat filter: apply to list query when user clicks a stat
    if (stat_filter === 'outstanding' || has_outstanding_balance === true || has_outstanding_balance === 'true') {
      base.andWhereRaw('(coalesce(so.total_amount,0) - coalesce(so.withhold_amount,0) - coalesce(so.amount_paid,0)) > 0.009')
    } else if (has_outstanding_balance === false || has_outstanding_balance === 'false') {
      base.andWhereRaw('(coalesce(so.total_amount,0) - coalesce(so.withhold_amount,0) - coalesce(so.amount_paid,0)) <= 0.009')
    }
    if (stat_filter === 'withhold_unconfirmed') {
      base.andWhere('so.withhold_amount', '>', 0.009)
      base.andWhere('so.withhold_settled', false)
      base.whereNot(rawWithholdEffectivelyConfirmed(this.knex, 'so'))
    } else if (stat_filter === 'withhold_confirmed') {
      base.andWhere('so.withhold_amount', '>', 0.009)
      base.andWhere(rawWithholdEffectivelyConfirmed(this.knex, 'so'))
      base.andWhere('so.withhold_settled', false)
    } else if (stat_filter === 'settled') {
      base.andWhere('so.withhold_amount', '>', 0.009)
      base.andWhere(rawWithholdEffectivelyConfirmed(this.knex, 'so'))
      base.andWhere('so.withhold_settled', true)
    } else if (stat_filter === 'unsettled') {
      base.andWhere('so.withhold_amount', '>', 0.009)
      base.andWhere('so.withhold_settled', false)
    }

    const netRaw = this.knex.raw('(coalesce(so.total_amount,0) - coalesce(so.withhold_amount,0)) as net_amount')
    const outstandingRaw = this.knex.raw('(coalesce(so.total_amount,0) - coalesce(so.withhold_amount,0) - coalesce(so.amount_paid,0)) as outstanding_balance')

    base.select(
      'so.id',
      'so.receipt_no',
      'c.name as customer_name',
      'so.order_date',
      'so.total_amount',
      'so.withhold_amount',
      'so.amount_paid',
      'so.payment_type',
      'so.status',
      'so.is_reversed',
      'so.withhold_confirmation',
      'so.withhold_settled',
      'so.withhold_ref',
      'so.remark',
      netRaw,
      outstandingRaw
    )

    const totalResult = await base.clone().clearSelect().clearOrder().count('so.id as count').first()
    const total = Number(totalResult?.count || 0)

    let periodSummary = null
    if (date_from && date_to) {
      const periodRow = await this.knex('sales_orders as so')
        .where('so.status', 'completed')
        .where('so.is_reversed', false)
        .where('so.order_date', '>=', date_from)
        .where('so.order_date', '<=', date_to)
        .select(this.knex.raw('COUNT(*) as count, COALESCE(SUM(coalesce(so.total_amount,0) - coalesce(so.withhold_amount,0)), 0) as value'))
        .first()
      periodSummary = {
        count: Number(periodRow?.count ?? 0),
        value: parseFloat(periodRow?.value ?? 0)
      }
    }

    const allowedSort = ['order_date', 'id', 'receipt_no', 'net_amount', 'customer_name']
    const sortCol = allowedSort.includes(sort_by) ? sort_by : 'order_date'
    const sortDir = order_by === 'asc' ? 'asc' : 'desc'

    let orders = await base.orderBy(sortCol, sortDir).limit(limit).offset(offset)
    orders = orders.map((row) => ({
      ...row,
      withhold_confirmation: effectiveWithholdConfirmed(row)
    }))

    // Stats: static (no list filters). All = completed, non-reversed only.
    const statsBase = this.knex('sales_orders as so')
      .whereIn('so.status', ['pending', 'completed', 'archived'])

    const statsRows = await statsBase.select(
      'so.payment_type',
      'so.status',
      'so.is_reversed',
      'so.withhold_confirmation',
      'so.withhold_settled',
      'so.withhold_ref',
      'so.remark',
      this.knex.raw('(coalesce(so.total_amount,0) - coalesce(so.withhold_amount,0)) as net_amount'),
      'so.amount_paid',
      'so.withhold_amount'
    )

    const stats = {
      all: { count: 0, value: 0 },
      withhold_unconfirmed: { count: 0, value: 0 },
      withhold_confirmed: { count: 0, value: 0 },
      settled: { count: 0, value: 0 },
      unsettled: { count: 0, value: 0 },
      outstanding: { count: 0, value: 0 }
    }

    for (const row of statsRows) {
      const net = Number(row.net_amount || 0)
      const paid = Number(row.amount_paid || 0)
      const withhold = Number(row.withhold_amount || 0)
      const outstanding = net - paid
      const isReversed = !!row.is_reversed
      const isArchived = row.status === 'archived'
      const isCompleted = row.status === 'completed'
      const confirmed = effectiveWithholdConfirmed(row)
      const settled = !!row.withhold_settled

      // All: completed, non-reversed (exclude reversed and archived)
      if (isCompleted && !isReversed) {
        stats.all.count += 1
        stats.all.value += net
      }

      if (withhold > 0.009) {
        if (!confirmed && !settled) {
          stats.withhold_unconfirmed.count += 1
          stats.withhold_unconfirmed.value += withhold
        }
        if (confirmed && !settled) {
          stats.withhold_confirmed.count += 1
          stats.withhold_confirmed.value += withhold
        }
        if (confirmed && settled) {
          stats.settled.count += 1
          stats.settled.value += withhold
        }
        if (!settled) {
          stats.unsettled.count += 1
          stats.unsettled.value += withhold
        }
      }

      if (outstanding > 0.009) {
        stats.outstanding.count += 1
        stats.outstanding.value += outstanding
      }
    }

    return { orders, total, stats, period_summary: periodSummary }
  }

  /**
   * Create hold order (snapshot + index columns).
   */
  async createHoldOrder(snapshot, indexColumns, userId = null) {
    const hasTable = await this.knex.schema.hasTable('sales_hold_orders')
    if (!hasTable) throw new Error('sales_hold_orders table not found')

    const payload = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot
    const [row] = await this.knex('sales_hold_orders')
      .insert({
        snapshot: payload,
        customer_id: indexColumns.customer_id ?? null,
        order_date: indexColumns.order_date,
        total_amount: indexColumns.total_amount ?? 0,
        payment_type: indexColumns.payment_type ?? 'cash',
        is_archive: false,
        encoder_id: userId ?? null,
        encoder_fullname: indexColumns.encoder_fullname ?? null,
        created_at: this.knex.fn.now(),
        last_updated: this.knex.fn.now()
      })
      .returning('*')
    return row
  }

  /**
   * List hold orders with filters.
   */
  async listHoldOrders(params = {}) {
    const hasTable = await this.knex.schema.hasTable('sales_hold_orders')
    if (!hasTable) return { hold_orders: [], total: 0 }

    const { limit = 20, offset = 0, search, filter, sort_by = 'created_at', order_by = 'desc' } = params
    const q = this.knex('sales_hold_orders as ho').leftJoin('customers as c', 'ho.customer_id', 'c.id')

    // Apply filter first - ensure filter is a string and matches exactly (case-insensitive)
    const filterValue = typeof filter === 'string' ? filter.trim().toLowerCase() : (filter ? String(filter).toLowerCase() : null)
    if (filterValue === 'active') {
      q.where('ho.is_archive', false)
    } else if (filterValue === 'archived') {
      q.where('ho.is_archive', true)
    }
    // filter === 'all' or undefined or null: no is_archive filter

    // Then apply search if provided
    const searchTrimmed = typeof search === 'string' ? search.trim() : ''
    if (searchTrimmed) {
      const term = `%${searchTrimmed}%`
      q.andWhere(builder => {
        builder.whereILike('c.name', term)
      })
    }

    const totalRow = await q.clone().clearSelect().clearOrder().countDistinct({ count: 'ho.id' }).first()
    const total = Number(totalRow?.count || 0)

    const sortColMap = {
      created_at: 'ho.created_at',
      order_date: 'ho.order_date',
      sale_date: 'ho.order_date',
      customer_name: 'c.name',
      total_amount: 'ho.total_amount',
      id: 'ho.id'
    }
    const sortCol = sortColMap[sort_by] || 'ho.created_at'
    const sortDir = order_by === 'asc' ? 'asc' : 'desc'

    const hold_orders = await q
      .select('ho.id', 'ho.customer_id', 'ho.order_date', 'ho.total_amount', 'ho.payment_type', 'ho.is_archive', 'ho.encoder_fullname', 'ho.created_at', 'ho.snapshot', 'c.name as customer_name')
      .orderBy(sortCol, sortDir)
      .limit(limit)
      .offset(offset)

    // Add items_count by parsing snapshot.items
    const hold_orders_with_count = hold_orders.map(h => {
      let itemsCount = 0
      try {
        const snapshot = typeof h.snapshot === 'string' ? JSON.parse(h.snapshot) : (h.snapshot || {})
        const items = snapshot.items || []
        itemsCount = Array.isArray(items) ? items.length : 0
      } catch (e) {
        // ignore parse errors
      }
      const { snapshot, ...rest } = h
      return { ...rest, items_count: itemsCount, net_amount: Number(h.total_amount || 0) }
    })

    return { hold_orders: hold_orders_with_count, total }
  }

  /**
   * Get one hold order by ID (full snapshot for restore).
   * Joins with customers to get customer_name for UI display.
   */
  async getHoldOrderById(holdOrderId) {
    const hasTable = await this.knex.schema.hasTable('sales_hold_orders')
    if (!hasTable) return null
    const row = await this.knex('sales_hold_orders as ho')
      .leftJoin('customers as c', 'ho.customer_id', 'c.id')
      .where('ho.id', holdOrderId)
      .select('ho.*', 'c.name as customer_name')
      .first()
    if (!row) return null
    const snapshot = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot
    return { ...row, snapshot, customer_name: row.customer_name || null }
  }

  /**
   * Archive hold order (set is_archive = true).
   */
  async archiveHoldOrder(holdOrderId) {
    const hasTable = await this.knex.schema.hasTable('sales_hold_orders')
    if (!hasTable) return false
    const n = await this.knex('sales_hold_orders').where('id', holdOrderId).update({ is_archive: true, last_updated: this.knex.fn.now() })
    return n > 0
  }

  /**
   * Completed, non-reversed sales for one customer with net outstanding &gt; 0 (same basis as trade receivables).
   */
  async queryOutstandingSalesForCustomer(knexOrTrx, customerId) {
    const cid = Number(customerId)
    if (!Number.isFinite(cid) || cid <= 0) return []

    const spSub = knexOrTrx('sales_payments')
      .select('sales_order_id')
      .sum({ total_paid: 'amount' })
      .groupBy('sales_order_id')
      .as('sp')

    const rows = await knexOrTrx('sales_orders as so')
      .leftJoin(spSub, 'so.id', 'sp.sales_order_id')
      .where('so.customer_id', cid)
      .where('so.status', 'completed')
      .where('so.is_reversed', false)
      .select(
        'so.id',
        'so.receipt_no',
        'so.order_date',
        'so.total_amount',
        'so.withhold_amount',
        knexOrTrx.raw('coalesce(sp.total_paid, 0) as total_paid')
      )

    const orders = []
    for (const row of rows) {
      const net = Number(row.total_amount || 0) - Number(row.withhold_amount || 0)
      const paid = Number(row.total_paid || 0)
      const outstanding = Math.max(0, net - paid)
      if (outstanding > 0.01) {
        orders.push({
          id: row.id,
          receipt_no: row.receipt_no,
          order_date: row.order_date,
          net_amount: net,
          amount_paid: paid,
          outstanding_balance: outstanding
        })
      }
    }
    return orders
  }

  async getCustomerOutstandingForPayment(customerId) {
    const hasSales = await this.knex.schema.hasTable('sales_orders')
    if (!hasSales) return { orders: [], total_outstanding: 0 }
    const orders = await this.queryOutstandingSalesForCustomer(this.knex, customerId)
    const total_outstanding = orders.reduce((s, o) => s + o.outstanding_balance, 0)
    return { orders, total_outstanding }
  }

  /**
   * Apply one payment slice to a sales order inside an existing transaction.
   */
  async recordPaymentInTrx(trx, orderId, paymentData, userId = null) {
    const amount = Number(paymentData.amount)
    const order = await trx('sales_orders').where({ id: orderId }).first()
    if (!order) {
      const err = new Error('Sales order not found')
      err.status = 404
      throw err
    }
    if (order.is_reversed) {
      const err = new Error('Cannot pay a reversed order')
      err.status = 400
      throw err
    }
    const totalAmount = Number(order.total_amount || 0)
    const withholdAmount = Number(order.withhold_amount || 0)
    const netAmount = totalAmount - withholdAmount

    const hasPaymentsTable = await trx.schema.hasTable('sales_payments')
    let alreadyPaid = 0
    if (hasPaymentsTable) {
      const paymentsAgg = await trx('sales_payments')
        .where('sales_order_id', orderId)
        .sum({ total_paid: 'amount' })
        .first()
      alreadyPaid = Number(paymentsAgg?.total_paid || 0)
    } else {
      alreadyPaid = Number(order.amount_paid || 0)
    }
    const newPaid = alreadyPaid + amount

    if (newPaid > netAmount + 0.01) {
      const err = new Error('Payment would exceed amount due')
      err.status = 400
      throw err
    }
    if (amount <= 0) {
      const err = new Error('Payment amount must be greater than zero')
      err.status = 400
      throw err
    }
    let payment_status = 'unpaid'
    if (newPaid >= netAmount - 0.009) payment_status = 'paid'
    else if (newPaid > 0) payment_status = 'partial'

    const paymentDate = paymentData.payment_date || new Date().toISOString().split('T')[0]
    let paymentId = orderId

    if (hasPaymentsTable) {
      const [payment] = await trx('sales_payments')
        .insert({
          sales_order_id: orderId,
          payment_date: paymentDate,
          amount,
          payment_method: paymentData.payment_method || 'cash',
          note: paymentData.note || null,
          cheque_no: paymentData.cheque_no || null,
          bank_name: paymentData.bank_name || null,
          cheque_date: paymentData.cheque_date || null,
          last_updated: trx.fn.now(),
          sync_status: 'pending',
        })
        .returning('*')
      if (payment && payment.id) paymentId = payment.id
    }

    await trx('sales_orders')
      .where({ id: orderId })
      .update({
        amount_paid: newPaid,
        payment_status,
        last_updated: trx.fn.now()
      })

    const hasLedger = await trx.schema.hasTable('account_ledger')
    if (hasLedger) {
      await this.ledgerHelper.recordSalesPayment({
        salesOrderId: orderId,
        paymentId,
        amount,
        paymentMethod: paymentData.payment_method || 'cash',
        transactionDate: paymentDate,
        referenceNumber: order.receipt_no || null,
        memo: paymentData.note || null,
        createdBy: userId
      }, trx)
    }

    return {
      amount_paid: newPaid,
      payment_status,
      outstanding_balance: Math.max(0, netAmount - newPaid)
    }
  }

  /**
   * Record payment on a sales order. Updates amount_paid to the sum total of all payments (from sales_payments when table exists).
   * Inserts into sales_payments when table exists; posts ledger entry (DR Cash, CR AR) when account_ledger exists.
   */
  async recordPayment(orderId, paymentData, userId = null) {
    return this.knex.transaction(async (trx) => {
      return this.recordPaymentInTrx(trx, orderId, paymentData, userId)
    })
  }

  /**
   * Apply one customer payment across multiple orders (FIFO / LIFO / manual). Single DB transaction.
   */
  async recordBulkCustomerPayment({
    customerId,
    paymentAmount,
    allocation,
    manualAllocations,
    paymentPayload,
    userId = null
  }) {
    const totalPay = Number(paymentAmount)
    if (!Number.isFinite(totalPay) || totalPay <= 0) {
      const err = new Error('Payment amount must be greater than zero')
      err.status = 400
      throw err
    }

    const paymentDate =
      paymentPayload.payment_date || new Date().toISOString().split('T')[0]
    const payment_method = paymentPayload.payment_mode || 'cash'
    const note = paymentPayload.notes || null
    const cheque = paymentPayload.cheque_details || {}
    const bank_name = cheque.bank_name || null
    const cheque_no = cheque.cheque_number || cheque.cheque_no || null
    const cheque_date = cheque.cheque_date || null

    const baseSlice = {
      payment_date: paymentDate,
      payment_method,
      note,
      bank_name,
      cheque_no,
      cheque_date
    }

    return this.knex.transaction(async (trx) => {
      const rows = await this.queryOutstandingSalesForCustomer(trx, customerId)
      if (rows.length === 0) {
        const err = new Error('No outstanding orders for this customer')
        err.status = 400
        throw err
      }

      const totalOutstanding = rows.reduce((s, r) => s + r.outstanding_balance, 0)
      if (totalPay > totalOutstanding + 0.02) {
        const err = new Error('Payment amount exceeds total outstanding for this customer')
        err.status = 400
        throw err
      }

      const applied = []

      if (allocation === 'manual') {
        const list = manualAllocations || []
        const sumManual = list.reduce((s, m) => s + Number(m.amount || 0), 0)
        if (Math.abs(sumManual - totalPay) > 0.02) {
          const err = new Error('Manual allocations must sum to the payment amount')
          err.status = 400
          throw err
        }
        const byId = new Map(rows.map((r) => [r.id, r]))
        for (const m of list) {
          const oid = Number(m.sales_order_id)
          const slice = Number(m.amount)
          if (slice <= 0.009) continue
          const row = byId.get(oid)
          if (!row) {
            const err = new Error(`Order ${oid} is not outstanding for this customer`)
            err.status = 400
            throw err
          }
          if (slice > row.outstanding_balance + 0.02) {
            const err = new Error(`Amount for order ${row.receipt_no || oid} exceeds outstanding balance`)
            err.status = 400
            throw err
          }
          await this.recordPaymentInTrx(trx, oid, { ...baseSlice, amount: slice }, userId)
          applied.push({
            sales_order_id: oid,
            receipt_no: row.receipt_no,
            amount: slice
          })
        }
      } else {
        let remaining = totalPay
        let ordered = [...rows]
        if (allocation === 'fifo') {
          ordered.sort((a, b) => {
            const cmp = String(a.order_date || '').localeCompare(String(b.order_date || ''))
            if (cmp !== 0) return cmp
            return a.id - b.id
          })
        } else {
          ordered.sort((a, b) => {
            const cmp = String(b.order_date || '').localeCompare(String(a.order_date || ''))
            if (cmp !== 0) return cmp
            return b.id - a.id
          })
        }

        for (const row of ordered) {
          if (remaining <= 0.009) break
          const slice = Math.min(remaining, row.outstanding_balance)
          if (slice <= 0.009) continue
          await this.recordPaymentInTrx(trx, row.id, { ...baseSlice, amount: slice }, userId)
          applied.push({
            sales_order_id: row.id,
            receipt_no: row.receipt_no,
            amount: slice
          })
          remaining -= slice
        }
        if (remaining > 0.02) {
          const err = new Error('Could not allocate full payment (data changed during transaction)')
          err.status = 409
          throw err
        }
      }

      return {
        total_applied: totalPay,
        applied
      }
    })
  }

  /**
   * Confirm withhold: set withhold_ref and withhold_confirmation = true.
   */
  async confirmWithhold(orderId, withholdRef) {
    const n = await this.knex('sales_orders')
      .where({ id: orderId })
      .whereNot({ is_reversed: true })
      .update({
        withhold_ref: withholdRef || null,
        withhold_confirmation: true,
        last_updated: this.knex.fn.now()
      })
    return n > 0
  }

  /**
   * Rollback withhold: clear withhold_ref and withhold_confirmation.
   */
  async rollbackWithhold(orderId) {
    const order = await this.knex('sales_orders').where({ id: orderId }).first()
    if (!order) return false

    let newRemark = order.remark
    if (newRemark && typeof newRemark === 'string') {
      newRemark = newRemark.replace(/\n?Withhold Ref:\s*[^\n]*/gi, '').trim()
      if (newRemark === '') newRemark = null
    }

    const n = await this.knex('sales_orders')
      .where({ id: orderId })
      .whereNot({ is_reversed: true })
      .update({
        withhold_ref: null,
        withhold_confirmation: false,
        withhold_settled: false,
        remark: newRemark,
        last_updated: this.knex.fn.now()
      })
    return n > 0
  }

  /**
   * Reverse sales order: restore inventory quantities, reverse ledger entries, bin card return entries, set is_reversed = true.
   */
  async reverseOrder(orderId, userId = null) {
    return this.knex.transaction(async (trx) => {
      const order = await trx('sales_orders').where({ id: orderId }).first()
      if (!order) {
        const err = new Error('Sales order not found')
        err.status = 404
        throw err
      }
      if (order.is_reversed) {
        const err = new Error('Order is already reversed')
        err.status = 400
        throw err
      }

      const items = await trx('sales_order_items').where('sales_order_id', orderId)
      const reversalDate = new Date().toISOString().split('T')[0]

      // 1) Restore inventory quantities
      for (const item of items) {
        await trx('inventories')
          .where({ id: item.inventory_id })
          .update({
            quantity: trx.raw('quantity + ?', [item.quantity]),
            last_updated: trx.fn.now()
          })
      }

      // 2) Bin card: return (quantity_in) for each item
      const hasBinCards = await trx.schema.hasTable('bin_cards')
      if (hasBinCards) {
        for (const item of items) {
          const inv = await trx('inventories').where({ id: item.inventory_id }).select('batch_no', 'expiry_date', 'purchase_price', 'product_id').first()
          if (!inv) continue
          const openingBalance = await this.getLastProductBalance(item.product_id, trx)
          const qtyIn = Number(item.quantity)
          const balance = openingBalance + qtyIn
          const unitCost = Number(inv.purchase_price ?? 0)
          const totalCost = unitCost * qtyIn
          await trx('bin_cards').insert({
            product_id: item.product_id,
            inventory_id: item.inventory_id,
            batch_no: inv.batch_no ?? null,
            expiry_date: inv.expiry_date ?? null,
            transaction_date: reversalDate,
            transaction_type: 'return',
            reference_id: orderId,
            reference_table: 'sales_orders',
            document_no: order.receipt_no ? `REV-${order.receipt_no}` : null,
            opening_balance: openingBalance,
            quantity_in: qtyIn,
            quantity_out: 0,
            balance: balance,
            unit_cost: unitCost,
            total_cost: totalCost,
            reason: `REVERSAL: Sales Order ${order.receipt_no || orderId}`,
            notes: 'Order reversal',
            created_by: userId ?? null,
            created_at: trx.fn.now(),
            last_updated: trx.fn.now(),
            sync_status: 'pending'
          })
        }
      }

      // 3) Reverse ledger entries
      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        await this.ledgerHelper.reverseSalesOrder({
          salesOrderId: orderId,
          transactionDate: reversalDate,
          reason: 'Order reversal',
          referenceNumber: order.receipt_no ? `REV-${order.receipt_no}` : null,
          createdBy: userId
        }, trx)
      }

      await trx('sales_orders')
        .where({ id: orderId })
        .update({
          is_reversed: true,
          status: 'archived',
          last_updated: trx.fn.now()
        })

      return { order_id: orderId, status: 'reversed' }
    })
  }

  /**
   * Get sales order by ID with customer and items.
   */
  async getOrderById(orderId) {
    const hasOrders = await this.knex.schema.hasTable('sales_orders')
    if (!hasOrders) return null

    const order = await this.knex('sales_orders as so')
      .leftJoin('customers as c', 'so.customer_id', 'c.id')
      .where('so.id', orderId)
      .select('so.*', 'c.name as customer_name')
      .first()

    if (!order) return null

    const hasItems = await this.knex.schema.hasTable('sales_order_items')
    const items = hasItems
      ? await this.knex('sales_order_items as i')
          .leftJoin('products as p', 'i.product_id', 'p.id')
          .leftJoin('inventories as inv', 'i.inventory_id', 'inv.id')
          .where('i.sales_order_id', orderId)
          .select(
            'i.*',
            'p.product_code',
            'p.name as product_name',
            'inv.batch_no as batch_number',
            'inv.expiry_date'
          )
      : []

    const totalAmount = Number(order.total_amount ?? 0)
    const withholdAmount = Number(order.withhold_amount ?? 0)
    const amountPaid = Number(order.amount_paid ?? 0)
    const receivedAmount = totalAmount - withholdAmount
    const outstanding_balance = Math.max(0, receivedAmount - amountPaid)
    const withhold_confirmation = effectiveWithholdConfirmed(order)

    return {
      order: {
        ...order,
        customer_name: order.customer_name ?? null,
        outstanding_balance,
        withhold_confirmation
      },
      items
    }
  }

  /**
   * Get receipt for a sales order (built from order + items + customer).
   * Returns same shape as purchase receipt: receipt_no, order_meta, order_items, order_payment, encoder_fullname.
   */
  async getReceiptByOrderId(orderId) {
    const hasOrders = await this.knex.schema.hasTable('sales_orders')
    if (!hasOrders) return null

    const order = await this.knex('sales_orders as so')
      .leftJoin('customers as c', 'so.customer_id', 'c.id')
      .where('so.id', orderId)
      .select(
        'so.id',
        'so.receipt_no',
        'so.invoice_no',
        'so.order_date',
        'so.total_amount',
        'so.withhold_percentage',
        'so.withhold_amount',
        'so.amount_paid',
        'so.payment_type',
        'so.payment_status',
        'so.encoder_fullname',
        'so.customer_id',
        'so.remark',
        'so.withhold_ref',
        'so.withhold_confirmation',
        'c.name as customer_name',
        'c.address as customer_address',
        'c.phone as customer_phone',
        'c.contact_person as customer_contact',
        'c.email as customer_email',
        'c.tin_no as customer_tin'
      )
      .first()

    if (!order) return null

    const hasItems = await this.knex.schema.hasTable('sales_order_items')
    const items = hasItems
      ? await this.knex('sales_order_items as i')
          .leftJoin('products as p', 'i.product_id', 'p.id')
          .leftJoin('inventories as inv', 'i.inventory_id', 'inv.id')
          .where('i.sales_order_id', orderId)
          .select(
            'i.product_id',
            'i.quantity',
            'i.unit_price',
            'i.total_price',
            'p.product_code',
            'p.name as product_name',
            'inv.batch_no as batch_number',
            'inv.expiry_date'
          )
      : []

    const subtotal = Number(order.total_amount ?? 0)
    const withholdAmount = Number(order.withhold_amount ?? 0)
    const netAmount = subtotal - withholdAmount
    const amountPaid = Number(order.amount_paid ?? 0)
    const remainingBalance = Math.max(0, netAmount - amountPaid)

    // Extract withhold_reference from remark if present
    let withhold_reference = null;
    if (order.remark) {
      const match = order.remark.match(/Withhold Ref:\s*(.+?)(?:\n|$)/i);
      if (match) {
        withhold_reference = match[1].trim();
      }
    }

    const order_meta = {
      order_date: order.order_date,
      payment_type: order.payment_type,
      payment_status: order.payment_status,
      customer_id: order.customer_id,
      customer_name: order.customer_name || 'Walk-in',
      customer_address: order.customer_address || null,
      customer_phone: order.customer_phone || null,
      customer_contact: order.customer_contact || null,
      customer_email: order.customer_email || null,
      customer_tin: order.customer_tin || null,
      subtotal,
      withhold_percentage: order.withhold_percentage != null ? Number(order.withhold_percentage) : null,
      withhold_amount: withholdAmount,
      net_amount: netAmount,
      invoice_no: order.invoice_no || null,
      withhold_reference: withhold_reference,
      withhold_ref: order.withhold_ref || null,
      withhold_confirmation: effectiveWithholdConfirmed(order),
    }

    const order_items = items.map((it) => ({
      product_id: it.product_id,
      product_code: it.product_code || '',
      product_name: it.product_name || `Product #${it.product_id}`,
      quantity: it.quantity,
      unit_price: Number(it.unit_price),
      total_price: Number(it.total_price),
      batch_number: it.batch_number || null,
      expiry_date: it.expiry_date || null,
    }))

    const order_payment = {
      initial_payment_amount: amountPaid,
      remaining_balance: remainingBalance,
    }

    return {
      receipt_no: order.receipt_no,
      order_meta,
      order_items,
      order_payment,
      encoder_fullname: order.encoder_fullname || null,
    }
  }

  /**
   * Export sales order (completed, non-reversed). One row per line item; order fields repeated.
   * Schema ref: sales_orders (so), customers (c), sales_order_items (i), products (p), inventories (inv).
   * sales_orders has no voided column; use is_reversed for exclusions.
   */
  async exportSalesOrder() {
    const rows = await this.knex('sales_orders as so')
      .select('so.id as order_id', 'so.receipt_no as receipt_no', 'so.order_date as order_date',
        'so.invoice_no as invoice_no', 'so.total_amount as total_amount',
        'so.withhold_percentage as withhold_percentage', 'so.withhold_amount as withhold_amount',
        'so.amount_paid as amount_paid', 'so.payment_type as payment_type',
        'so.payment_status as payment_status', 'so.encoder_fullname as encoder_fullname',
        'c.name as customer_name', 'c.address as customer_address', 'c.phone as customer_phone',
        'c.contact_person as customer_contact', 'c.tin_no as customer_tin',
        'p.product_code as product_code', 'p.name as product_name', 'i.quantity as quantity',
        'i.unit_price as unit_price', 'i.total_price as total_price', 'inv.batch_no as batch_number',
        'inv.expiry_date as expiry_date'
      )
      .leftJoin('customers as c', 'so.customer_id', 'c.id')
      .leftJoin('sales_order_items as i', 'so.id', 'i.sales_order_id')
      .leftJoin('products as p', 'i.product_id', 'p.id')
      .leftJoin('inventories as inv', 'i.inventory_id', 'inv.id')
      .where('so.status', 'completed')
      .where('so.is_reversed', false)
    return { export: rows }
  }
}
