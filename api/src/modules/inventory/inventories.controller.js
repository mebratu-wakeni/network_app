import { parseCSVText } from '../../utils/csvImportParse.js'
import { ddMmYyyyToIso } from '../../utils/ddMmYyyy.js'
import { validateStockRowsForUpload, MAX_UPLOAD_ROWS } from './importCsvHelpers.js'

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
          category: item.category || item.product_category || null,
          unit: item.unit || item.product_unit || null,
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
   * POST /api/inventories/bulk-import-upload
   * Multipart CSV: validate on server, then all-or-nothing stock import.
   */
  bulkImportUpload = async (req, res, next) => {
    try {
      const purchase_date_raw = req.body.purchase_date || req.body.purchaseDate
      let purchase_date = undefined
      if (purchase_date_raw != null && String(purchase_date_raw).trim() !== '') {
        const iso = ddMmYyyyToIso(String(purchase_date_raw).trim())
        if (!iso) {
          return res.status(400).json({
            ok: false,
            error: 'Purchase date must be dd/mm/yyyy (e.g. 31/12/2025)'
          })
        }
        purchase_date = iso
      }
      const acquisition_type = req.body.acquisition_type || req.body.acquisitionType
      const reason = (req.body.reason || 'Initial Stock').trim()
      const userId = req.user?.id || req.body.created_by || req.body.createdBy || null

      if (!req.file?.buffer) {
        return res.status(400).json({ ok: false, error: 'No file uploaded' })
      }

      const text = req.file.buffer.toString('utf8')
      const { rows } = parseCSVText(text)
      if (rows.length > MAX_UPLOAD_ROWS) {
        return res.status(400).json({
          ok: false,
          error: `Too many data rows (max ${MAX_UPLOAD_ROWS})`
        })
      }

      const { validItems, errors: rowErrors } = validateStockRowsForUpload(rows)
      if (rowErrors.length > 0) {
        return res.status(400).json({
          ok: false,
          success: false,
          validationFailed: true,
          rowErrors,
          summary: {
            total: rows.length,
            successful: 0,
            failed: rowErrors.length,
            errors: rowErrors.length,
            warnings: 0
          }
        })
      }

      if (validItems.length === 0) {
        return res.status(400).json({ ok: false, error: 'No data rows in CSV' })
      }

      const result = await this.service.bulkImport(validItems, {
        purchase_date,
        acquisition_type,
        reason,
        created_by: userId
      })

      if (result.failed > 0) {
        const rowErrors = (result.results || [])
          .filter((r) => r && r.success === false)
          .map((r) => ({
            rowNumber: r.csvRowNumber ?? (r.index != null ? r.index + 2 : null),
            error: r.error || 'Import failed',
            issueKind: 'error'
          }))
        return res.status(400).json({
          ok: false,
          success: false,
          atomicFailed: true,
          summary: {
            total: result.total,
            successful: result.successful,
            failed: result.failed,
            errors: result.failed,
            warnings: 0
          },
          rowErrors: rowErrors.length ? rowErrors : [{ rowNumber: null, error: 'Import failed (all rows rolled back)', issueKind: 'error' }],
          results: result.results
        })
      }

      res.json({
        ok: true,
        success: true,
        summary: {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
          errors: 0,
          warnings: 0
        },
        results: result.results
      })
    } catch (error) {
      console.error('[InventoriesController] Bulk import upload error:', error)
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

      const result = await this.service.findAll({
        limit: limit || 10,
        offset: offset || 0,
        search: search || '',
        filter: filter || 'all',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })

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
   * GET /api/inventories/by-product/:productId
   * List inventories for a product (inventories table only). Used e.g. by return-borrowed drawer.
   */
  listByProduct = async (req, res, next) => {
    try {
      const productId = parseInt(req.params.productId, 10)
      if (!productId) {
        return res.status(400).json({ ok: false, error: 'Valid product ID is required' })
      }
      const items = await this.service.findInventoriesByProduct(productId)
      res.json({ ok: true, success: true, items: items || [] })
    } catch (error) {
      console.error('[InventoriesController] List by product error:', error)
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
      
      const csvContent = await this.service.exportToCSV({
        limit: limit ? parseInt(limit) : 10000,
        offset: offset ? parseInt(offset) : 0,
        search: search || '',
        filter: filter || 'all',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })
      
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

      const result = await this.service.createBorrowFrom(borrowData, userId)

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

  /**
   * GET /api/inventories/borrow-to/:id/returns
   * Get return history for a borrow_to_inventory record
   */
  getBorrowToReturnHistory = async (req, res, next) => {
    try {
      const { id } = req.params
      const history = await this.service.getBorrowToReturnHistory(parseInt(id, 10))

      res.json({
        ok: true,
        success: true,
        history: history || []
      })
    } catch (error) {
      console.error('[InventoriesController] Get borrow to return history error:', error)
      next(error)
    }
  }

  /**
   * POST /api/inventories/borrow-to/return
   * Process return of borrowed-to items
   */
  processBorrowToReturn = async (req, res, next) => {
    try {
      const returnData = req.validBody
      const userId = req.user?.id || null

      const result = await this.service.processBorrowToReturn(returnData, userId)

      res.json({
        ok: true,
        success: true,
        return: result
      })
    } catch (error) {
      console.error('[InventoriesController] Process borrow to return error:', error)
      
      // Handle validation errors with details
      if (error.details) {
        console.error('[InventoriesController] Validation details:', error.details)
        return res.status(error.status || 400).json({
          ok: false,
          success: false,
          error: error.message || 'Validation failed',
          details: error.details
        })
      }
      
      next(error)
    }
  }

  /**
   * GET /api/inventories/borrow-from/:inventoryId/return-status
   * Get return status by inventory ID (remaining to return, etc.)
   */
  getBorrowFromReturnStatus = async (req, res, next) => {
    try {
      const inventoryId = parseInt(req.params.inventoryId, 10)
      if (!inventoryId) {
        return res.status(400).json({ ok: false, error: 'Valid inventory ID is required' })
      }
      const status = await this.service.getBorrowFromReturnStatus({ borrowedInventoryId: inventoryId })
      res.json({ ok: true, success: true, ...status })
    } catch (error) {
      console.error('[InventoriesController] Get borrow from return status error:', error)
      next(error)
    }
  }

  /**
   * GET /api/inventories/borrow-from/by-borrow/:borrowFromId/return-status
   * Get return status by borrow_from_inventories id (used when row is from borrowed-from list).
   */
  getBorrowFromReturnStatusByBorrowId = async (req, res, next) => {
    try {
      const borrowFromId = parseInt(req.params.borrowFromId, 10)
      if (!borrowFromId) {
        return res.status(400).json({ ok: false, error: 'Valid borrow-from ID is required' })
      }
      // Get borrowedInventoryId from query parameter if provided
      const borrowedInventoryId = req.query.borrowedInventoryId 
        ? parseInt(req.query.borrowedInventoryId, 10) 
        : null
      
      const status = await this.service.getBorrowFromReturnStatus({ 
        borrowFromId,
        borrowedInventoryId 
      })
      res.json({ ok: true, success: true, ...status })
    } catch (error) {
      console.error('[InventoriesController] Get borrow from return status by borrow ID error:', error)
      next(error)
    }
  }

  /**
   * POST /api/inventories/borrow-from/return
   * Process return of borrowed-from items (AP, Borrow Variance 6400, inventory at returning lot cost)
   */
  processBorrowFromReturn = async (req, res, next) => {
    try {
      const returnData = req.validBody
      const userId = req.user?.id || null

      const result = await this.service.processBorrowFromReturn(returnData, userId)

      res.json({
        ok: true,
        success: true,
        result: result
      })
    } catch (error) {
      console.error('[InventoriesController] Process borrow from return error:', error)
      console.error('[InventoriesController] error.message:', error?.message)
      console.error('[InventoriesController] error.stack:', error?.stack)
      
      // Handle validation errors with details
      if (error.details) {
        console.error('[InventoriesController] Validation details:', error.details)
        return res.status(error.status || 400).json({
          ok: false,
          success: false,
          error: error.message || 'Validation failed',
          details: error.details
        })
      }
      
      next(error)
    }
  }
}
