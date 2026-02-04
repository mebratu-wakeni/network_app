/**
 * Repository: Data access layer for customers
 * Encapsulates all database queries for customers table
 */
export class CustomersRepository {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * Find customer by ID
   */
  async findById(id) {
    return this.knex('customers').where({ id }).first()
  }

  /**
   * Find customer by name (case-insensitive)
   */
  async findByName(name) {
    return this.knex('customers')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first()
  }

  /**
   * Find supplier by name (case-insensitive, customer_type in supplier/both)
   */
  async findSupplierByName(name) {
    if (!name || String(name).trim() === '') return null
    return this.knex('customers')
      .whereRaw('LOWER(name) = LOWER(?)', [name.trim()])
      .whereIn('customer_type', ['supplier', 'both'])
      .first()
  }

  /**
   * Get all customers with pagination, search, and sorting
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {Object} - { customers, total }
   */
  async findAll(params = {}) {
    const {
      limit = 10,
      offset = 0,
      search = '',
      sortBy = 'id',
      orderBy = 'desc',
      customer_type = null
    } = params

    let query = this.knex('customers')

    // Apply customer_type filter
    if (customer_type && customer_type.trim()) {
      query = query.where('customer_type', customer_type.trim())
    }

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.where(function() {
        this.where('name', 'ilike', searchTerm)
          .orWhere('contact_person', 'ilike', searchTerm)
          .orWhere('phone', 'ilike', searchTerm)
          .orWhere('email', 'ilike', searchTerm)
          .orWhere('address', 'ilike', searchTerm)
          .orWhere('license_no', 'ilike', searchTerm)
          .orWhere('tin_no', 'ilike', searchTerm)
      })
    }

    // Get total count before pagination
    const totalQuery = query.clone()
    const totalResult = await totalQuery.count('id as total').first()
    const total = parseInt(totalResult?.total || 0, 10)

    // Apply sorting
    const validSortFields = ['id', 'name', 'contact_person', 'phone', 'email', 'customer_type', 'created_at', 'last_updated']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'id'
    const sortOrder = orderBy.toLowerCase() === 'asc' ? 'asc' : 'desc'
    
    query = query.orderBy(sortField, sortOrder)

    // Apply pagination
    const customers = await query.limit(limit).offset(offset)

    return {
      customers,
      total
    }
  }

  /**
   * Create a new customer
   */
  async create(customerData) {
    const [customer] = await this.knex('customers')
      .insert({
        ...customerData,
        created_at: this.knex.fn.now(),
        last_updated: this.knex.fn.now()
      })
      .returning('*')
    
    return customer
  }

  /**
   * Bulk create customers
   */
  async bulkCreate(customers) {
    if (!Array.isArray(customers) || customers.length === 0) {
      return []
    }

    const now = this.knex.fn.now()
    const customersToInsert = customers.map(customer => ({
      ...customer,
      created_at: now,
      last_updated: now
    }))

    const inserted = await this.knex('customers')
      .insert(customersToInsert)
      .returning('*')
    
    return inserted
  }

  /**
   * Update a customer
   */
  async update(id, customerData) {
    const [updated] = await this.knex('customers')
      .where({ id })
      .update({
        ...customerData,
        last_updated: this.knex.fn.now()
      })
      .returning('*')
    
    return updated
  }

  /**
   * Delete a customer
   */
  async delete(id) {
    const deleted = await this.knex('customers')
      .where({ id })
      .del()
    
    return deleted > 0
  }
}
