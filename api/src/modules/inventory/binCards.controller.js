/**
 * Controller: HTTP layer for bin_cards
 * Handles request/response, delegates business logic to service
 */
export class BinCardsController {
  constructor(service) {
    this.service = service
  }

  /**
   * GET /api/bin-cards/product/:productId
   * Get bin card transactions for a product
   */
  getByProductId = async (req, res, next) => {
    try {
      const { productId } = req.params
      const { limit, offset, sortBy, orderBy, search, transactionType, reason, dateFrom, dateTo, location } = req.query

      // Parse filter object
      const filter = {}
      if (transactionType) {
        // Can be comma-separated list or single value
        filter.transactionType = Array.isArray(transactionType) 
          ? transactionType 
          : transactionType.split(',').map(t => t.trim())
      }
      if (reason) filter.reason = reason
      if (dateFrom) filter.dateFrom = dateFrom
      if (dateTo) filter.dateTo = dateTo
      if (location) filter.location = location

      const result = await this.service.getByProductId(productId, {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : 0,
        sortBy: sortBy || 'transaction_date',
        orderBy: orderBy || 'desc',
        search: search || '',
        filter
      })

      res.json({
        ok: true,
        transactions: result.transactions,
        total: result.total
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/bin-cards/product/:productId/export
   * Export bin card transactions to CSV
   */
  export = async (req, res, next) => {
    try {
      const { productId } = req.params
      const params = req.query || {}
      const { limit, offset, sortBy, orderBy, search, transactionType, reason, dateFrom, dateTo, location } = params

      // Parse filter object
      const filter = {}
      if (transactionType) {
        filter.transactionType = Array.isArray(transactionType) 
          ? transactionType 
          : transactionType.split(',').map(t => t.trim())
      }
      if (reason) filter.reason = reason
      if (dateFrom) filter.dateFrom = dateFrom
      if (dateTo) filter.dateTo = dateTo
      if (location) filter.location = location

      const csvContent = await this.service.exportToCSV(productId, {
        limit: limit ? parseInt(limit) : 10000,
        offset: offset ? parseInt(offset) : 0,
        search: search || '',
        filter,
        sortBy: sortBy || 'transaction_date',
        orderBy: orderBy || 'desc'
      })

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="bin_card_export_${productId}_${new Date().toISOString().split('T')[0]}.csv"`)

      res.send(csvContent)
    } catch (error) {
      console.error('[BinCardsController] Export error:', error)
      next(error)
    }
  }
}
