/**
 * Controller: HTTP layer for customers
 * Handles request/response, delegates business logic to service
 */
import { parseCSVText } from '../../utils/csvImportParse.js'
import {
  csvRowsToCustomersForBulkImport,
  MAX_UPLOAD_ROWS
} from './importCustomerCsvHelpers.js'

/** Keeps API JSON small: success rows only include id; failures keep error + csv row. */
function compactCustomerImportApiResults (results) {
  if (!Array.isArray(results)) return []
  return results.map((r) => {
    if (r.success) {
      return {
        index: r.index,
        csvRowNumber: r.csvRowNumber,
        success: true,
        customerId: r.customer?.id != null ? r.customer.id : null
      }
    }
    return {
      index: r.index,
      csvRowNumber: r.csvRowNumber,
      success: false,
      error: r.error ?? 'Unknown error',
      skipped: r.skipped === true,
      ...(r.validationFailed ? { validationFailed: true } : {})
    }
  })
}

export class CustomersController {
  constructor(service) {
    this.service = service
  }

  /**
   * GET /api/customers
   * List all customers with pagination, search, and sorting
   */
  list = async (req, res, next) => {
    try {
      const params = req.query || {}
      const { limit, offset, search, sortBy, orderBy, customer_type, customer_types, prefer_walk_in } = params

      let typesList = null
      if (customer_types != null && String(customer_types).trim() !== '') {
        typesList = String(customer_types)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      }

      const result = await this.service.findAll({
        limit: limit ? parseInt(limit, 10) : 10,
        offset: offset ? parseInt(offset, 10) : 0,
        search: search || '',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc',
        customer_type: customer_type || null,
        customer_types: typesList && typesList.length > 0 ? typesList : null,
        prefer_walk_in: prefer_walk_in === '1' || prefer_walk_in === 'true'
      })

      res.json({
        ok: true,
        customers: result.customers,
        total: result.total
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/customers/:id
   * Get a single customer by ID
   */
  getOne = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const customer = await this.service.findById(id)

      res.json({
        ok: true,
        customer
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/customers
   * Create a new customer
   */
  create = async (req, res, next) => {
    try {
      const customer = await this.service.create(req.validBody)

      res.status(201).json({
        ok: true,
        customer
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/customers/:id
   * Update an existing customer
   */
  update = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const customer = await this.service.update(id, req.validBody)

      res.json({
        ok: true,
        customer
      })
    } catch (error) {
      console.error('[CustomersController] update - Error:', error);
      next(error)
    }
  }

  /**
   * DELETE /api/customers/:id
   * Delete a customer
   */
  delete = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      await this.service.delete(id)

      res.json({
        ok: true
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/customers/bulk-import
   * Bulk import customers from JSON (partial success; compact result payload)
   */
  bulkImport = async (req, res, next) => {
    try {
      const { customers } = req.validBody

      const result = await this.service.bulkImport(customers)

      const skipped = result.results.filter((r) => !r.success && r.skipped).length
      const validationFailed = result.results.filter((r) => !r.success && r.validationFailed).length

      res.json({
        ok: true,
        success: result.failed === 0,
        summary: {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
          skipped,
          errors: result.failed - skipped,
          validationFailed
        },
        results: compactCustomerImportApiResults(result.results)
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/customers/bulk-import-upload
   * Multipart CSV — parse on server; insert valid rows; skip invalid / duplicate contact person.
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

      const customers = csvRowsToCustomersForBulkImport(rows)

      if (customers.length === 0) {
        return res.status(400).json({ ok: false, error: 'No data rows found in CSV' })
      }

      const importResult = await this.service.bulkImport(customers)

      const mergedResults = [...importResult.results].sort(
        (a, b) => (a.csvRowNumber ?? 0) - (b.csvRowNumber ?? 0)
      )
      const successful = mergedResults.filter((r) => r.success).length
      const failed = mergedResults.filter((r) => !r.success).length
      const skippedCount = mergedResults.filter((r) => !r.success && r.skipped).length
      const validationFailedCount = mergedResults.filter((r) => !r.success && r.validationFailed).length
      const errorRowsOnly = failed - skippedCount

      res.json({
        ok: true,
        success: failed === 0,
        summary: {
          total: importResult.total,
          successful,
          failed,
          skipped: skippedCount,
          errors: errorRowsOnly,
          validationFailed: validationFailedCount
        },
        results: compactCustomerImportApiResults(mergedResults)
      })
    } catch (error) {
      console.error('[CustomersController] Bulk import upload error:', error)
      next(error)
    }
  }

  /**
   * GET /api/customers/export
   * Export customers to CSV
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
      res.setHeader('Content-Disposition', `attachment; filename="customers_export_${new Date().toISOString().split('T')[0]}.csv"`)

      res.send(csvContent)
    } catch (error) {
      console.error('[CustomersController] Export error:', error)
      next(error)
    }
  }
}
