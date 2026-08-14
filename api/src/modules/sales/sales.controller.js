/**
 * Controller: HTTP layer for sales module.
 */
export class SalesController {
  constructor(service) {
    this.service = service
  }

  /**
   * POST /api/sales/orders — create sales order and its items (sales_order_items); inventory decremented.
   */
  createOrder = async (req, res, next) => {
    try {
      const body = req.validBody || req.body
      const user = req.user || null
      const order = await this.service.createOrder(body, user, req.tenantId)
      res.status(201).json({ ok: true, order })
    } catch (err) {
      next(err)
    }
  }

  /**
   * GET /api/sales/orders/:id — order details with items.
   */
  getOrderDetails = async (req, res, next) => {
    try {
      const { id } = req.params
      const result = await this.service.getOrderDetails(req.tenantId, id)
      if (!result) {
        const err = new Error('Order not found')
        err.status = 404
        return next(err)
      }
      res.json({ ok: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  /**
   * GET /api/sales/export — export sales order.
   */
  exportSalesOrder = async (req, res, next) => {
    try {
      const csvContent = await this.service.exportSalesOrder(req.tenantId)

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="sales_orders_export_${new Date().toISOString().split('T')[0]}.csv"`)
      
      res.send(csvContent)
    } catch (err) {
      next(err)
    }
  }

  /**
   * GET /api/sales/orders/:id/receipt — receipt for printing/view.
   */
  getOrderReceipt = async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10)
      const receipt = await this.service.getOrderReceipt(req.tenantId, id)
      res.json({ ok: true, receipt })
    } catch (err) {
      next(err)
    }
  }

  getWithholdPercentage = async (req, res, next) => {
    try {
      const result = await this.service.getWithholdPercentage(req.tenantId)
      res.json({ ok: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  listOrders = async (req, res, next) => {
    try {
      const q = req.query
      const result = await this.service.listOrders(req.tenantId, {
        limit: q.limit ? parseInt(q.limit, 10) : 20,
        offset: q.offset ? parseInt(q.offset, 10) : 0,
        search: q.search,
        status: q.status,
        customer_id: q.customer_id ? parseInt(q.customer_id, 10) : undefined,
        payment_type: q.payment_type || q.payment_mode,
        date_from: q.date_from,
        date_to: q.date_to,
        has_outstanding_balance: q.has_outstanding_balance,
        stat_filter: q.stat_filter,
        sort_by: q.sort_by,
        order_by: q.order_by
      })
      res.json({ ok: true, orders: result.orders, total: result.total, stats: result.stats, period_summary: result.period_summary })
    } catch (err) {
      next(err)
    }
  }

  createHoldOrder = async (req, res, next) => {
    try {
      const body = req.validBody || req.body
      const hold = await this.service.createHoldOrder(req.tenantId, body, req.user)
      res.status(201).json({ ok: true, hold_order: hold })
    } catch (err) {
      next(err)
    }
  }

  listHoldOrders = async (req, res, next) => {
    try {
      const q = req.query
      const result = await this.service.listHoldOrders(req.tenantId, {
        limit: q.limit ? parseInt(q.limit, 10) : 20,
        offset: q.offset ? parseInt(q.offset, 10) : 0,
        search: q.search,
        filter: q.filter,
        sort_by: q.sort_by,
        order_by: q.order_by
      })
      res.json({ ok: true, hold_orders: result.hold_orders, total: result.total })
    } catch (err) {
      next(err)
    }
  }

  getHoldOrder = async (req, res, next) => {
    try {
      const { id } = req.params
      const hold = await this.service.getHoldOrderById(req.tenantId, id)
      if (!hold) {
        const err = new Error('Hold order not found')
        err.status = 404
        return next(err)
      }
      res.json({ ok: true, hold_order: hold })
    } catch (err) {
      next(err)
    }
  }

  archiveHoldOrder = async (req, res, next) => {
    try {
      const { id } = req.params
      await this.service.archiveHoldOrder(req.tenantId, id)
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  }

  payOrder = async (req, res, next) => {
    try {
      const { id } = req.params
      const body = req.validBody || req.body
      const result = await this.service.recordPayment(req.tenantId, id, body, req.user?.id)
      res.json({ ok: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  getCustomerOutstandingForPayment = async (req, res, next) => {
    try {
      const customerId = parseInt(req.params.customerId, 10)
      if (!Number.isFinite(customerId) || customerId <= 0) {
        const err = new Error('Invalid customer id')
        err.status = 400
        return next(err)
      }
      const result = await this.service.getCustomerOutstandingForPayment(req.tenantId, customerId)
      res.json({ ok: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  bulkPayCustomerSales = async (req, res, next) => {
    try {
      const body = req.validBody || req.body
      const result = await this.service.recordBulkCustomerSales(req.tenantId, body, req.user?.id)
      res.json({ ok: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  confirmWithhold = async (req, res, next) => {
    try {
      const { id } = req.params
      const body = req.validBody || req.body
      await this.service.confirmWithhold(req.tenantId, id, body.withhold_ref)
      const order = await this.service.getOrderDetails(req.tenantId, id)
      res.json({ ok: true, order: order?.order })
    } catch (err) {
      next(err)
    }
  }

  rollbackWithhold = async (req, res, next) => {
    try {
      const { id } = req.params
      await this.service.rollbackWithhold(req.tenantId, id)
      const order = await this.service.getOrderDetails(req.tenantId, id)
      res.json({ ok: true, order: order?.order })
    } catch (err) {
      next(err)
    }
  }

  reverseOrder = async (req, res, next) => {
    try {
      const { id } = req.params
      const result = await this.service.reverseOrder(req.tenantId, id, req.user)
      res.json({ ok: true, ...result })
    } catch (err) {
      next(err)
    }
  }
}
