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
   * @param {number} tenantId
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {Object} - { products, total }
   */
  async findAll(tenantId, params = {}) {
    return this.repository.findAll(tenantId, params)
  }

  /**
   * Export products to CSV
   * @param {number} tenantId
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {string} CSV formatted string
   */
  async exportToCSV(tenantId, params = {}) {
    const exportParams = {
      ...params,
      limit: params.limit || 10000,
      offset: 0
    }

    const result = await this.repository.findAll(tenantId, exportParams)
    const products = result.products || []

    const headers = ['Product Code', 'Name', 'Description', 'Category', 'Unit', 'Balance', 'Created At', 'Last Updated']

    const rows = products.map(product => {
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

    return [headers.join(','), ...rows].join('\n')
  }

  /**
   * Bulk import products from CSV-shaped rows.
   */
  async bulkImport(tenantId, products) {
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Products array is required and must not be empty')
    }

    const categories = await this.repository.getAllCategories(tenantId)
    const units = await this.repository.getAllUnits(tenantId)

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
        tenantId,
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
        tenantId,
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

    let nextCodeNum = await this.repository.getMaxProductCodeNumber(tenantId)
    const existingNamesLower = await this.repository.getProductNamesLowerSet(tenantId)
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
            product
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
            product,
            existingProduct: null
          })
          continue
        }
        seenNameLower.add(nameKey)

        nextCodeNum++
        const productCode = `PRD${String(nextCodeNum).padStart(4, '0')}`

        const description = (product.description || '').trim() || null
        const productData = {
          tenant_id: tenantId,
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
          product
        })
      }
    }

    if (productsToInsert.length > 0) {
      try {
        const inserted = await this.repository.bulkCreate(productsToInsert)

        let insertIndex = 0
        for (let i = 0; i < results.length; i++) {
          if (results[i].success) {
            results[i].product = inserted[insertIndex]
            insertIndex++
          }
        }
      } catch (error) {
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

  async createCategory(tenantId, data) {
    const existing = await this.repository.findCategoryByName(tenantId, data.name)
    if (existing) {
      throw new Error(`Category "${data.name}" already exists`)
    }

    const category = await this.repository.createCategory({
      tenant_id: tenantId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      sync_status: 'pending'
    })
    return category
  }

  async createUnit(tenantId, data) {
    const existing = await this.repository.findUnitByName(tenantId, data.name)
    if (existing) {
      throw new Error(`Unit "${data.name}" already exists`)
    }

    const unit = await this.repository.createUnit({
      tenant_id: tenantId,
      name: data.name.trim(),
      abbreviation: data.abbreviation?.trim() || null,
      sync_status: 'pending'
    })
    return unit
  }

  async getAllCategories(tenantId) {
    return this.repository.getAllCategories(tenantId)
  }

  async getAllUnits(tenantId) {
    return this.repository.getAllUnits(tenantId)
  }

  async findCategoryByName(tenantId, name) {
    return this.repository.findCategoryByName(tenantId, name)
  }

  async findUnitByName(tenantId, name) {
    return this.repository.findUnitByName(tenantId, name)
  }

  async createProduct(tenantId, data) {
    const existing = await this.repository.findByName(tenantId, data.name)
    if (existing) {
      throw new Error(`Product "${data.name}" already exists`)
    }

    if (data.category_id != null) {
      const category = await this.repository.findCategoryById(tenantId, data.category_id)
      if (!category) {
        throw new Error('Invalid category ID')
      }
    }

    if (data.unit_id != null) {
      const unit = await this.repository.findUnitById(tenantId, data.unit_id)
      if (!unit) {
        throw new Error('Invalid unit ID')
      }
    }

    const nextCodeNum = await this.repository.getMaxProductCodeNumber(tenantId)
    const productCode = `PRD${String(nextCodeNum + 1).padStart(4, '0')}`

    const productData = {
      tenant_id: tenantId,
      product_code: productCode,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category_id: data.category_id ?? null,
      unit_id: data.unit_id ?? null,
      remark: data.remark?.trim() || null,
      expiry_threshold: data.expiry_threshold ?? 30,
      sync_status: 'pending'
    }

    const result = await this.repository.create(productData)
    const createdProduct = Array.isArray(result) ? result[0] : result

    if (!createdProduct || !createdProduct.id) {
      throw new Error('Product creation failed: No product returned from database')
    }

    return createdProduct
  }

  async updateProduct(tenantId, id, data) {
    const existing = await this.repository.findById(tenantId, id)
    if (!existing) {
      const err = new Error(`Product with ID ${id} not found`)
      err.status = 404
      throw err
    }

    if (data.name && data.name.trim() !== existing.name) {
      const duplicate = await this.repository.findByName(tenantId, data.name.trim())
      if (duplicate && duplicate.id !== id) {
        throw new Error(`Product "${data.name}" already exists`)
      }
    }

    if (Object.hasOwn(data, 'category_id') && data.category_id != null) {
      const category = await this.repository.findCategoryById(tenantId, data.category_id)
      if (!category) {
        throw new Error('Invalid category ID')
      }
    }

    if (Object.hasOwn(data, 'unit_id') && data.unit_id != null) {
      const unit = await this.repository.findUnitById(tenantId, data.unit_id)
      if (!unit) {
        throw new Error('Invalid unit ID')
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

    await this.repository.update(tenantId, id, updateData)
    return this.repository.findById(tenantId, id)
  }

  async deleteProduct(tenantId, id) {
    const existing = await this.repository.findById(tenantId, id)
    if (!existing) {
      throw new Error(`Product with ID ${id} not found`)
    }

    await this.repository.delete(tenantId, id)
    return true
  }
}
