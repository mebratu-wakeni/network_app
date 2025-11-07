/**
 * Service: Business logic layer
 * Orchestrates use cases and coordinates between repository and business rules
 */
export class TestItemsService {
  constructor(repository) {
    this.repository = repository
  }

  /**
   * List all items
   */
  async list() {
    return this.repository.list()
  }

  /**
   * Get a single item by id
   * @throws {Error} If item not found
   */
  async getById(id) {
    const item = await this.repository.findById(id)
    if (!item) {
      const error = new Error('Item not found')
      error.status = 404
      throw error
    }
    return item
  }

  /**
   * Create a new item
   * @param {Object} input - Validated input data
   */
  async create(input) {
    const [created] = await this.repository.create(input)
    return created
  }

  /**
   * Update an item
   * @param {number} id - Item id
   * @param {Object} input - Validated partial update data
   * @throws {Error} If item not found
   */
  async update(id, input) {
    const [updated] = await this.repository.update(id, input)
    if (!updated) {
      const error = new Error('Item not found')
      error.status = 404
      throw error
    }
    return updated
  }

  /**
   * Delete an item
   * @param {number} id - Item id
   * @throws {Error} If item not found
   */
  async delete(id) {
    const deleted = await this.repository.delete(id)
    if (!deleted) {
      const error = new Error('Item not found')
      error.status = 404
      throw error
    }
    return { deleted: true }
  }
}

