/**
 * Controller: HTTP layer
 * Handles request/response, delegates business logic to service
 * All methods are async and use try/catch with next() for error handling
 */
export class TestItemsController {
  constructor(service) {
    this.service = service
  }

  /**
   * GET /api/test-items
   * List all items
   */
  list = async (_req, res, next) => {
    try {
      const items = await this.service.list()
      res.json({ ok: true, items })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/test-items/:id
   * Get a single item by id
   */
  getOne = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const item = await this.service.getById(id)
      res.json({ ok: true, item })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/test-items
   * Create a new item
   * Uses req.validBody from validation middleware
   */
  create = async (req, res, next) => {
    try {
      const item = await this.service.create(req.validBody)
      res.status(201).json({ ok: true, item })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/test-items/:id
   * Update an existing item
   * Uses req.validBody and req.validParams from validation middleware
   */
  update = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const item = await this.service.update(id, req.validBody)
      res.json({ ok: true, item })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/test-items/:id
   * Delete an item
   */
  delete = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      await this.service.delete(id)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  }
}

