/**
 * Repository: Data access layer for bin_cards
 * Encapsulates all database queries for bin_cards table
 */
export class BinCardsRepository {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * Get all bin card transactions for a product
   * @param {number} tenantId - Tenant ID
   * @param {number} productId - Product ID
   * @param {Object} options - { limit, offset, sortBy, orderBy, search, filter }
   * @returns {Array} Array of bin card transactions
   */
  async findByProductId(tenantId, productId, options = {}) {
    const product = await this.knex('products')
      .where({ id: productId, tenant_id: tenantId })
      .first()
    if (!product) {
      return []
    }

    const { 
      limit, 
      offset = 0, 
      sortBy = 'transaction_date', 
      orderBy = 'desc',
      search = '',
      filter = {}
    } = options

    let query = this.knex('bin_cards')
      .where('bin_cards.tenant_id', tenantId)
      .where('bin_cards.product_id', productId)
      .leftJoin('users', function () {
        this.on('bin_cards.created_by', 'users.id')
          .andOn('users.tenant_id', '=', 'bin_cards.tenant_id')
      })
      .leftJoin('inventories', function () {
        this.on('bin_cards.inventory_id', 'inventories.id')
          .andOn('inventories.tenant_id', '=', 'bin_cards.tenant_id')
      })
      .select(
        'bin_cards.id',
        'bin_cards.product_id',
        'bin_cards.inventory_id',
        'bin_cards.batch_no',
        'bin_cards.expiry_date',
        'bin_cards.transaction_date',
        'bin_cards.transaction_type',
        'bin_cards.reference_id',
        'bin_cards.reference_table',
        'bin_cards.document_no',
        'bin_cards.opening_balance',
        'bin_cards.quantity_in',
        'bin_cards.quantity_out',
        'bin_cards.balance',
        'bin_cards.unit_cost',
        'bin_cards.total_cost',
        'bin_cards.reason',
        'bin_cards.notes',
        'bin_cards.created_by',
        'bin_cards.created_at',
        'users.display_name as user_name',
        'inventories.location'
      )

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.where(function() {
        this.where('bin_cards.reason', 'ilike', searchTerm)
          .orWhere('bin_cards.batch_no', 'ilike', searchTerm)
          .orWhere('bin_cards.document_no', 'ilike', searchTerm)
          .orWhere('inventories.location', 'ilike', searchTerm)
          .orWhere('users.display_name', 'ilike', searchTerm)
          .orWhere('bin_cards.notes', 'ilike', searchTerm)
      })
    }

    // Apply transaction type filter
    if (filter.transactionType && filter.transactionType.length > 0) {
      query = query.whereIn('bin_cards.transaction_type', filter.transactionType)
    }

    // Apply reason filter (partial match)
    if (filter.reason && filter.reason.trim()) {
      query = query.where('bin_cards.reason', 'ilike', `%${filter.reason.trim()}%`)
    }

    // Apply date range filter
    if (filter.dateFrom) {
      // If dateFrom is provided, include the entire day (start of day)
      const dateFrom = new Date(filter.dateFrom)
      dateFrom.setHours(0, 0, 0, 0)
      query = query.where('bin_cards.transaction_date', '>=', dateFrom.toISOString())
    }
    if (filter.dateTo) {
      // If dateTo is provided, include the entire day (end of day)
      const dateTo = new Date(filter.dateTo)
      dateTo.setHours(23, 59, 59, 999)
      query = query.where('bin_cards.transaction_date', '<=', dateTo.toISOString())
    }

    // Apply location filter
    if (filter.location && filter.location.trim()) {
      query = query.where('inventories.location', 'ilike', `%${filter.location.trim()}%`)
    }

    // Apply sorting
    // Map frontend sort field names to database column names (with table prefix for joined tables)
    const sortFieldMap = {
      'transaction_date': 'bin_cards.transaction_date',
      'balance': 'bin_cards.balance',
      'quantity_in': 'bin_cards.quantity_in',
      'quantity_out': 'bin_cards.quantity_out',
      'reason': 'bin_cards.reason',
      'batch_no': 'bin_cards.batch_no',
      'document_no': 'bin_cards.document_no',
      'created_at': 'bin_cards.created_at',
      'location': 'inventories.location',
      'user_name': 'users.display_name'
    }
    
    const validSortFields = Object.keys(sortFieldMap)
    const sortField = validSortFields.includes(sortBy) ? sortFieldMap[sortBy] : 'bin_cards.transaction_date'
    const sortOrder = orderBy.toLowerCase() === 'asc' ? 'asc' : 'desc'
    
    query = query.orderBy(sortField, sortOrder)

    if (limit) {
      query = query.limit(limit).offset(offset)
    }

    return query
  }

  /**
   * Get total count of bin card transactions for a product
   * @param {number} tenantId - Tenant ID
   * @param {number} productId - Product ID
   * @param {Object} options - { search, filter }
   * @returns {number} Total count
   */
  async countByProductId(tenantId, productId, options = {}) {
    const product = await this.knex('products')
      .where({ id: productId, tenant_id: tenantId })
      .first()
    if (!product) {
      return 0
    }

    const { search = '', filter = {} } = options

    let query = this.knex('bin_cards')
      .where('bin_cards.tenant_id', tenantId)
      .where('bin_cards.product_id', productId)
      .leftJoin('users', function () {
        this.on('bin_cards.created_by', 'users.id')
          .andOn('users.tenant_id', '=', 'bin_cards.tenant_id')
      })
      .leftJoin('inventories', function () {
        this.on('bin_cards.inventory_id', 'inventories.id')
          .andOn('inventories.tenant_id', '=', 'bin_cards.tenant_id')
      })

    // Apply search filter (same as findByProductId)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.where(function() {
        this.where('bin_cards.reason', 'ilike', searchTerm)
          .orWhere('bin_cards.batch_no', 'ilike', searchTerm)
          .orWhere('bin_cards.document_no', 'ilike', searchTerm)
          .orWhere('inventories.location', 'ilike', searchTerm)
          .orWhere('users.display_name', 'ilike', searchTerm)
          .orWhere('bin_cards.notes', 'ilike', searchTerm)
      })
    }

    // Apply transaction type filter
    if (filter.transactionType && filter.transactionType.length > 0) {
      query = query.whereIn('bin_cards.transaction_type', filter.transactionType)
    }

    // Apply reason filter
    if (filter.reason && filter.reason.trim()) {
      query = query.where('bin_cards.reason', 'ilike', `%${filter.reason.trim()}%`)
    }

    // Apply date range filter
    if (filter.dateFrom) {
      // If dateFrom is provided, include the entire day (start of day)
      const dateFrom = new Date(filter.dateFrom)
      dateFrom.setHours(0, 0, 0, 0)
      query = query.where('bin_cards.transaction_date', '>=', dateFrom.toISOString())
    }
    if (filter.dateTo) {
      // If dateTo is provided, include the entire day (end of day)
      const dateTo = new Date(filter.dateTo)
      dateTo.setHours(23, 59, 59, 999)
      query = query.where('bin_cards.transaction_date', '<=', dateTo.toISOString())
    }

    // Apply location filter
    if (filter.location && filter.location.trim()) {
      query = query.where('inventories.location', 'ilike', `%${filter.location.trim()}%`)
    }

    const result = await query.count('bin_cards.id as total').first()
    
    return parseInt(result?.total || 0, 10)
  }
}
