/**
 * Controller: HTTP layer for products
 * Handles request/response, delegates business logic to service
 * All methods are async and use try/catch with next() for error handling
 */
export class ProductsController {
  constructor(service) {
    this.service = service
  }

  /**
   * POST /api/products
   * List products with pagination, search, and sorting
   */
  list = async (req, res, next) => {
    try {
      const params = req.body || {}
      const { limit, offset, search, sortBy, orderBy } = params
      
      console.log(`[ProductsController] List request:`, {
        limit: limit || 10,
        offset: offset || 0,
        search: search || '',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })
      
      const result = await this.service.findAll({
        limit: limit || 10,
        offset: offset || 0,
        search: search || '',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })
      
      console.log(`[ProductsController] List response: ${result.products.length} products, total: ${result.total}`)
      
      res.json({
        ok: true,
        products: result.products || [],
        total: result.total || 0
      })
    } catch (error) {
      console.error('[ProductsController] List error:', error)
      next(error)
    }
  }

  /**
   * POST /api/products/bulk-import
   * Bulk import products from CSV data
   */
  bulkImport = async (req, res, next) => {
    try {
      const { products } = req.validBody
      
      console.log(`[ProductsController] Bulk import request: ${products.length} products`)
      
      const result = await this.service.bulkImport(products)
      
      // Log failed results for debugging
      const failed = result.results.filter(r => !r.success)
      if (failed.length > 0) {
        console.error(`[ProductsController] Import failed for ${failed.length} products:`)
        failed.forEach(f => {
          console.error(`  Row ${f.index}: ${f.error || 'Unknown error'}`)
          if (f.product) {
            console.error(`    Product: ${f.product.name || JSON.stringify(f.product)}`)
          }
        })
      }
      
      console.log(`[ProductsController] Import summary: ${result.successful} successful, ${result.failed} failed`)
      
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
      console.error('[ProductsController] Bulk import error:', error)
      next(error)
    }
  }
}
