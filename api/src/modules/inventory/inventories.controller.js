/**
 * Controller: HTTP layer for inventories/stock
 * Handles request/response, delegates business logic to service
 * All methods are async and use try/catch with next() for error handling
 */
export class InventoriesController {
  constructor(service) {
    this.service = service
  }

  /**
   * POST /api/inventories/bulk-import
   * Bulk import stock items from CSV data
   */
  bulkImport = async (req, res, next) => {
    try {
      const { stockItems, purchase_date, purchaseDate, acquisition_type, acquisitionType, reason, created_by, createdBy } = req.validBody
      const userId = req.user?.id || created_by || createdBy || null

      console.log(`[InventoriesController] Bulk import request: ${stockItems.length} items`)

      // Transform stockItems from frontend format (camelCase) to backend format (snake_case)
      const transformedStockItems = stockItems.map(item => {
        const productName = item.productName || item.product_name
        const productCode = item.productCode || item.product_code
        
        if (!productName || productName.trim() === '') {
          throw new Error(`Product name is required for stock item at index ${stockItems.indexOf(item)}`)
        }

        const unitCost = item.unitCost !== undefined ? item.unitCost : item.unit_cost
        if (unitCost === undefined || unitCost <= 0) {
          throw new Error(`Unit cost is required and must be positive for stock item at index ${stockItems.indexOf(item)}`)
        }

        return {
          product_code: productCode || null,
          product_name: productName.trim(),
          location: item.location || null,
          quantity: item.quantity,
          unit_cost: unitCost,
          expiry_date: item.expiryDate || item.expiry_date || null,
          batch_number: item.batchNumber || item.batch_number || null,
          selling_price: item.sellingPrice || item.selling_price || null
        }
      })

      const result = await this.service.bulkImport(transformedStockItems, {
        purchase_date: purchase_date || purchaseDate,
        acquisition_type: acquisition_type || acquisitionType,
        reason,
        created_by: userId
      })

      // Log failed results for debugging
      const failed = result.results.filter(r => !r.success)
      if (failed.length > 0) {
        console.error(`[InventoriesController] Import failed for ${failed.length} items:`)
        failed.forEach(f => {
          console.error(`  Row ${f.index}: ${f.error || 'Unknown error'}`)
        })
      }

      console.log(`[InventoriesController] Import summary: ${result.successful} successful, ${result.failed} failed`)

      res.json({
        ok: true,
        success: result.failed === 0,
        summary: {
          total: result.total,
          successful: result.successful,
          failed: result.failed
        },
        results: result.results
      })
    } catch (error) {
      console.error('[InventoriesController] Bulk import error:', error)
      next(error)
    }
  }

  /**
   * POST /api/inventories
   * List stock/inventories with pagination, search, filters, and sorting
   */
  list = async (req, res, next) => {
    try {
      const params = req.body || {}
      const { limit, offset, search, filter, sortBy, orderBy } = params

      console.log(`[InventoriesController] List request:`, {
        limit: limit || 10,
        offset: offset || 0,
        search: search || '',
        filter: filter || 'all',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })

      const result = await this.service.findAll({
        limit: limit || 10,
        offset: offset || 0,
        search: search || '',
        filter: filter || 'all',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })

      console.log(`[InventoriesController] List response: ${result.stock.length} items, total: ${result.total}`)

      res.json({
        ok: true,
        success: true,
        stock: result.stock || [],
        total: result.total || 0,
        stats: result.stats || null
      })
    } catch (error) {
      console.error('[InventoriesController] List error:', error)
      next(error)
    }
  }

  /**
   * GET /api/inventories/export
   * Export stock/inventories to CSV
   */
  export = async (req, res, next) => {
    try {
      const params = req.query || {}
      const { limit, offset, search, filter, sortBy, orderBy } = params
      
      console.log(`[InventoriesController] Export request:`, {
        limit: limit || 10000,
        offset: offset || 0,
        search: search || '',
        filter: filter || 'all',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })
      
      const csvContent = await this.service.exportToCSV({
        limit: limit ? parseInt(limit) : 10000,
        offset: offset ? parseInt(offset) : 0,
        search: search || '',
        filter: filter || 'all',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })
      
      console.log(`[InventoriesController] Export response: ${csvContent.split('\n').length - 1} rows`)
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="stock_export_${new Date().toISOString().split('T')[0]}.csv"`)
      
      res.send(csvContent)
    } catch (error) {
      console.error('[InventoriesController] Export error:', error)
      next(error)
    }
  }

  /**
   * PUT /api/inventories/:id
   * Update a stock item
   */
  update = async (req, res, next) => {
    try {
      const { id } = req.params
      const updateData = req.validBody

      const updated = await this.service.update(parseInt(id, 10), updateData)

      res.json({
        ok: true,
        success: true,
        stock: updated
      })
    } catch (error) {
      console.error('[InventoriesController] Update error:', error)
      next(error)
    }
  }

  /**
   * POST /api/inventories/:id/adjust
   * Adjust stock quantity (add, subtract, or set)
   */
  adjust = async (req, res, next) => {
    try {
      const { id } = req.params
      const adjustmentData = req.validBody
      const userId = req.user?.id || null

      const updated = await this.service.adjustStock(parseInt(id, 10), adjustmentData, userId)

      res.json({
        ok: true,
        success: true,
        stock: updated
      })
    } catch (error) {
      console.error('[InventoriesController] Adjust error:', error)
      next(error)
    }
  }

  /**
   * POST /api/inventories/borrow-from
   * Create a borrow from inventory record
   */
  borrowFrom = async (req, res, next) => {
    try {
      const borrowData = req.validBody
      const userId = req.user?.id || null

      console.log('[InventoriesController] Borrow from request:', JSON.stringify(borrowData, null, 2))

      const result = await this.service.createBorrowFrom(borrowData, userId)

      console.log('[InventoriesController] Borrow from success:', JSON.stringify(result, null, 2))

      res.json({
        ok: true,
        borrowFrom: result
      })
    } catch (error) {
      console.error('[InventoriesController] Borrow from error:', error)
      console.error('[InventoriesController] Borrow from payload:', JSON.stringify(req.body, null, 2))
      next(error)
    }
  }
}
