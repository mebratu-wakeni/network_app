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
}
