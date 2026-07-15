/**
 * Controller: HTTP layer for purchases
 * Handles request/response and delegates to PurchaseService.
 */
export class PurchaseController {
  constructor(service) {
    this.service = service
  }

  getProducts = async (req, res, next) => {
    try {
      const { search, limit } = req.query
      const products = await this.service.getProducts(req.tenantId, {
        search: search || undefined,
        limit: limit ? parseInt(limit, 10) : undefined
      })
      res.json({ ok: true, products })
    } catch (err) {
      next(err)
    }
  }

  getSuppliers = async (req, res, next) => {
    try {
      const { search, limit } = req.query
      const suppliers = await this.service.getSuppliers(req.tenantId, {
        search: search || undefined,
        limit: limit ? parseInt(limit, 10) : undefined
      })
      res.json({ ok: true, suppliers })
    } catch (err) {
      next(err)
    }
  }

  getWithholdPercentage = async (req, res, next) => {
    try {
      const result = await this.service.getWithholdPercentage(req.tenantId)
      res.json({
        ok: true,
        withhold_percentage: result.withhold_percentage,
        setting_name: result.setting_name
      })
    } catch (err) {
      next(err)
    }
  }

  createOrder = async (req, res, next) => {
    try {
      const body = req.validBody || req.body
      const user = req.user || null
      const order = await this.service.createOrder(body, user, req.tenantId)
      res.status(201).json({ ok: true, purchase_order: order })
    } catch (err) {
      next(err)
    }
  }

  listOrders = async (req, res, next) => {
    try {
      const {
        limit, offset, search, status, supplier_id, payment_mode,
        date_from, date_to, has_outstanding_balance, sort_by, order_by
      } = req.query

      const result = await this.service.listOrders(req.tenantId, {
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
        search: search || undefined,
        status: status || undefined,
        supplier_id: supplier_id ? parseInt(supplier_id, 10) : undefined,
        payment_mode: payment_mode || undefined,
        date_from: date_from || undefined,
        date_to: date_to || undefined,
        has_outstanding_balance,
        sort_by: sort_by || undefined,
        order_by: order_by || undefined
      })

      const orders = result.orders.map(o => ({
        id: o.id,
        receipt_number: o.receipt_no,
        supplier_name: o.supplier_name,
        order_date: o.order_date,
        net_amount: Number(o.net_amount || 0),
        payment_mode: o.payment_mode,
        status: o.status,
        outstanding_balance: Number(o.outstanding_balance || 0)
      }))

      res.json({ ok: true, orders, total: result.total, stats: result.stats })
    } catch (err) {
      next(err)
    }
  }

  getOrderDetails = async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10)
      const full = await this.service.getOrderDetails(req.tenantId, id)
      const order = {
        id: full.order.id,
        receipt_number: full.order.receipt_no,
        supplier_id: full.order.supplier_id,
        supplier_name: full.order.supplier_name,
        order_date: full.order.order_date,
        items: full.items.map(it => ({
          id: it.id,
          product_id: it.product_id,
          product_code: it.product_code,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.total_price,
          batch_number: null,
          expiry_date: null
        })),
        subtotal: full.order.subtotal,
        withhold_percentage: full.order.withhold_percentage,
        withhold_amount: full.order.withhold_amount,
        net_amount: full.order.net_amount,
        payment_mode: full.order.payment_mode,
        cheque_details: null,
        status: full.order.status,
        notes: full.order.remark,
        created_by: full.order.encoder_id,
        created_at: full.order.created_at,
        payments: full.payments.map(p => ({
          id: p.id,
          payment_amount: p.amount,
          payment_mode: p.payment_method,
          payment_date: p.payment_date,
          cheque_details: p.payment_method === 'cheque'
            ? { bank_name: p.bank_name, cheque_number: p.cheque_no, cheque_date: p.cheque_date }
            : null,
          remaining_balance_after: null,
          created_at: p.created_at
        })),
        total_paid: full.order.total_paid,
        outstanding_balance: full.order.outstanding_balance
      }
      res.json({ ok: true, order })
    } catch (err) {
      next(err)
    }
  }

  getOrderReceipt = async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10)
      const receipt = await this.service.getOrderReceipt(req.tenantId, id)
      res.json({ ok: true, receipt })
    } catch (err) {
      next(err)
    }
  }

  payOrder = async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10)
      const body = req.validBody || req.body
      const user = req.user || null
      const result = await this.service.payOrder(req.tenantId, id, body, user)
      res.json({
        ok: true,
        payment: {
          id: result.id,
          purchase_order_id: result.purchase_order_id,
          payment_amount: result.payment_amount,
          remaining_balance: result.remaining_balance,
          payment_date: body.payment_date
        }
      })
    } catch (err) {
      next(err)
    }
  }

  reverseOrder = async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10)
      const body = req.validBody || req.body
      const user = req.user || null
      const result = await this.service.reverseOrder(req.tenantId, id, body, user)
      res.json({
        ok: true,
        reversed_order: {
          id: result.order_id,
          status: result.status,
          reversal_date: result.reversal_date
        }
      })
    } catch (err) {
      next(err)
    }
  }

  bulkImport = async (req, res, next) => {
    try {
      const body = req.validBody || req.body
      const user = req.user || null
      const result = await this.service.bulkImport(req.tenantId, body, user)
      res.json({
        ok: true,
        success: result.summary.failed === 0,
        summary: {
          total: result.summary.total,
          successful: result.summary.successful,
          failed: result.summary.failed
        },
        results: result.successful.map(r => ({
          success: true,
          index: r.index,
          purchase_order_id: r.purchase_order_id,
          receipt_no: r.receipt_no,
          inventory_id: r.inventory_id
        })).concat(
          result.failed.map(r => ({ success: false, index: r.index, error: r.error }))
        )
      })
    } catch (err) {
      next(err)
    }
  }

  importFromSpreadsheet = async (req, res, next) => {
    try {
      const body = req.validBody || req.body
      const user = req.user || null
      const result = await this.service.importFromSpreadsheet(body, user, req.tenantId)
      res.json({
        ok: true,
        success: result.summary.failed === 0,
        summary: result.summary,
        successful: result.successful.map(r => ({
          index: r.index,
          purchase_order_id: r.purchase_order_id,
          receipt_number: r.receipt_number
        })),
        failed: result.failed.map(r => ({ index: r.index, error: r.error }))
      })
    } catch (err) {
      next(err)
    }
  }

  createHoldOrder = async (req, res, next) => {
    try {
      const body = req.validBody || req.body
      const user = req.user || null
      const hold_order = await this.service.createHoldOrder(req.tenantId, body, user)
      res.status(201).json({ ok: true, hold_order })
    } catch (err) {
      next(err)
    }
  }

  exportPurchaseOrder = async (req, res, next) => {
    try {
      const csvContent = await this.service.exportPurchaseOrder(req.tenantId)
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="purchase_orders_export_${new Date().toISOString().split('T')[0]}.csv"`)
      res.send(csvContent)
    } catch (err) {
      next(err)
    }
  }

  listHoldOrders = async (req, res, next) => {
    try {
      const { limit, offset, search, sort_by, order_by, filter } = req.query
      const filterValue = filter === 'all' || filter === 'archived' ? filter : 'active'
      const result = await this.service.listHoldOrders(req.tenantId, {
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
        search: search || undefined,
        sort_by: sort_by || undefined,
        order_by: order_by || undefined,
        filter: filterValue
      })
      const hold_orders = result.hold_orders.map(h => ({
        id: h.id,
        hold_order_number: `HOLD-${h.id.toString().padStart(4, '0')}`,
        supplier_name: h.supplier_name,
        order_date: h.order_date,
        net_amount: Number(h.net_amount || 0),
        items_count: (() => {
          try {
            const items = JSON.parse(h.items || '[]')
            return Array.isArray(items) ? items.length : 0
          } catch {
            return 0
          }
        })(),
        created_at: h.created_at
      }))
      res.json({ ok: true, hold_orders, total: result.total })
    } catch (err) {
      next(err)
    }
  }

  getHoldOrder = async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10)
      const hold = await this.service.getHoldOrder(req.tenantId, id)
      res.json({ ok: true, hold_order: hold })
    } catch (err) {
      next(err)
    }
  }

  archiveHoldOrder = async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10)
      await this.service.archiveHoldOrder(req.tenantId, id)
      res.json({ ok: true, message: 'Hold order archived successfully' })
    } catch (err) {
      next(err)
    }
  }

  getStats = async (req, res, next) => {
    try {
      const { date_from, date_to, supplier_id, payment_mode, status } = req.query
      const { stats, period_summary } = await this.service.listOrders(req.tenantId, {
        limit: 1000,
        offset: 0,
        date_from: date_from || undefined,
        date_to: date_to || undefined,
        supplier_id: supplier_id ? parseInt(supplier_id, 10) : undefined,
        payment_mode: payment_mode || undefined,
        status: status || undefined
      })
      res.json({ ok: true, stats, period_summary })
    } catch (err) {
      next(err)
    }
  }

  getPaymentHistory = async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10)
      const result = await this.service.getPaymentHistory(req.tenantId, id)
      res.json({
        ok: true,
        payments: result.payments.map(p => ({
          id: p.id,
          payment_amount: p.amount,
          payment_mode: p.payment_method,
          payment_date: p.payment_date,
          created_at: p.created_at
        })),
        total_paid: result.total_paid,
        outstanding_balance: result.outstanding_balance
      })
    } catch (err) {
      next(err)
    }
  }

  listReceipts = async (req, res, next) => {
    try {
      const { limit, offset, search, voided, date_from, date_to, sort_by, order_by } = req.query
      const result = await this.service.listReceipts(req.tenantId, {
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
        search: search || undefined,
        voided,
        date_from: date_from || undefined,
        date_to: date_to || undefined,
        sort_by: sort_by || undefined,
        order_by: order_by || undefined
      })
      res.json({ ok: true, receipts: result.receipts, total: result.total })
    } catch (err) {
      next(err)
    }
  }

  getReceiptByNo = async (req, res, next) => {
    try {
      const { receipt_no } = req.params
      const receipt = await this.service.getReceiptByNo(req.tenantId, receipt_no)
      res.json({ ok: true, receipt })
    } catch (err) {
      next(err)
    }
  }

  voidReceipt = async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10)
      const receipt = await this.service.voidReceipt(req.tenantId, id)
      res.json({
        ok: true,
        message: 'Receipt voided successfully',
        receipt: { id: receipt.id, receipt_no: receipt.receipt_no, voided: receipt.voided }
      })
    } catch (err) {
      next(err)
    }
  }
}
