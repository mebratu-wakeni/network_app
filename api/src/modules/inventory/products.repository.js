/**
 * Repository: Data access layer for products
 * Encapsulates all database queries for products table
 */
export class ProductsRepository {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * Find category by name within tenant
   */
  async findCategoryByName(tenantId, name) {
    return this.knex('categories').where({ tenant_id: tenantId, name }).first()
  }

  /**
   * Find category by id within tenant
   */
  async findCategoryById(tenantId, id) {
    return this.knex('categories').where({ tenant_id: tenantId, id }).first()
  }

  /**
   * Find unit by name within tenant
   */
  async findUnitByName(tenantId, name) {
    return this.knex('units').where({ tenant_id: tenantId, name }).first()
  }

  /**
   * Find unit by id within tenant
   */
  async findUnitById(tenantId, id) {
    return this.knex('units').where({ tenant_id: tenantId, id }).first()
  }

  /**
   * Get default category for new products (e.g. bulk import). Prefer "supplies", else first.
   */
  async getDefaultCategory(tenantId) {
    const byName = await this.findCategoryByName(tenantId, 'supplies')
    if (byName) return byName
    return this.knex('categories').where({ tenant_id: tenantId }).select('id', 'name').limit(1).first()
  }

  /**
   * Get default unit for new products (e.g. bulk import). Prefer "bottle", else first.
   */
  async getDefaultUnit(tenantId) {
    const byName = await this.findUnitByName(tenantId, 'bottle')
    if (byName) return byName
    return this.knex('units').where({ tenant_id: tenantId }).select('id', 'name').limit(1).first()
  }

  /**
   * Get all categories for tenant
   */
  async getAllCategories(tenantId) {
    return this.knex('categories').where({ tenant_id: tenantId }).select('id', 'name')
  }

  /**
   * Get all units for tenant
   */
  async getAllUnits(tenantId) {
    return this.knex('units').where({ tenant_id: tenantId }).select('id', 'name')
  }

  /**
   * Find product by code within tenant
   */
  async findByCode(tenantId, productCode) {
    return this.knex('products').where({ tenant_id: tenantId, product_code: productCode }).first()
  }

  /**
   * Find product by ID within tenant
   */
  async findById(tenantId, id) {
    return this.knex('products').where({ tenant_id: tenantId, id }).first()
  }

  /**
   * Find product by name (case-insensitive) within tenant
   */
  async findByName(tenantId, name) {
    return this.knex('products')
      .where({ tenant_id: tenantId })
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first()
  }

  /**
   * Distinct normalized product names (trimmed lower) for bulk-import duplicate checks — one query, O(1) per row.
   */
  async getProductNamesLowerSet(tenantId) {
    const rows = await this.knex('products')
      .where({ tenant_id: tenantId })
      .whereNotNull('name')
      .whereRaw("TRIM(name) <> ''")
      .select(this.knex.raw('LOWER(TRIM(name)) AS k'))
    const set = new Set()
    for (const r of rows) {
      if (r.k != null && String(r.k).length > 0) set.add(String(r.k))
    }
    return set
  }

  /**
   * Find product by unique details (name, description, category_id, unit_id) within tenant
   */
  async findByUniqueDetails(tenantId, name, description, categoryId, unitId) {
    return this.knex('products')
      .where({ tenant_id: tenantId, name })
      .where({ description: description || null })
      .where({ category_id: categoryId || null })
      .where({ unit_id: unitId || null })
      .first()
  }

  /**
   * Get the highest product code number for tenant
   * Returns the numeric part of the highest product_code (e.g., "PRD0011" -> 11)
   * Assumes format "PRD####" where #### is a 4-digit number
   */
  async getMaxProductCodeNumber(tenantId) {
    const products = await this.knex('products')
      .where({ tenant_id: tenantId })
      .select('product_code')
      .whereNotNull('product_code')
      .where('product_code', 'like', 'PRD%')
      .orderBy('id', 'desc')
      .limit(1000)

    let maxNum = 0
    for (const product of products) {
      const code = product.product_code
      if (code && code.startsWith('PRD')) {
        const numStr = code.substring(3)
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
   * Get product stock stats (out-of-stock and low-stock counts) from bin card balances for tenant.
   * No bin card post for a product = 0 balance = out of stock.
   */
  async getProductStockStats(tenantId) {
    const hasBinCards = await this.knex.schema.hasTable('bin_cards')
    if (!hasBinCards) {
      return { outOfStock: 0, lowStock: 0 }
    }
    const threshold = ProductsRepository.DEFAULT_LOW_STOCK_THRESHOLD
    const bcSubquery = this.knex.raw(
      `(SELECT b.product_id, b.balance
         FROM bin_cards b
         JOIN (
           SELECT product_id, MAX(id) AS max_id
           FROM bin_cards
           GROUP BY product_id
         ) latest ON latest.max_id = b.id
       ) AS bc`
    )
    const row = await this.knex('products')
      .where('products.tenant_id', tenantId)
      .leftJoin(bcSubquery, 'products.id', 'bc.product_id')
      .select(
        this.knex.raw('SUM(CASE WHEN COALESCE(bc.balance, 0) = 0 THEN 1 ELSE 0 END) AS out_of_stock'),
        this.knex.raw('SUM(CASE WHEN COALESCE(bc.balance, 0) > 0 AND COALESCE(bc.balance, 0) < ? THEN 1 ELSE 0 END) AS low_stock', [threshold])
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
   * @param {number} tenantId
   * @param {Object} params - { limit, offset, search, sortBy, orderBy, filter }
   * @param {string} params.filter - 'all' | 'out-of-stock' | 'low-stock'
   * @returns {Object} - { products, total, stats? }
   */
  async findAll(tenantId, params = {}) {
    const { limit = 10, offset = 0, search = '', sortBy = 'id', orderBy = 'desc', filter = 'all' } = params
    const threshold = ProductsRepository.DEFAULT_LOW_STOCK_THRESHOLD

    const hasBinCards = await this.knex.schema.hasTable('bin_cards')
    const bcSubquery = hasBinCards
      ? this.knex.raw(
          `(SELECT b.product_id, b.balance
             FROM bin_cards b
             JOIN (
               SELECT product_id, MAX(id) AS max_id
               FROM bin_cards
               GROUP BY product_id
             ) latest ON latest.max_id = b.id
           ) AS bc`
        )
      : null

    let query = this.knex('products')
      .where('products.tenant_id', tenantId)
      .select(
        'products.*',
        'categories.name as category',
        'units.name as unit'
      )
      .leftJoin('categories', function () {
        this.on('products.category_id', 'categories.id')
          .andOn('categories.tenant_id', '=', 'products.tenant_id')
      })
      .leftJoin('units', function () {
        this.on('products.unit_id', 'units.id')
          .andOn('units.tenant_id', '=', 'products.tenant_id')
      })

    if (bcSubquery) {
      query = query
        .leftJoin(bcSubquery, 'products.id', 'bc.product_id')
        .select(this.knex.raw('COALESCE(bc.balance, 0) AS balance'))
    } else {
      query = query.select(this.knex.raw('0 AS balance'))
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.where(function () {
        this.whereRaw("LOWER(COALESCE(products.name, '')) LIKE ?", [searchTerm.toLowerCase()])
          .orWhereRaw("LOWER(COALESCE(products.product_code, '')) LIKE ?", [searchTerm.toLowerCase()])
          .orWhereRaw("LOWER(COALESCE(products.description, '')) LIKE ?", [searchTerm.toLowerCase()])
          .orWhereRaw("LOWER(COALESCE(categories.name, '')) LIKE ?", [searchTerm.toLowerCase()])
          .orWhereRaw("LOWER(COALESCE(units.name, '')) LIKE ?", [searchTerm.toLowerCase()])
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

    const stats = await this.getProductStockStats(tenantId)

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
   * Bulk insert categories (chunked for SQLite variable limits + event-loop yield).
   */
  async bulkInsertCategories(tenantId, rows) {
    if (!Array.isArray(rows) || rows.length === 0) return []
    const CHUNK = 75
    const inserted = []
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK).map((r) => ({
        tenant_id: tenantId,
        name: r.name,
        description: r.description ?? null,
        sync_status: r.sync_status ?? 'pending',
        created_at: r.created_at ?? this.knex.fn.now(),
        last_updated: r.last_updated ?? this.knex.fn.now()
      }))
      const part = await this.knex('categories').insert(slice).returning(['id', 'name'])
      inserted.push(...part)
      if (i + CHUNK < rows.length) {
        await new Promise((resolve) => setImmediate(resolve))
      }
    }
    return inserted
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
   * Bulk insert units (chunked).
   */
  async bulkInsertUnits(tenantId, rows) {
    if (!Array.isArray(rows) || rows.length === 0) return []
    const CHUNK = 75
    const inserted = []
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK).map((r) => ({
        tenant_id: tenantId,
        name: r.name,
        abbreviation: r.abbreviation ?? null,
        sync_status: r.sync_status ?? 'pending',
        created_at: r.created_at ?? this.knex.fn.now(),
        last_updated: r.last_updated ?? this.knex.fn.now()
      }))
      const part = await this.knex('units').insert(slice).returning(['id', 'name'])
      inserted.push(...part)
      if (i + CHUNK < rows.length) {
        await new Promise((resolve) => setImmediate(resolve))
      }
    }
    return inserted
  }

  /**
   * Create a single product
   */
  async create(data) {
    return this.knex('products')
      .insert(data)
      .returning(['id', 'product_code', 'name', 'description', 'category_id', 'unit_id', 'remark', 'expiry_threshold', 'created_at', 'last_updated'])
  }

  /**
   * Update a product within tenant
   */
  async update(tenantId, id, data) {
    return this.knex('products')
      .where({ tenant_id: tenantId, id })
      .update({
        ...data,
        last_updated: this.knex.fn.now()
      })
      .returning(['id', 'product_code', 'name', 'description', 'category_id', 'unit_id', 'remark', 'expiry_threshold', 'created_at', 'last_updated'])
  }

  /**
   * Delete a product within tenant
   */
  async delete(tenantId, id) {
    return this.knex('products')
      .where({ tenant_id: tenantId, id })
      .del()
  }

  /**
   * Bulk create products (chunked for SQLite SQLITE_MAX_VARIABLE_NUMBER).
   */
  async bulkCreate(productsArray) {
    if (!Array.isArray(productsArray) || productsArray.length === 0) return []

    const CHUNK = 75
    const insertedAll = []
    for (let i = 0; i < productsArray.length; i += CHUNK) {
      const slice = productsArray.slice(i, i + CHUNK)
      const part = await this.knex('products')
        .insert(slice)
        .returning(['id', 'product_code', 'name', 'description', 'category_id', 'unit_id', 'remark', 'created_at', 'last_updated'])
      insertedAll.push(...part)
      if (i + CHUNK < productsArray.length) {
        await new Promise((resolve) => setImmediate(resolve))
      }
    }
    return insertedAll
  }
}
