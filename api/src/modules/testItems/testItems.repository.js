/**
 * Repository: Data access layer
 * Encapsulates all database queries for test_items table
 */
export class TestItemsRepository {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * List all items, ordered by id descending
   */
  async list() {
    return this.knex('test_items').select('*').orderBy('id', 'desc')
  }

  /**
   * Find a single item by id
   */
  async findById(id) {
    return this.knex('test_items').where({ id }).first()
  }

  /**
   * Create a new item
   * @param {Object} data - { name: string, quantity: number }
   * @returns {Array} Array with created item (first element)
   */
  async create(data) {
    return this.knex('test_items')
      .insert(data)
      .returning(['id', 'name', 'quantity', 'created_at', 'updated_at'])
  }

  /**
   * Update an item by id
   * @param {number} id - Item id
   * @param {Object} data - Partial update data
   * @returns {Array} Array with updated item (first element) or empty
   */
  async update(id, data) {
    return this.knex('test_items')
      .where({ id })
      .update(data)
      .returning(['id', 'name', 'quantity', 'created_at', 'updated_at'])
  }

  /**
   * Delete an item by id
   * @returns {number} Number of rows deleted (0 or 1)
   */
  async delete(id) {
    return this.knex('test_items').where({ id }).del()
  }
}

