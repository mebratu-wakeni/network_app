/**
 * Controller: HTTP layer for customers
 * Handles request/response, delegates business logic to service
 */
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
      const { limit, offset, search, sortBy, orderBy, customer_type } = params

      const result = await this.service.findAll({
        limit: limit ? parseInt(limit, 10) : 10,
        offset: offset ? parseInt(offset, 10) : 0,
        search: search || '',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc',
        customer_type: customer_type || null
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
      console.log('[CustomersController] update - Customer ID:', id);
      console.log('[CustomersController] update - Request Body:', req.body);
      console.log('[CustomersController] update - Validated Body:', req.validBody);
      
      const customer = await this.service.update(id, req.validBody)
      
      console.log('[CustomersController] update - Updated Customer:', customer);
      console.log('[CustomersController] update - Success!');

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
   * Bulk import customers from CSV
   */
  bulkImport = async (req, res, next) => {
    try {
      const { customers } = req.validBody

      console.log(`[CustomersController] Bulk import request: ${customers.length} customers`)

      const result = await this.service.bulkImport(customers)

      console.log(`[CustomersController] Import summary: ${result.successful} successful, ${result.failed} failed`)

      if (result.failed > 0) {
        console.log(`[CustomersController] Import failed for ${result.failed} customers:`)
        result.results
          .filter(r => !r.success)
          .forEach(r => {
            console.log(`  Row ${r.index + 1}: ${r.error}`)
          })
      }

      res.json({
        ok: true,
        summary: {
          total: result.total,
          successful: result.successful,
          failed: result.failed
        },
        results: result.results
      })
    } catch (error) {
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

      console.log(`[CustomersController] Export request:`, {
        limit: limit || 10000,
        offset: offset || 0,
        search: search || '',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })

      const csvContent = await this.service.exportToCSV({
        limit: limit ? parseInt(limit) : 10000,
        offset: offset ? parseInt(offset) : 0,
        search: search || '',
        sortBy: sortBy || 'id',
        orderBy: orderBy || 'desc'
      })

      console.log(`[CustomersController] Export response: ${csvContent.split('\n').length - 1} rows`)

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
