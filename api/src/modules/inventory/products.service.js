/**
 * Service: Business logic layer for products
 * Orchestrates use cases and coordinates between repository and business rules
 */
export class ProductsService {
  constructor(repository) {
    this.repository = repository
  }

  /**
   * Get all products with pagination, search, and sorting
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {Object} - { products, total }
   */
  async findAll(params = {}) {
    return this.repository.findAll(params)
  }

  /**
   * Export products to CSV
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {string} CSV formatted string
   */
  async exportToCSV(params = {}) {
    // For export, we typically want all matching records, not just one page
    const exportParams = {
      ...params,
      limit: params.limit || 10000, // Large limit for export
      offset: 0
    }
    
    const result = await this.repository.findAll(exportParams)
    const products = result.products || []
    
    // CSV Headers
    const headers = ['Product Code', 'Name', 'Description', 'Category', 'Unit', 'Balance', 'Created At', 'Last Updated']
    
    // Convert products to CSV rows
    const rows = products.map(product => {
      // Escape fields that contain commas or quotes
      const escapeCSV = (field) => {
        if (field === null || field === undefined) return ''
        const str = String(field)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }
      
      return [
        escapeCSV(product.product_code || ''),
        escapeCSV(product.name || ''),
        escapeCSV(product.description || ''),
        escapeCSV(product.category || ''),
        escapeCSV(product.unit || ''),
        escapeCSV(product.balance != null ? product.balance : ''),
        escapeCSV(product.created_at || ''),
        escapeCSV(product.last_updated || '')
      ].join(',')
    })
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n')
    
    return csvContent
  }

  /**
   * Bulk import products from CSV-shaped rows.
   * Only **name** is required per row. **category** and **unit** are optional (auto-created when a name string is provided).
   * **product_code** is never taken from the client import payload — it is generated in this method.
   * @param {Array} products - Array of product objects with { name, description?, category?, unit? }
   * @returns {Object} Summary with { total, successful, failed, results }
   */
  async bulkImport(products) {
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Products array is required and must not be empty')
    }

    // Get all categories and units for lookup
    const categories = await this.repository.getAllCategories()
    const units = await this.repository.getAllUnits()
    
    const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
    const unitMap = new Map(units.map((u) => [u.name.toLowerCase(), u.id]))

    const uniqueCategoryNames = [
      ...new Set(
        products
          .map((p) => (p.category && String(p.category).trim()) || '')
          .filter(Boolean)
      )
    ]
    const missingCategories = uniqueCategoryNames.filter((n) => !categoryMap.has(n.toLowerCase()))
    if (missingCategories.length > 0) {
      const createdCats = await this.repository.bulkInsertCategories(
        missingCategories.map((name) => ({
          name,
          description: null,
          sync_status: 'pending'
        }))
      )
      for (const c of createdCats) {
        categoryMap.set(String(c.name).toLowerCase(), c.id)
      }
    }

    const uniqueUnitNames = [
      ...new Set(products.map((p) => (p.unit && String(p.unit).trim()) || '').filter(Boolean))
    ]
    const missingUnits = uniqueUnitNames.filter((n) => !unitMap.has(n.toLowerCase()))
    if (missingUnits.length > 0) {
      const createdUnits = await this.repository.bulkInsertUnits(
        missingUnits.map((name) => ({
          name,
          abbreviation: null,
          sync_status: 'pending'
        }))
      )
      for (const u of createdUnits) {
        unitMap.set(String(u.name).toLowerCase(), u.id)
      }
    }

    let nextCodeNum = await this.repository.getMaxProductCodeNumber()
    const existingNamesLower = await this.repository.getProductNamesLowerSet()
    const seenNameLower = new Set()

    const results = []
    const productsToInsert = []
    const now = new Date()

    for (let index = 0; index < products.length; index++) {
      const product = products[index]

      try {
        if (!product.name || !product.name.trim()) {
          results.push({
            index,
            success: false,
            issueKind: 'error',
            error: 'Product name is required',
            product: product
          })
          continue
        }

        const categoryName = product.category?.trim()
        let categoryId = null
        if (categoryName) {
          categoryId = categoryMap.get(categoryName.toLowerCase()) ?? null
        }

        const unitName = product.unit?.trim()
        let unitId = null
        if (unitName) {
          unitId = unitMap.get(unitName.toLowerCase()) ?? null
        }

        const name = product.name.trim()
        const nameKey = name.toLowerCase()

        if (existingNamesLower.has(nameKey) || seenNameLower.has(nameKey)) {
          results.push({
            index,
            success: false,
            issueKind: 'warning',
            error: `Product with name "${name}" already exists`,
            product: product,
            existingProduct: null
          })
          continue
        }
        seenNameLower.add(nameKey)

        // Generate product_code in format "PRD####"
        nextCodeNum++
        const productCode = `PRD${String(nextCodeNum).padStart(4, '0')}`

        // Prepare product for insertion
        const description = (product.description || '').trim() || null
        const productData = {
          product_code: productCode,
          name,
          description,
          category_id: categoryId,
          unit_id: unitId,
          remark: product.remark || null,
          created_at: now,
          last_updated: now,
          sync_status: 'pending'
        }

        productsToInsert.push(productData)

        // Add to results as pending (will be marked success after insert)
        results.push({
          index,
          success: true,
          product: productData
        })

      } catch (error) {
        results.push({
          index,
          success: false,
          issueKind: 'error',
          error: error.message || 'Unknown error during validation',
          product: product
        })
      }
    }

    // Bulk insert all valid products
    if (productsToInsert.length > 0) {
      try {
        const inserted = await this.repository.bulkCreate(productsToInsert)
        
        // Update results with inserted products
        let insertIndex = 0
        for (let i = 0; i < results.length; i++) {
          if (results[i].success) {
            results[i].product = inserted[insertIndex]
            insertIndex++
          }
        }
      } catch (error) {
        // If bulk insert fails, mark all pending as failed
        for (const result of results) {
          if (result.success && !result.product.id) {
            result.success = false
            result.issueKind = 'error'
            result.error = `Bulk insert failed: ${error.message}`
          }
        }
        throw error
      }
    }

    // Calculate summary: errors = invalid / requirement failures; warnings = skipped (e.g. duplicate)
    const successful = results.filter(r => r.success).length
    const warnings = results.filter(r => !r.success && r.issueKind === 'warning').length
    const errors = results.filter(r => !r.success && r.issueKind !== 'warning').length
    const failed = errors + warnings

    return {
      total: products.length,
      successful,
      failed,
      errors,
      warnings,
      results
    }
  }

  /**
   * Create a new category
   * @param {Object} data - { name, description? }
   * @returns {Object} Created category
   */
  async createCategory(data) {
    // Check if category already exists
    const existing = await this.repository.findCategoryByName(data.name)
    if (existing) {
      throw new Error(`Category "${data.name}" already exists`)
    }

    const categoryData = {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      sync_status: 'pending'
    }

    const category = await this.repository.createCategory(categoryData)
    return category
  }

  /**
   * Create a new unit
   * @param {Object} data - { name, abbreviation? }
   * @returns {Object} Created unit
   */
  async createUnit(data) {
    // Check if unit already exists
    const existing = await this.repository.findUnitByName(data.name)
    if (existing) {
      throw new Error(`Unit "${data.name}" already exists`)
    }

    const unitData = {
      name: data.name.trim(),
      abbreviation: data.abbreviation?.trim() || null,
      sync_status: 'pending'
    }

    const unit = await this.repository.createUnit(unitData)
    return unit
  }

  /**
   * Get all categories
   * @returns {Array} Array of category objects
   */
  async getAllCategories() {
    return this.repository.getAllCategories()
  }

  /**
   * Get all units
   * @returns {Array} Array of unit objects
   */
  async getAllUnits() {
    return this.repository.getAllUnits()
  }

  /**
   * Find category by name
   * @param {string} name - Category name
   * @returns {Object|null} Category object or null
   */
  async findCategoryByName(name) {
    return this.repository.findCategoryByName(name)
  }

  /**
   * Find unit by name
   * @param {string} name - Unit name
   * @returns {Object|null} Unit object or null
   */
  async findUnitByName(name) {
    return this.repository.findUnitByName(name)
  }

  /**
   * Create a new product with auto-generated product code
   * @param {Object} data - { name, description?, category_id, unit_id, remark? }
   * @returns {Object} Created product
   */
  async createProduct(data) {
    // Check if product with same name already exists
    const existing = await this.repository.findByName(data.name)
    if (existing) {
      throw new Error(`Product "${data.name}" already exists`)
    }

    // Get next product code number
    const nextCodeNum = await this.repository.getMaxProductCodeNumber()
    const productCode = `PRD${String(nextCodeNum + 1).padStart(4, '0')}`

    const productData = {
      product_code: productCode,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category_id: data.category_id ?? null,
      unit_id: data.unit_id ?? null,
      remark: data.remark?.trim() || null,
      sync_status: 'pending'
    }

    const result = await this.repository.create(productData)
    
    const createdProduct = Array.isArray(result) ? result[0] : result
    
    if (!createdProduct || !createdProduct.id) {
      throw new Error('Product creation failed: No product returned from database')
    }
    
    return createdProduct
  }

  /**
   * Update an existing product
   * @param {number} id - Product ID
   * @param {Object} data - { name, description?, category_id, unit_id, remark? }
   * @returns {Object} Updated product
   */
  async updateProduct(id, data) {
    // Check if product exists
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new Error(`Product with ID ${id} not found`)
    }

    // If name is being updated, check for duplicates
    if (data.name && data.name.trim() !== existing.name) {
      const duplicate = await this.repository.findByName(data.name.trim())
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Product "${data.name}" already exists`)
      }
    }

    const updateData = {
      name: data.name?.trim() || existing.name,
      description: data.description?.trim() || null,
      category_id: Object.hasOwn(data, 'category_id')
        ? (data.category_id ?? null)
        : existing.category_id,
      unit_id: Object.hasOwn(data, 'unit_id')
        ? (data.unit_id ?? null)
        : existing.unit_id,
      remark: data.remark?.trim() || null,
      expiry_threshold: data.expiry_threshold != null ? data.expiry_threshold : (existing.expiry_threshold != null ? existing.expiry_threshold : 30)
    }

    await this.repository.update(id, updateData)
    // Always read back the row so clients get the full persisted record (e.g. expiry_threshold)
    // even if the driver's UPDATE … RETURNING shape varies.
    return this.repository.findById(id)
  }

  /**
   * Delete a product
   * @param {number} id - Product ID
   * @returns {boolean} True if deleted
   */
  async deleteProduct(id) {
    // Check if product exists
    const existing = await this.repository.findById(id)
    if (!existing) {
      throw new Error(`Product with ID ${id} not found`)
    }

    await this.repository.delete(id)
    return true
  }
}
