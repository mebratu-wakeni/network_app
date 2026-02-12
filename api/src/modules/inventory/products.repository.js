/**
 * Repository: Data access layer for products
 * Encapsulates all database queries for products table
 */
export class ProductsRepository {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * Find category by name
   */
  async findCategoryByName(name) {
    return this.knex('categories').where({ name }).first()
  }

  /**
   * Find unit by name
   */
  async findUnitByName(name) {
    return this.knex('units').where({ name }).first()
  }

  /**
   * Get default category for new products (e.g. bulk import). Prefer "supplies", else first.
   */
  async getDefaultCategory() {
    const byName = await this.findCategoryByName('supplies')
    if (byName) return byName
    return this.knex('categories').select('id', 'name').limit(1).first()
  }

  /**
   * Get default unit for new products (e.g. bulk import). Prefer "bottle", else first.
   */
  async getDefaultUnit() {
    const byName = await this.findUnitByName('bottle')
    if (byName) return byName
    return this.knex('units').select('id', 'name').limit(1).first()
  }

  /**
   * Get all categories (for validation)
   */
  async getAllCategories() {
    return this.knex('categories').select('id', 'name')
  }

  /**
   * Get all units (for validation)
   */
  async getAllUnits() {
    return this.knex('units').select('id', 'name')
  }

  /**
   * Find product by code
   */
  async findByCode(productCode) {
    return this.knex('products').where({ product_code: productCode }).first()
  }

  /**
   * Find product by ID
   */
  async findById(id) {
    return this.knex('products').where({ id }).first()
  }

  /**
   * Find product by name (case-insensitive)
   */
  async findByName(name) {
    return this.knex('products')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first()
  }

  /**
   * Find product by unique details (name, description, category_id, unit_id)
   */
  async findByUniqueDetails(name, description, categoryId, unitId) {
    return this.knex('products')
      .where({ name })
      .where({ description: description || null })
      .where({ category_id: categoryId || null })
      .where({ unit_id: unitId || null })
      .first()
  }

  /**
   * Get the highest product code number
   * Returns the numeric part of the highest product_code (e.g., "PRD0011" -> 11)
   * Assumes format "PRD####" where #### is a 4-digit number
   */
  async getMaxProductCodeNumber() {
    const products = await this.knex('products')
      .select('product_code')
      .whereNotNull('product_code')
      .where('product_code', 'like', 'PRD%')
      .orderBy('id', 'desc')
      .limit(1000) // Safety limit
    
    let maxNum = 0
    for (const product of products) {
      const code = product.product_code
      if (code && code.startsWith('PRD')) {
        // Extract numeric part after "PRD" (assumes format "PRD0001", "PRD0011")
        const numStr = code.substring(3) // Remove "PRD" prefix
        const num = parseInt(numStr, 10)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
        }
      }
    }
    return maxNum
  }

  /** Default low-stock threshold (bin card balance). Later: system_settings or per-product. */
  static get DEFAULT_LOW_STOCK_THRESHOLD() { return 50 }

  /**
   * Get product stock stats (out-of-stock and low-stock counts) from bin card balances.
   * No bin card post for a product = 0 balance = out of stock.
   */
  async getProductStockStats() {
    const hasBinCards = await this.knex.schema.hasTable('bin_cards')
    if (!hasBinCards) {
      return { outOfStock: 0, lowStock: 0 }
    }
    const threshold = ProductsRepository.DEFAULT_LOW_STOCK_THRESHOLD
    const bcSubquery = this.knex.raw(
      `(SELECT DISTINCT ON (product_id) product_id, balance FROM bin_cards ORDER BY product_id, id DESC) AS bc`
    )
    const row = await this.knex('products')
      .leftJoin(bcSubquery, 'products.id', 'bc.product_id')
      .select(
        this.knex.raw('SUM(CASE WHEN COALESCE(bc.balance, 0) = 0 THEN 1 ELSE 0 END)::int AS out_of_stock'),
        this.knex.raw('SUM(CASE WHEN COALESCE(bc.balance, 0) > 0 AND COALESCE(bc.balance, 0) < ? THEN 1 ELSE 0 END)::int AS low_stock', [threshold])
      )
      .first()
    return {
      outOfStock: parseInt(row?.out_of_stock || 0, 10),
      lowStock: parseInt(row?.low_stock || 0, 10)
    }
  }

  /**
   * Find all products with pagination, search, sorting, and optional stock filter.
   * Balance = latest bin card balance per product; no bin card post means 0.
   * @param {Object} params - { limit, offset, search, sortBy, orderBy, filter }
   * @param {string} params.filter - 'all' | 'out-of-stock' | 'low-stock'
   * @returns {Object} - { products, total, stats? }
   */
  async findAll(params = {}) {
    const { limit = 10, offset = 0, search = '', sortBy = 'id', orderBy = 'desc', filter = 'all' } = params
    const threshold = ProductsRepository.DEFAULT_LOW_STOCK_THRESHOLD

    const hasBinCards = await this.knex.schema.hasTable('bin_cards')
    const bcSubquery = hasBinCards
      ? this.knex.raw(
          `(SELECT DISTINCT ON (product_id) product_id, balance FROM bin_cards ORDER BY product_id, id DESC) AS bc`
        )
      : null

    let query = this.knex('products')
      .select(
        'products.*',
        'categories.name as category',
        'units.name as unit'
      )
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .leftJoin('units', 'products.unit_id', 'units.id')

    if (bcSubquery) {
      query = query
        .leftJoin(bcSubquery, 'products.id', 'bc.product_id')
        .select(this.knex.raw('COALESCE(bc.balance, 0)::int AS balance'))
    } else {
      query = query.select(this.knex.raw('0 AS balance'))
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.where(function () {
        this.whereRaw('LOWER(products.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(products.product_code) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(categories.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(units.name) LIKE ?', [searchTerm.toLowerCase()])
      })
    }

    if (hasBinCards && filter === 'out-of-stock') {
      query = query.whereRaw('COALESCE(bc.balance, 0) = 0')
    } else if (hasBinCards && filter === 'low-stock') {
      query = query.whereRaw('COALESCE(bc.balance, 0) > 0 AND COALESCE(bc.balance, 0) < ?', [threshold])
    }

    const countQuery = query.clone().clearSelect().clearOrder().countDistinct('products.id as total').first()
    const { total } = await countQuery

    const validSortBy = ['id', 'product_code', 'name', 'category', 'unit', 'balance', 'created_at', 'last_updated']
    const validOrderBy = ['asc', 'desc']
    const sortColumn = validSortBy.includes(sortBy) ? sortBy : 'id'
    const order = validOrderBy.includes(orderBy.toLowerCase()) ? orderBy.toLowerCase() : 'desc'
    const sortColumnMap = {
      id: 'products.id',
      product_code: 'products.product_code',
      name: 'products.name',
      category: 'categories.name',
      unit: 'units.name',
      balance: hasBinCards ? this.knex.raw('COALESCE(bc.balance, 0)') : 'products.id',
      created_at: 'products.created_at',
      last_updated: 'products.last_updated'
    }
    query = query.orderBy(sortColumnMap[sortColumn] || 'products.id', order)
    query = query.limit(limit).offset(offset)

    const rows = await query
    const products = rows.map((p) => ({
      ...p,
      balance: parseInt(p.balance || 0, 10)
    }))

    const stats = await this.getProductStockStats()

    return {
      products,
      total: parseInt(total, 10) || 0,
      stats
    }
  }

  /**
   * Create a single category
   */
  async createCategory(data) {
    const result = await this.knex('categories')
      .insert(data)
      .returning(['id', 'name', 'description', 'created_at', 'last_updated'])
    return result[0] || result
  }

  /**
   * Create a single unit
   */
  async createUnit(data) {
    const result = await this.knex('units')
      .insert(data)
      .returning(['id', 'name', 'abbreviation', 'created_at', 'last_updated'])
    return result[0] || result
  }

  /**
   * Create a single product
   */
  async create(data) {
    return this.knex('products')
      .insert(data)
      .returning(['id', 'product_code', 'name', 'description', 'category_id', 'unit_id', 'remark', 'created_at', 'last_updated'])
  }

  /**
   * Update a product
   */
  async update(id, data) {
    return this.knex('products')
      .where({ id })
      .update({
        ...data,
        last_updated: this.knex.fn.now()
      })
      .returning(['id', 'product_code', 'name', 'description', 'category_id', 'unit_id', 'remark', 'expiry_threshold', 'created_at', 'last_updated'])
  }

  /**
   * Delete a product
   */
  async delete(id) {
    return this.knex('products')
      .where({ id })
      .del()
  }

  /**
   * Bulk create products
   * Returns array of created products
   */
  async bulkCreate(productsArray) {
    if (productsArray.length === 0) return []
    
    return this.knex('products')
      .insert(productsArray)
      .returning(['id', 'product_code', 'name', 'description', 'category_id', 'unit_id', 'remark', 'created_at', 'last_updated'])
  }
}
