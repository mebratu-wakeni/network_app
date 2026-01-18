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

  /**
   * Find all products with pagination, search, and sorting
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {Object} - { products, total }
   */
  async findAll(params = {}) {
    const { limit = 10, offset = 0, search = '', sortBy = 'id', orderBy = 'desc' } = params
    
    // Base query with joins for category and unit names
    let query = this.knex('products')
      .select(
        'products.*',
        'categories.name as category',
        'units.name as unit'
      )
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .leftJoin('units', 'products.unit_id', 'units.id')
    
    // Apply search filter (search in name, product_code, category, unit)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.where(function() {
        this.whereRaw('LOWER(products.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(products.product_code) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(categories.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(units.name) LIKE ?', [searchTerm.toLowerCase()])
      })
    }
    
    // Get total count before pagination (count distinct products to handle joins correctly)
    const countQuery = query.clone().clearSelect().clearOrder().countDistinct('products.id as total').first()
    const { total } = await countQuery
    
    // Apply sorting
    const validSortBy = ['id', 'product_code', 'name', 'category', 'unit', 'created_at', 'last_updated']
    const validOrderBy = ['asc', 'desc']
    const sortColumn = validSortBy.includes(sortBy) ? sortBy : 'id'
    const order = validOrderBy.includes(orderBy.toLowerCase()) ? orderBy.toLowerCase() : 'desc'
    
    // Map sortBy to actual column names
    const sortColumnMap = {
      'id': 'products.id',
      'product_code': 'products.product_code',
      'name': 'products.name',
      'category': 'categories.name',
      'unit': 'units.name',
      'created_at': 'products.created_at',
      'last_updated': 'products.last_updated'
    }
    
    query = query.orderBy(sortColumnMap[sortColumn] || 'products.id', order)
    
    // Apply pagination
    query = query.limit(limit).offset(offset)
    
    const products = await query
    
    return {
      products,
      total: parseInt(total, 10) || 0
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
