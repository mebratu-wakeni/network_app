import { parseCSVText } from '../../utils/csvImportParse.js'
import { csvRowsToProducts, MAX_UPLOAD_ROWS } from './importCsvHelpers.js'

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
      const { limit, offset, search, sortBy, orderBy, filter } = params
      
      const result = await this.service.findAll({
        limit: limit || 10,
        offset: offset || 0,
        search: search || '',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc',
        filter: filter || 'all'
      })
      
      res.json({
        ok: true,
        products: result.products || [],
        total: result.total || 0,
        stats: result.stats || { outOfStock: 0, lowStock: 0 }
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
      
      const result = await this.service.bulkImport(products)
      
      // Log rows that did not import (errors or warnings)
      const skipped = result.results.filter(r => !r.success)
      if (skipped.length > 0) {
        console.error(`[ProductsController] Import skipped ${skipped.length} row(s) (${result.errors} error(s), ${result.warnings} warning(s)):`)
        skipped.forEach(f => {
          const kind = f.issueKind === 'warning' ? 'warning' : 'error'
          console.error(`  Row ${f.index} [${kind}]: ${f.error || 'Unknown'}`)
          if (f.product) {
            console.error(`    Product: ${f.product.name || JSON.stringify(f.product)}`)
          }
        })
      }
      
      res.json({
        ok: true,
        success: result.errors === 0,
        summary: {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
          errors: result.errors,
          warnings: result.warnings
        },
        results: result.results
      })
    } catch (error) {
      console.error('[ProductsController] Bulk import error:', error)
      next(error)
    }
  }

  /**
   * POST /api/products/bulk-import-upload
   * Multipart CSV upload; parse + normalize + import on server (partial success per row).
   */
  bulkImportUpload = async (req, res, next) => {
    try {
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
      const products = csvRowsToProducts(rows)
      if (products.length === 0) {
        return res.status(400).json({ ok: false, error: 'No valid product rows in CSV' })
      }

      const result = await this.service.bulkImport(products)

      const skipped = result.results.filter(r => !r.success)
      if (skipped.length > 0) {
        console.error(`[ProductsController] Import skipped ${skipped.length} row(s) (upload): ${result.errors} error(s), ${result.warnings} warning(s)`)
      }

      res.json({
        ok: true,
        success: result.errors === 0,
        summary: {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
          errors: result.errors,
          warnings: result.warnings
        },
        results: result.results
      })
    } catch (error) {
      console.error('[ProductsController] Bulk import upload error:', error)
      next(error)
    }
  }

  /**
   * GET /api/products/export
   * Export products to CSV
   */
  export = async (req, res, next) => {
    try {
      const params = req.query || {}
      const { limit, offset, search, sortBy, orderBy } = params
      
      const csvContent = await this.service.exportToCSV({
        limit: limit ? parseInt(limit) : 10000,
        offset: offset ? parseInt(offset) : 0,
        search: search || '',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="products_export_${new Date().toISOString().split('T')[0]}.csv"`)
      
      res.send(csvContent)
    } catch (error) {
      console.error('[ProductsController] Export error:', error)
      next(error)
    }
  }

  /**
   * POST /api/products/categories
   * Create a new category
   */
  createCategory = async (req, res, next) => {
    try {
      const data = req.validBody
      
      const category = await this.service.createCategory(data)
      
      res.json({
        ok: true,
        category
      })
    } catch (error) {
      console.error('[ProductsController] Create category error:', error)
      next(error)
    }
  }

  /**
   * POST /api/products/units
   * Create a new unit
   */
  createUnit = async (req, res, next) => {
    try {
      const data = req.validBody
      
      const unit = await this.service.createUnit(data)
      
      res.json({
        ok: true,
        unit
      })
    } catch (error) {
      console.error('[ProductsController] Create unit error:', error)
      next(error)
    }
  }

  /**
   * GET /api/products/categories
   * Get all categories
   */
  getAllCategories = async (req, res, next) => {
    try {
      const categories = await this.service.getAllCategories()
      
      res.json({
        ok: true,
        categories
      })
    } catch (error) {
      console.error('[ProductsController] Get all categories error:', error)
      next(error)
    }
  }

  /**
   * GET /api/products/units
   * Get all units
   */
  getAllUnits = async (req, res, next) => {
    try {
      const units = await this.service.getAllUnits()
      
      res.json({
        ok: true,
        units
      })
    } catch (error) {
      console.error('[ProductsController] Get all units error:', error)
      next(error)
    }
  }

  /**
   * GET /api/products/categories/:name
   * Find category by name
   */
  findCategoryByName = async (req, res, next) => {
    try {
      const { name } = req.params
      
      const category = await this.service.findCategoryByName(name)
      
      if (!category) {
        return res.status(404).json({
          ok: false,
          error: `Category "${name}" not found`
        })
      }
      
      res.json({
        ok: true,
        category
      })
    } catch (error) {
      console.error('[ProductsController] Find category error:', error)
      next(error)
    }
  }

  /**
   * GET /api/products/units/:name
   * Find unit by name
   */
  findUnitByName = async (req, res, next) => {
    try {
      const { name } = req.params
      
      const unit = await this.service.findUnitByName(name)
      
      if (!unit) {
        return res.status(404).json({
          ok: false,
          error: `Unit "${name}" not found`
        })
      }
      
      res.json({
        ok: true,
        unit
      })
    } catch (error) {
      console.error('[ProductsController] Find unit error:', error)
      next(error)
    }
  }

  /**
   * POST /api/products/create
   * Create a new product with auto-generated product code
   */
  createProduct = async (req, res, next) => {
    try {
      const data = req.validBody
      
      const product = await this.service.createProduct(data)
      
      if (!product || !product.id) {
        console.error('[ProductsController] Product creation returned invalid product:', product)
        return res.status(500).json({
          ok: false,
          error: 'Product creation failed: Invalid product data returned'
        })
      }
      
      res.json({
        ok: true,
        product
      })
    } catch (error) {
      console.error('[ProductsController] Create product error:', error.message, error.stack)
      
      // If validation error, include details
      if (error.details) {
        console.error('[ProductsController] Validation details:', error.details)
        return res.status(error.status || 400).json({
          ok: false,
          error: error.message || 'Validation failed',
          details: error.details
        })
      }
      
      next(error)
    }
  }

  /**
   * PUT /api/products/:id
   * Update an existing product
   */
  updateProduct = async (req, res, next) => {
    try {
      const { id } = req.params
      const data = req.validBody
      
      const product = await this.service.updateProduct(parseInt(id), data)
      
      if (!product || !product.id) {
        console.error('[ProductsController] Product update returned invalid product:', product)
        return res.status(500).json({
          ok: false,
          error: 'Product update failed: Invalid product data returned'
        })
      }
      
      res.json({
        ok: true,
        product
      })
    } catch (error) {
      console.error('[ProductsController] Update product error:', error.message, error.stack)
      
      if (error.details) {
        console.error('[ProductsController] Validation details:', error.details)
        return res.status(error.status || 400).json({
          ok: false,
          error: error.message || 'Validation failed',
          details: error.details
        })
      }
      
      next(error)
    }
  }

  /**
   * DELETE /api/products/:id
   * Delete a product
   */
  deleteProduct = async (req, res, next) => {
    try {
      const { id } = req.params
      
      await this.service.deleteProduct(parseInt(id))
      
      res.json({
        ok: true,
        message: 'Product deleted successfully'
      })
    } catch (error) {
      console.error('[ProductsController] Delete product error:', error.message, error.stack)
      next(error)
    }
  }
}
