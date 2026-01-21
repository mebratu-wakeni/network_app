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
    const headers = ['Product Code', 'Name', 'Description', 'Category', 'Unit', 'Created At', 'Last Updated']
    
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
   * Bulk import products
   * @param {Array} products - Array of product objects with { name, description, category, unit }
   * @returns {Object} Summary with { total, successful, failed, results }
   */
  async bulkImport(products) {
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Products array is required and must not be empty')
    }

    // Get all categories and units for lookup
    const categories = await this.repository.getAllCategories()
    const units = await this.repository.getAllUnits()
    
    // Create maps for fast lookup
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
    const unitMap = new Map(units.map(u => [u.name.toLowerCase(), u.id]))

    // Get current max product code to generate sequential codes
    let nextCodeNum = await this.repository.getMaxProductCodeNumber()

    const results = []
    const productsToInsert = []
    const now = new Date()

    // Process each product
    for (let index = 0; index < products.length; index++) {
      const product = products[index]
      
      try {
        // Validate required fields
        if (!product.name || !product.name.trim()) {
          results.push({
            index,
            success: false,
            error: 'Product name is required',
            product: product
          })
          continue
        }

        // Look up or create category ID
        const categoryName = product.category?.trim()
        let categoryId = null
        if (categoryName) {
          let catId = categoryMap.get(categoryName.toLowerCase())
          if (!catId) {
            // Category doesn't exist, create it
            const newCategory = await this.repository.createCategory({
              name: categoryName,
              description: null,
              created_at: now,
              last_updated: now,
              sync_status: 'pending'
            })
            categoryId = newCategory.id
            // Update the map for subsequent products in this batch
            categoryMap.set(categoryName.toLowerCase(), categoryId)
          } else {
            categoryId = catId
          }
        }

        // Look up or create unit ID
        const unitName = product.unit?.trim()
        let unitId = null
        if (unitName) {
          let uId = unitMap.get(unitName.toLowerCase())
          if (!uId) {
            // Unit doesn't exist, create it
            const newUnit = await this.repository.createUnit({
              name: unitName,
              abbreviation: null,
              created_at: now,
              last_updated: now,
              sync_status: 'pending'
            })
            unitId = newUnit.id
            // Update the map for subsequent products in this batch
            unitMap.set(unitName.toLowerCase(), unitId)
          } else {
            unitId = uId
          }
        }

        // Check if product name already exists (by name only)
        const name = product.name.trim()
        const existing = await this.repository.findByName(name)
        
        if (existing) {
          results.push({
            index,
            success: false,
            error: `Product with name "${name}" already exists`,
            product: product,
            existingProduct: existing
          })
          continue
        }

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
            result.error = `Bulk insert failed: ${error.message}`
          }
        }
        throw error
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return {
      total: products.length,
      successful,
      failed,
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
      category_id: data.category_id,
      unit_id: data.unit_id,
      remark: data.remark?.trim() || null,
      sync_status: 'pending'
    }

    console.log('[ProductsService] Creating product with data:', productData)
    const result = await this.repository.create(productData)
    console.log('[ProductsService] Repository create result:', result)
    
    const createdProduct = Array.isArray(result) ? result[0] : result
    console.log('[ProductsService] Created product:', createdProduct)
    
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
      category_id: data.category_id || existing.category_id,
      unit_id: data.unit_id || existing.unit_id,
      remark: data.remark?.trim() || null
    }

    const result = await this.repository.update(id, updateData)
    return Array.isArray(result) ? result[0] : result
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
