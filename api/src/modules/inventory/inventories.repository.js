/**
 * Repository: Data access layer for inventories/stock
 * Encapsulates all database queries for inventories table
 */
import { LedgerHelper } from '../../services/ledger.helper.js'

export class InventoriesRepository {
  constructor(knex) {
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  /**
   * Get the last balance for a product from bin cards
   * Returns the most recent balance for the product, or 0 if no transactions exist
   */
  async getLastProductBalance(productId, trx = null) {
    const db = trx || this.knex
    const lastTransaction = await db('bin_cards')
      .where({ product_id: productId })
      .orderBy('transaction_date', 'desc')
      .orderBy('id', 'desc')
      .select('balance')
      .first()
    
    return lastTransaction ? parseInt(lastTransaction.balance, 10) : 0
  }

  /**
   * Create a bin card transaction (supports both import and adjustment)
   * @param {Object} params - Transaction parameters
   * @returns {Object} Created bin card transaction
   */
  async createBinCardTransaction(params, trx = null) {
    const {
      productId,
      inventoryId,
      batchNo,
      expiryDate,
      transactionDate,
      quantity,
      unitCost,
      openingBalance,
      reason,
      notes,
      createdBy,
      transactionType = 'received',
      quantityIn = null,
      quantityOut = null,
      balance = null,
      partnerId = null
    } = params

    const db = trx || this.knex

    // Calculate values if not provided (backward compatibility for import)
    const finalQuantityIn = quantityIn !== null ? quantityIn : (transactionType === 'received' ? quantity : 0)
    const finalQuantityOut = quantityOut !== null ? quantityOut : (transactionType === 'issued' ? quantity : 0)
    const finalBalance = balance !== null ? balance : (openingBalance + finalQuantityIn - finalQuantityOut)
    const totalCost = finalQuantityIn * unitCost

    const [binCard] = await db('bin_cards')
      .insert({
        product_id: productId,
        inventory_id: inventoryId,
        batch_no: batchNo || null,
        expiry_date: expiryDate || null,
        transaction_date: transactionDate,
        transaction_type: transactionType,
        reference_id: inventoryId,
        reference_table: 'inventories',
        opening_balance: openingBalance,
        quantity_in: finalQuantityIn,
        quantity_out: finalQuantityOut,
        balance: finalBalance,
        unit_cost: unitCost,
        total_cost: totalCost,
        reason: reason || 'Stock Transaction',
        notes: notes || (transactionType === 'received' ? `Bulk import - ${reason || 'Stock Import'}` : null),
        created_by: createdBy || null,
        created_at: db.fn.now(),
        last_updated: db.fn.now()
      })
      .returning('*')

    return binCard
  }

  /**
   * Find product by product code
   */
  async findProductByCode(productCode) {
    return this.knex('products').where({ product_code: productCode }).first()
  }

  /**
   * Find product by name
   */
  async findProductByName(name) {
    return this.knex('products')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first()
  }

  /**
   * Get default category id for auto-created products (supplies or first category).
   * @param {Object} trx - Optional knex transaction
   */
  async getDefaultCategoryId(trx = null) {
    const db = trx || this.knex
    const byName = await db('categories').whereRaw('LOWER(name) = ?', ['supplies']).select('id').first()
    if (byName) return byName.id
    const first = await db('categories').select('id').limit(1).first()
    return first ? first.id : null
  }

  /**
   * Get default unit id for auto-created products (bottle or first unit).
   * @param {Object} trx - Optional knex transaction
   */
  async getDefaultUnitId(trx = null) {
    const db = trx || this.knex
    const byName = await db('units').whereRaw('LOWER(name) = ?', ['bottle']).select('id').first()
    if (byName) return byName.id
    const first = await db('units').select('id').limit(1).first()
    return first ? first.id : null
  }

  /**
   * Resolve category id by name; create category when missing.
   * Falls back to default category when name is not provided.
   */
  async resolveCategoryId(categoryName, trx = null) {
    const db = trx || this.knex
    const normalized = String(categoryName || '').trim()
    if (!normalized) return this.getDefaultCategoryId(trx)

    const existing = await db('categories')
      .whereRaw('LOWER(name) = LOWER(?)', [normalized])
      .select('id')
      .first()
    if (existing) return existing.id

    const [created] = await db('categories')
      .insert({
        name: normalized,
        created_at: db.fn.now(),
        last_updated: db.fn.now()
      })
      .returning('id')
    return created?.id || created
  }

  /**
   * Resolve unit id by name; create unit when missing.
   * Falls back to default unit when name is not provided.
   */
  async resolveUnitId(unitName, trx = null) {
    const db = trx || this.knex
    const normalized = String(unitName || '').trim()
    if (!normalized) return this.getDefaultUnitId(trx)

    const existing = await db('units')
      .whereRaw('LOWER(name) = LOWER(?)', [normalized])
      .select('id')
      .first()
    if (existing) return existing.id

    const [created] = await db('units')
      .insert({
        name: normalized,
        created_at: db.fn.now(),
        last_updated: db.fn.now()
      })
      .returning('id')
    return created?.id || created
  }

  /**
   * Get next available product code (PRD0001, PRD0002, ...) for auto-created products.
   * @param {Object} trx - Optional knex transaction
   */
  async getNextProductCode(trx = null) {
    const db = trx || this.knex
    const products = await db('products')
      .select('product_code')
      .whereNotNull('product_code')
      .where('product_code', 'like', 'PRD%')
      .orderBy('id', 'desc')
      .limit(1000)
    let maxNum = 0
    for (const p of products) {
      const code = p.product_code
      if (code && code.startsWith('PRD')) {
        const num = parseInt(code.substring(3), 10)
        if (!isNaN(num) && num > maxNum) maxNum = num
      }
    }
    return `PRD${String(maxNum + 1).padStart(4, '0')}`
  }

  /**
   * Find existing inventory record by product and variation details
   * Checks for existing record with same product_id, batch_no, expiry_date, purchase_price
   */
  async findExistingInventory(productId, batchNo, expiryDate, purchasePrice, trx = null) {
    const db = trx || this.knex
    let query = db('inventories')
      .where({ product_id: productId })
      .where({ purchase_price: purchasePrice })

    if (batchNo) {
      query = query.where({ batch_no: batchNo })
    } else {
      query = query.whereNull('batch_no')
    }

    if (expiryDate) {
      query = query.where({ expiry_date: expiryDate })
    } else {
      query = query.whereNull('expiry_date')
    }

    return query.first()
  }

  /**
   * Get the maximum variation number for a product
   * Extracts the numeric part from inventory_code pattern 'I###XXXX'
   * where ### is the variation number and XXXX is the 4-digit product code
   */
  async getMaxVariationNumber(productCode, trx = null) {
    const db = trx || this.knex
    // Extract 4 digits from product code (e.g., 'PRD0011' -> '0011')
    const productCodeDigits = this.extractProductCodeDigits(productCode)
    if (!productCodeDigits) {
      return 0
    }

    // Find all inventory codes for this product that match pattern 'I###XXXX'
    const inventories = await db('inventories')
      .join('products', 'inventories.product_id', 'products.id')
      .where('products.product_code', productCode)
      .where('inventories.inventory_code', 'like', `I%${productCodeDigits}`)
      .select('inventories.inventory_code')

    if (inventories.length === 0) {
      return 0
    }

    // Extract variation numbers and find the maximum
    let maxVariation = 0
    for (const inv of inventories) {
      const code = inv.inventory_code
      if (code && code.startsWith('I') && code.endsWith(productCodeDigits)) {
        // Extract the middle part (###)
        const variationPart = code.slice(1, -4) // Remove 'I' prefix and 4-digit suffix
        const variationNum = parseInt(variationPart, 10)
        if (!isNaN(variationNum) && variationNum > maxVariation) {
          maxVariation = variationNum
        }
      }
    }

    return maxVariation
  }

  /**
   * Extract 4 digits from product code
   * Handles formats like 'PRD0011', '0011', 'PRD11' -> '0011'
   */
  extractProductCodeDigits(productCode) {
    if (!productCode) return null
    
    // Extract all digits from the product code
    const digits = productCode.match(/\d+/g)
    if (!digits || digits.length === 0) return null
    
    // Get the last sequence of digits (usually the numeric part)
    const lastDigits = digits[digits.length - 1]
    
    // Pad to 4 digits if needed
    return lastDigits.padStart(4, '0').slice(-4)
  }

  /**
   * Generate inventory code for a product variation
   * Format: 'I###XXXX' where ### is variation number (001, 002, etc.) and XXXX is 4-digit product code
   */
  async generateInventoryCode(productCode, trx = null) {
    const productCodeDigits = this.extractProductCodeDigits(productCode)
    if (!productCodeDigits) {
      throw new Error(`Invalid product code format: ${productCode}`)
    }

    const maxVariation = await this.getMaxVariationNumber(productCode, trx)
    const nextVariation = maxVariation + 1
    
    // Format variation number as 3-digit string (001, 002, ..., 999)
    const variationStr = String(nextVariation).padStart(3, '0')
    
    return `I${variationStr}${productCodeDigits}`
  }

  /**
   * Bulk import stock items
   * @param {Array} stockItems - Array of stock items to import
   * @param {Object} options - Import options (e.g., purchase_date, reason, created_by)
   * @returns {Object} - { successful: [], failed: [], summary: {...} }
   */
  async bulkImport(stockItems, options = {}) {
    const successful = []
    const failed = []
    const purchaseDate = options.purchase_date || new Date().toISOString().split('T')[0]
    const reason = (options.reason || 'Bulk Import').trim()
    const createdBy = options.created_by || null

    // Validate reason - reject 'other' reason (not yet implemented)
    const reasonLower = reason.toLowerCase()
    if (reasonLower === 'other') {
      throw new Error('Import with "other" reason is not yet implemented. Please use "initial stock" for now.')
    }

    // Only "initial stock" is currently supported
    const isInitialStock = reasonLower === 'initial stock'

    for (let i = 0; i < stockItems.length; i++) {
      const item = stockItems[i]
      
      try {
        // Validate required fields
        if (!item.product_name || !item.quantity || !item.unit_cost) {
          failed.push({
            index: i,
            item,
            error: 'Missing required fields: product_name, quantity, or unit_cost'
          })
          continue
        }

        // Wrap each item's processing in its own transaction for atomicity
        await this.knex.transaction(async (trx) => {
          // Find product by code or name
          let product = null
          if (item.product_code && String(item.product_code).trim()) {
            product = await trx('products').where({ product_code: String(item.product_code).trim() }).first()
          }
          if (!product && item.product_name) {
            product = await trx('products')
              .whereRaw('LOWER(name) = LOWER(?)', [item.product_name.trim()])
              .first()
          }

          // If product not found, create it so stock import works without pre-importing products
          if (!product) {
            const categoryId = await this.resolveCategoryId(item.category, trx)
            const unitId = await this.resolveUnitId(item.unit, trx)
            if (categoryId == null || unitId == null) {
              throw new Error('Cannot auto-create product: no categories or units in database. Import products first or add a category and unit.')
            }
            let productCode = (item.product_code && String(item.product_code).trim()) ? String(item.product_code).trim() : null
            if (productCode) {
              const existingByCode = await trx('products').where({ product_code: productCode }).first()
              if (existingByCode) product = existingByCode
            }
            if (!product) {
              if (!productCode) productCode = await this.getNextProductCode(trx)
              const [created] = await trx('products')
                .insert({
                  name: item.product_name.trim(),
                  product_code: productCode,
                  category_id: categoryId,
                  unit_id: unitId,
                  description: null,
                  remark: null,
                  sync_status: 'pending'
                })
                .returning('*')
              product = created
            }
          }

          // Check if inventory record already exists with same variation
          const existing = await this.findExistingInventory(
            product.id,
            item.batch_number || null,
            item.expiry_date || null,
            parseFloat(item.unit_cost),
            trx
          )

          let inventoryCode
          let inventoryId
          let quantityAdded = parseInt(item.quantity)
          let purchasePrice = parseFloat(item.unit_cost)

          if (existing) {
            // Use existing inventory code
            inventoryCode = existing.inventory_code
            inventoryId = existing.id
            
            // Update quantity (add to existing)
            await trx('inventories')
              .where({ id: existing.id })
              .update({
                quantity: trx.raw('quantity + ?', [quantityAdded]),
                last_updated: trx.fn.now()
              })
          } else {
            // Generate new inventory code
            inventoryCode = await this.generateInventoryCode(product.product_code, trx)
            
            // Insert new inventory record
            const [inserted] = await trx('inventories')
              .insert({
                product_id: product.id,
                inventory_code: inventoryCode,
                batch_no: item.batch_number || null,
                expiry_date: item.expiry_date || null,
                purchase_date: purchaseDate,
                acquisition_type: options.acquisition_type || 'cash', // Use provided type or default to 'cash'
                purchase_price: purchasePrice,
                quantity: quantityAdded,
                selling_price: item.selling_price ? parseFloat(item.selling_price) : null,
                location: item.location || null,
                notes: reason,
                created_at: trx.fn.now(),
                last_updated: trx.fn.now()
              })
              .returning('id')
            
            inventoryId = inserted.id || inserted
          }

          // Get opening balance for bin card transaction
          const openingBalance = await this.getLastProductBalance(product.id, trx)

          // Create bin card transaction for this import
          await this.createBinCardTransaction({
            productId: product.id,
            inventoryId: inventoryId,
            batchNo: item.batch_number || null,
            expiryDate: item.expiry_date || null,
            transactionDate: purchaseDate,
            quantity: quantityAdded,
            unitCost: purchasePrice,
            openingBalance: openingBalance,
            reason: reason,
            createdBy: createdBy
          }, trx)

          // Create ledger entry for initial stock import (within transaction)
          if (isInitialStock) {
            await this.ledgerHelper.recordInitialStockImport({
              inventoryId: inventoryId,
              quantity: quantityAdded,
              unitCost: purchasePrice,
              transactionDate: purchaseDate,
              referenceNumber: `INIT-${inventoryCode}`,
              memo: `Initial stock import - ${reason}`,
              createdBy: createdBy
            }, trx)
          }

          // If we reach here, transaction will commit
          successful.push({
            index: i,
            item,
            inventory_id: inventoryId,
            inventory_code: inventoryCode,
            product_id: product.id,
            product_code: product.product_code
          })
        })

      } catch (error) {
        failed.push({
          index: i,
          item,
          error: error.message || 'Unknown error during import'
        })
      }
    }

    return {
      successful,
      failed,
      summary: {
        total: stockItems.length,
        successful: successful.length,
        failed: failed.length
      }
    }
  }

  /** Default low-stock threshold: total quantity (across all batches) below this = low stock. Later: system_settings or per-product. */
  static get DEFAULT_LOW_STOCK_THRESHOLD() { return 50 }
  /** Default high-value threshold (unit cost). Later: system_settings. */
  static get DEFAULT_HIGH_VALUE_THRESHOLD() { return 1000 }
  /** Default expiry threshold (days). Per-product expiry_threshold overrides this. */
  static get DEFAULT_EXPIRY_THRESHOLD() { return 30 }

  /**
   * Calculate constant stats from ALL inventory items (regardless of filter)
   * Low stock = count of PRODUCTS whose total quantity (sum of all batches) < threshold.
   * Out of stock = count of products with zero total quantity.
   * @returns {Object} Statistics object matching frontend expectations
   */
  async calculateConstantStats() {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const DEFAULT_EXPIRY_THRESHOLD = InventoriesRepository.DEFAULT_EXPIRY_THRESHOLD
    const HIGH_VALUE_THRESHOLD = InventoriesRepository.DEFAULT_HIGH_VALUE_THRESHOLD
    const LOW_STOCK_THRESHOLD = InventoriesRepository.DEFAULT_LOW_STOCK_THRESHOLD

    // Product-level totals: total quantity per product (sum across batches)
    const productTotals = await this.knex('inventories')
      .select('product_id')
      .sum('quantity as total_quantity')
      .groupBy('product_id')

    const productTotalById = new Map()
    let outOfStock = 0
    let lowStock = 0
    productTotals.forEach(row => {
      const total = parseInt(row.total_quantity || 0, 10)
      productTotalById.set(Number(row.product_id), total)
      if (total === 0) outOfStock++
      else if (total < LOW_STOCK_THRESHOLD) lowStock++
    })

    const allInventory = await this.knex('inventories')
      .select(
        'inventories.quantity',
        'inventories.purchase_price',
        'inventories.expiry_date',
        'products.expiry_threshold'
      )
      .leftJoin('products', 'inventories.product_id', 'products.id')

    let total = 0
    let expiringSoon = 0
    let expired = 0
    let highValue = 0
    let totalCost = 0
    let itemsWithStock = 0
    let totalQuantity = 0

    allInventory.forEach(item => {
      total++
      const quantity = parseInt(item.quantity || 0, 10)
      const purchasePrice = parseFloat(item.purchase_price || 0)
      totalCost += quantity * purchasePrice
      totalQuantity += quantity
      if (quantity > 0) itemsWithStock++

      if (purchasePrice >= HIGH_VALUE_THRESHOLD) highValue++

      // Only batches with a valid expiry_date count as expired or expiring soon; null expiry is excluded
      if (item.expiry_date) {
        const expiry = new Date(item.expiry_date)
        const expiryDateStr = expiry.toISOString().split('T')[0]
        const expiryThreshold = item.expiry_threshold || DEFAULT_EXPIRY_THRESHOLD
        if (expiryDateStr < todayStr) expired++
        else {
          const thresholdDate = new Date(today)
          thresholdDate.setDate(today.getDate() + expiryThreshold)
          const thresholdDateStr = thresholdDate.toISOString().split('T')[0]
          if (expiryDateStr <= thresholdDateStr) expiringSoon++
        }
      }
    })

    // Count active borrowed items
    let borrowedFrom = 0
    let borrowedTo = 0
    
    const borrowFromTableExists = await this.knex.schema.hasTable('borrow_from_inventories')
    if (borrowFromTableExists) {
      const borrowFromCount = await this.knex('borrow_from_inventories')
        .where('status', 'active')
        .count('id as total')
        .first()
      borrowedFrom = parseInt(borrowFromCount?.total || 0, 10)
    }

    const borrowToTableExists = await this.knex.schema.hasTable('borrow_to_inventories')
    if (borrowToTableExists) {
      const borrowToCount = await this.knex('borrow_to_inventories')
        .where('status', 'active')
        .count('id as total')
        .first()
      borrowedTo = parseInt(borrowToCount?.total || 0, 10)
    }

    return {
      total,
      outOfStock,
      lowStock,
      expiringSoon,
      expired,
      borrowedFrom,
      borrowedTo,
      highValue,
      // Additional meaningful stats for 'all' filter
      totalCost,
      itemsWithStock,
      totalQuantity
    }
  }

  /**
   * Find all borrow_from_inventories (all statuses except fully 'returned', or all if includeReturned=true)
   * Shows which ones are returned and which ones still remain to be settled.
   * @param {Object} params - { limit, offset, search, sortBy, orderBy, includeReturned }
   * @returns {Object} - { stock, total }
   */
  async findBorrowedFrom(params = {}) {
    const { 
      limit = 10, 
      offset = 0, 
      search = '', 
      sortBy = 'id', 
      orderBy = 'desc',
      includeReturned = true // Show all including returned by default
    } = params

    // Check if table exists
    const tableExists = await this.knex.schema.hasTable('borrow_from_inventories')
    if (!tableExists) {
      return { stock: [], total: 0 }
    }

    let query = this.knex('borrow_from_inventories')
      .select(
        'borrow_from_inventories.*',
        'borrow_from_inventories.inventory_id',
        'borrow_from_inventories.status',
        'products.product_code',
        'products.name as product_name',
        'products.description as product_description',
        'categories.name as category',
        'units.name as unit',
        'customers.name as partner_name'
      )
      .leftJoin('products', 'borrow_from_inventories.product_id', 'products.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .leftJoin('units', 'products.unit_id', 'units.id')
      .leftJoin('customers', 'borrow_from_inventories.partner_id', 'customers.id')
    
    // Filter: show all statuses if includeReturned=true, otherwise exclude fully 'returned'
    if (!includeReturned) {
      query = query.where('borrow_from_inventories.status', '!=', 'returned')
    }
    // Otherwise show all (active, partially_returned, returned)

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.where(function() {
        this.whereRaw('LOWER(products.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(products.product_code) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(customers.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(borrow_from_inventories.batch_no) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(categories.name) LIKE ?', [searchTerm.toLowerCase()])
      })
    }

    // Get total count
    const countQuery = query.clone().clearSelect().clearOrder().countDistinct('borrow_from_inventories.id as total').first()
    const { total } = await countQuery

    // Apply sorting
    const validSortBy = ['id', 'product_code', 'product_name', 'quantity', 'unit_cost', 'expiry_date', 'borrowed_date']
    const validOrderBy = ['asc', 'desc']
    const sortColumn = validSortBy.includes(sortBy) ? sortBy : 'id'
    const order = validOrderBy.includes(orderBy.toLowerCase()) ? orderBy.toLowerCase() : 'desc'

    const sortColumnMap = {
      'id': 'borrow_from_inventories.id',
      'product_code': 'products.product_code',
      'product_name': 'products.name',
      'quantity': 'borrow_from_inventories.quantity',
      'unit_cost': 'borrow_from_inventories.unit_cost',
      'expiry_date': 'borrow_from_inventories.expiry_date',
      'borrowed_date': 'borrow_from_inventories.borrowed_date'
    }

    query = query.orderBy(sortColumnMap[sortColumn] || 'borrow_from_inventories.id', order)
    query = query.limit(limit).offset(offset)

    const results = await query

    // Check if borrow_from_returns table exists for calculating return status
    const returnsTableExists = await this.knex.schema.hasTable('borrow_from_returns')
    
    // Fetch all return data in one query for performance
    let returnDataMap = new Map() // Map<inventoryId, totalReturned>
    if (returnsTableExists && results.length > 0) {
      const inventoryIds = results
        .map(r => r.inventory_id)
        .filter(id => id != null)
        .map(id => Number(id))
      
      if (inventoryIds.length > 0) {
        const returnRows = await this.knex('borrow_from_returns')
          .whereIn('borrowed_inventory_id', inventoryIds)
          .select('borrowed_inventory_id', 'quantity_returned')
        
        // Aggregate returns by inventory_id
        returnRows.forEach(row => {
          const invId = Number(row.borrowed_inventory_id)
          const qty = parseInt(row.quantity_returned || 0, 10)
          returnDataMap.set(invId, (returnDataMap.get(invId) || 0) + qty)
        })
      }
    }

    // Transform to match stock item format and calculate return status for each item
    const transformedStock = results.map((item) => {
      const inventoryId = item.inventory_id ? Number(item.inventory_id) : null
      const totalBorrowed = parseInt(item.quantity, 10) || 0
      const totalReturned = inventoryId ? (returnDataMap.get(inventoryId) || 0) : 0
      const remaining = Math.max(0, totalBorrowed - totalReturned)
      const borrowStatus = item.status || 'active' // 'active', 'partially_returned', 'returned'
      
      return {
        id: item.id,
        borrowFromId: item.id, // borrow_from_inventories id
        inventoryId: inventoryId, // link to inventories for returns
        productId: item.product_id,
        inventoryCode: null, // Not applicable for borrowed items
        productCode: item.product_code,
        name: item.product_name,
        category: item.category,
        location: item.location,
        quantity: totalBorrowed, // Original borrowed quantity
        unit: item.unit,
        unitCost: parseFloat(item.unit_cost),
        sellingPrice: item.selling_price ? parseFloat(item.selling_price) : null,
        expiryDate: item.expiry_date,
        batchNumber: item.batch_no,
        status: 'borrowed-from', // UI status for filtering
        borrowStatus: borrowStatus, // Actual borrow status: 'active', 'partially_returned', 'returned'
        expiry_threshold: 30, // Default, can be enhanced later
        product: {
          expiry_threshold: 30
        },
        // Additional borrow-specific fields
        partnerId: item.partner_id,
        partnerName: item.partner_name,
        borrowedDate: item.borrowed_date,
        expectedReturnDate: item.expected_return_date,
        notes: item.notes,
        documentNo: item.document_no,
        // Return status information
        totalBorrowed: totalBorrowed,
        totalReturned: totalReturned,
        remaining: remaining
      }
    })

    return {
      stock: transformedStock,
      total: parseInt(total || 0, 10)
    }
  }

  /**
   * Find all borrow_to_inventories (all statuses except fully 'returned', or all if includeReturned=true)
   * Shows which ones are returned and which ones still remain to be settled.
   * @param {Object} params - { limit, offset, search, sortBy, orderBy, includeReturned }
   * @returns {Object} - { stock, total }
   */
  async findBorrowedTo(params = {}) {
    const { 
      limit = 10, 
      offset = 0, 
      search = '', 
      sortBy = 'id', 
      orderBy = 'desc',
      includeReturned = true // Show all including returned by default
    } = params

    // Check if table exists
    const tableExists = await this.knex.schema.hasTable('borrow_to_inventories')
    if (!tableExists) {
      return { stock: [], total: 0 }
    }

    let query = this.knex('borrow_to_inventories')
      .select(
        'borrow_to_inventories.*',
        'borrow_to_inventories.status',
        'products.product_code',
        'products.name as product_name',
        'products.description as product_description',
        'categories.name as category',
        'units.name as unit',
        'customers.name as partner_name',
        'inventories.inventory_code as source_inventory_code',
        'inventories.id as source_inventory_id'
      )
      .leftJoin('products', 'borrow_to_inventories.product_id', 'products.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .leftJoin('units', 'products.unit_id', 'units.id')
      .leftJoin('customers', 'borrow_to_inventories.partner_id', 'customers.id')
      .leftJoin('inventories', 'borrow_to_inventories.source_inventory_id', 'inventories.id')
    
    // Filter: show all statuses if includeReturned=true, otherwise exclude fully 'returned'
    if (!includeReturned) {
      query = query.where('borrow_to_inventories.status', '!=', 'returned')
    }
    // Otherwise show all (active, partially_returned, returned)

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.where(function() {
        this.whereRaw('LOWER(products.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(products.product_code) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(customers.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(borrow_to_inventories.batch_no) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(categories.name) LIKE ?', [searchTerm.toLowerCase()])
      })
    }

    // Get total count
    const countQuery = query.clone().clearSelect().clearOrder().countDistinct('borrow_to_inventories.id as total').first()
    const { total } = await countQuery

    // Apply sorting
    const validSortBy = ['id', 'product_code', 'product_name', 'quantity', 'unit_cost', 'expiry_date', 'lent_date']
    const validOrderBy = ['asc', 'desc']
    const sortColumn = validSortBy.includes(sortBy) ? sortBy : 'id'
    const order = validOrderBy.includes(orderBy.toLowerCase()) ? orderBy.toLowerCase() : 'desc'

    const sortColumnMap = {
      'id': 'borrow_to_inventories.id',
      'product_code': 'products.product_code',
      'product_name': 'products.name',
      'quantity': 'borrow_to_inventories.quantity',
      'unit_cost': 'borrow_to_inventories.unit_cost',
      'expiry_date': 'borrow_to_inventories.expiry_date',
      'lent_date': 'borrow_to_inventories.lent_date'
    }

    query = query.orderBy(sortColumnMap[sortColumn] || 'borrow_to_inventories.id', order)
    query = query.limit(limit).offset(offset)

    const results = await query

    // Check if borrow_to_returns table exists for calculating return status
    const returnsTableExists = await this.knex.schema.hasTable('borrow_to_returns')
    
    // Fetch all return data in one query for performance
    let returnDataMap = new Map() // Map<borrowToInventoryId, totalReturned>
    if (returnsTableExists && results.length > 0) {
      const borrowToIds = results
        .map(r => r.id)
        .filter(id => id != null)
        .map(id => Number(id))
      
      if (borrowToIds.length > 0) {
        const returnRows = await this.knex('borrow_to_returns')
          .whereIn('borrow_to_inventory_id', borrowToIds)
          .select('borrow_to_inventory_id', 'quantity_returned')
        
        // Aggregate returns by borrow_to_inventory_id
        returnRows.forEach(row => {
          const borrowToId = Number(row.borrow_to_inventory_id)
          const qty = parseInt(row.quantity_returned || 0, 10)
          returnDataMap.set(borrowToId, (returnDataMap.get(borrowToId) || 0) + qty)
        })
      }
    }

    // Transform to match stock item format and calculate return status for each item
    const transformedStock = results.map((item) => {
      const borrowToId = Number(item.id)
      const totalBorrowed = parseInt(item.quantity, 10) || 0
      const totalReturned = returnDataMap.get(borrowToId) || 0
      const remaining = Math.max(0, totalBorrowed - totalReturned)
      const borrowStatus = item.status || 'active' // 'active', 'partially_returned', 'returned'
      
      return {
        id: item.id,
        borrowToId: item.id, // borrow_to_inventories id
        productId: item.product_id,
        sourceInventoryId: item.source_inventory_id,
        inventoryCode: item.source_inventory_code,
        productCode: item.product_code,
        name: item.product_name,
        category: item.category,
        location: null, // Not stored in borrow_to_inventories
        quantity: totalBorrowed, // Original lent quantity
        unit: item.unit,
        unitCost: parseFloat(item.unit_cost),
        sellingPrice: item.selling_price ? parseFloat(item.selling_price) : null,
        expiryDate: item.expiry_date,
        batchNumber: item.batch_no,
        status: 'borrowed-to', // UI status for filtering
        borrowStatus: borrowStatus, // Actual borrow status: 'active', 'partially_returned', 'returned'
        expiry_threshold: 30, // Default, can be enhanced later
        product: {
          expiry_threshold: 30
        },
        // Additional borrow-specific fields
        partnerId: item.partner_id,
        partnerName: item.partner_name,
        lentDate: item.lent_date,
        expectedReturnDate: item.expected_return_date,
        notes: item.notes,
        documentNo: item.document_no,
        // Return status fields
        totalBorrowed: totalBorrowed,
        totalReturned: totalReturned,
        remaining: remaining
      }
    })

    return {
      stock: transformedStock,
      total: parseInt(total || 0, 10)
    }
  }

  /**
   * Find all inventories/stock with pagination, search, and sorting
   * For 'borrowed-from' and 'borrowed-to' filters, fetches directly from respective borrow tables
   * For other filters, queries from inventories table
   * @param {Object} params - { limit, offset, search, filter, sortBy, orderBy }
   * @returns {Object} - { stock, total, stats }
   */
  async findAll(params = {}) {
    const { 
      limit = 10, 
      offset = 0, 
      search = '', 
      filter = 'all',
      sortBy = 'id', 
      orderBy = 'desc' 
    } = params

    // Calculate constant stats from ALL inventory items (regardless of filter)
    const constantStats = await this.calculateConstantStats()

    // Handle borrowed-from filter - fetch directly from borrow_from_inventories table
    if (filter === 'borrowed-from') {
      const result = await this.findBorrowedFrom({ limit, offset, search, sortBy, orderBy })
      return {
        stock: result.stock,
        total: result.total,
        stats: constantStats // Always return constant stats regardless of filter
      }
    }

    // Handle borrowed-to filter - fetch directly from borrow_to_inventories table
    if (filter === 'borrowed-to') {
      const result = await this.findBorrowedTo({ limit, offset, search, sortBy, orderBy })
      return {
        stock: result.stock,
        total: result.total,
        stats: constantStats // Always return constant stats regardless of filter
      }
    }

    // Subquery: total quantity per product (sum across all batches)
    const productTotalsSubquery = this.knex('inventories')
      .select('product_id')
      .sum('quantity as product_total')
      .groupBy('product_id')
      .as('product_totals')

    // Base query with joins for product, category, unit, and product total quantity
    // Exclude zero-quantity rows so the stock table only shows batches that have stock
    let query = this.knex('inventories')
      .select(
        'inventories.*',
        'products.product_code',
        'products.name as product_name',
        'products.description as product_description',
        'products.expiry_threshold as product_expiry_threshold',
        'categories.name as category',
        'units.name as unit',
        'product_totals.product_total'
      )
      .leftJoin('products', 'inventories.product_id', 'products.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .leftJoin('units', 'products.unit_id', 'units.id')
      .leftJoin(productTotalsSubquery, 'inventories.product_id', 'product_totals.product_id')
      .where('inventories.quantity', '>', 0)

    // Apply search filter
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.where(function() {
        this.whereRaw('LOWER(products.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(products.product_code) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(inventories.inventory_code) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(inventories.location) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(categories.name) LIKE ?', [searchTerm.toLowerCase()])
      })
    }

    const LOW_STOCK_THRESHOLD = InventoriesRepository.DEFAULT_LOW_STOCK_THRESHOLD
    const HIGH_VALUE_THRESHOLD = InventoriesRepository.DEFAULT_HIGH_VALUE_THRESHOLD

    // Apply other filters (not borrowed-from/borrowed-to, those are handled above)
    if (filter !== 'all' && filter !== 'borrowed-from' && filter !== 'borrowed-to') {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      query = query.where(function() {
        if (filter === 'out-of-stock') {
          this.where('inventories.quantity', 0)
        } else if (filter === 'expired') {
          // Only batches with a valid expiry_date; null expiry is excluded
          this.whereNotNull('inventories.expiry_date')
            .where('inventories.expiry_date', '<', todayStr)
        } else if (filter === 'expiring-soon') {
          // Only batches with valid expiry_date; use product-level expiry_threshold (days)
          this.whereNotNull('inventories.expiry_date')
            .where('inventories.expiry_date', '>=', todayStr)
            .whereRaw(
              `DATE(inventories.expiry_date) <= DATE(?, '+' || COALESCE(products.expiry_threshold, ?) || ' days')`,
              [todayStr, InventoriesRepository.DEFAULT_EXPIRY_THRESHOLD]
            )
        } else if (filter === 'high-value') {
          this.where('inventories.purchase_price', '>=', HIGH_VALUE_THRESHOLD)
        }
      })
    }

    // Get total count before pagination
    const countQuery = query.clone().clearSelect().clearOrder().countDistinct('inventories.id as total').first()
    const { total } = await countQuery

    // Apply sorting
    const validSortBy = ['id', 'inventory_code', 'product_code', 'product_name', 'location', 'quantity', 'purchase_price', 'expiry_date', 'created_at']
    const validOrderBy = ['asc', 'desc']
    const sortColumn = validSortBy.includes(sortBy) ? sortBy : 'id'
    const order = validOrderBy.includes(orderBy.toLowerCase()) ? orderBy.toLowerCase() : 'desc'

    // Map sortBy to actual column names
    const sortColumnMap = {
      'id': 'inventories.id',
      'inventory_code': 'inventories.inventory_code',
      'product_code': 'products.product_code',
      'product_name': 'products.name',
      'location': 'inventories.location',
      'quantity': 'inventories.quantity',
      'purchase_price': 'inventories.purchase_price',
      'expiry_date': 'inventories.expiry_date',
      'created_at': 'inventories.created_at'
    }

    query = query.orderBy(sortColumnMap[sortColumn] || 'inventories.id', order)

    // Apply pagination
    query = query.limit(limit).offset(offset)

    const stock = await query

    // Transform to frontend format. Status and low-stock are based on product total quantity (all batches).
    const transformedStock = stock.map(item => {
      const productTotal = parseInt(item.product_total || 0, 10)
      const quantity = parseInt(item.quantity, 10)
      const expiryThreshold = item.product_expiry_threshold != null ? parseInt(item.product_expiry_threshold, 10) : InventoriesRepository.DEFAULT_EXPIRY_THRESHOLD
      const status = productTotal === 0 ? 'out-of-stock' : (productTotal < LOW_STOCK_THRESHOLD ? 'low-stock' : 'active')
      return {
        id: item.id,
        productId: item.product_id,
        inventoryCode: item.inventory_code,
        productCode: item.product_code,
        name: item.product_name,
        category: item.category,
        location: item.location,
        quantity,
        unit: item.unit,
        unitCost: parseFloat(item.purchase_price),
        sellingPrice: item.selling_price ? parseFloat(item.selling_price) : null,
        expiryDate: item.expiry_date,
        batchNumber: item.batch_no,
        status,
        productTotalQuantity: productTotal,
        expiry_threshold: expiryThreshold,
        product: {
          expiry_threshold: expiryThreshold
        }
      }
    })

    return {
      stock: transformedStock,
      total: parseInt(total || 0, 10),
      stats: constantStats // Always return constant stats regardless of filter
    }
  }

  /**
   * Find inventories by product_id with quantity > 0 (from inventories table only).
   * Used e.g. by return-borrowed drawer for "available stock" — all rows have valid inventory id.
   * @param {number} productId
   * @returns {Promise<Array<{ id, inventoryCode, productCode, name, batchNumber, expiryDate, unitCost, quantity, location }>>}
   */
  async findInventoriesByProduct(productId) {
    const id = Number(productId)
    if (!id) return []
    const rows = await this.knex('inventories')
      .select(
        'inventories.id',
        'inventories.inventory_code',
        'inventories.batch_no',
        'inventories.expiry_date',
        'inventories.purchase_price',
        'inventories.quantity',
        'inventories.location',
        'products.product_code',
        'products.name as product_name'
      )
      .leftJoin('products', 'inventories.product_id', 'products.id')
      .where('inventories.product_id', id)
      .where('inventories.quantity', '>', 0)
      .orderBy('inventories.id', 'asc')
    return rows.map(r => ({
      id: r.id,
      inventoryCode: r.inventory_code,
      productCode: r.product_code,
      name: r.product_name,
      batchNumber: r.batch_no,
      expiryDate: r.expiry_date,
      unitCost: parseFloat(r.purchase_price) || 0,
      quantity: parseInt(r.quantity, 10) || 0,
      location: r.location || ''
    }))
  }

  /**
   * Calculate stock statistics. Low/out-of-stock counts are per PRODUCT (total quantity across batches).
   * @param {Array} stockList - Array of stock items (may include productTotalQuantity from API)
   * @returns {Object} Statistics object
   */
  calculateStockStats(stockList) {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const DEFAULT_EXPIRY_THRESHOLD = InventoriesRepository.DEFAULT_EXPIRY_THRESHOLD
    const HIGH_VALUE_THRESHOLD = InventoriesRepository.DEFAULT_HIGH_VALUE_THRESHOLD
    const LOW_STOCK_THRESHOLD = InventoriesRepository.DEFAULT_LOW_STOCK_THRESHOLD

    const stats = {
      total: stockList.length,
      outOfStock: 0,
      lowStock: 0,
      expiringSoon: 0,
      expired: 0,
      borrowedFrom: 0,
      borrowedTo: 0,
      highValue: 0
    }

    // Product-level totals for low/out-of-stock (by product_id)
    const productTotalsMap = new Map()
    stockList.forEach(item => {
      const pid = item.productId ?? item.product_id
      if (pid == null) return
      const qty = parseInt(item.quantity || 0, 10)
      productTotalsMap.set(pid, (productTotalsMap.get(pid) || 0) + qty)
    })
    productTotalsMap.forEach((total, _pid) => {
      if (total === 0) stats.outOfStock++
      else if (total < LOW_STOCK_THRESHOLD) stats.lowStock++
    })

    stockList.forEach(item => {
      const purchasePrice = parseFloat(item.purchase_price || item.unitCost || 0)
      const expiryDate = item.expiry_date || item.expiryDate
      const expiryThreshold = item.expiry_threshold ?? item.product?.expiry_threshold ?? DEFAULT_EXPIRY_THRESHOLD

      if (purchasePrice >= HIGH_VALUE_THRESHOLD) stats.highValue++

      // Only count expired/expiring soon when batch has a valid expiry date; null excluded
      if (expiryDate) {
        const expiry = new Date(expiryDate)
        const expiryDateStr = expiry.toISOString().split('T')[0]
        if (expiryDateStr < todayStr) stats.expired++
        else {
          const thresholdDate = new Date(today)
          thresholdDate.setDate(today.getDate() + expiryThreshold)
          const thresholdDateStr = thresholdDate.toISOString().split('T')[0]
          if (expiryDateStr <= thresholdDateStr) stats.expiringSoon++
        }
      }
    })

    return stats
  }

  /**
   * Update a stock item by ID
   * @param {number} inventoryId - Inventory ID
   * @param {Object} updateData - Fields to update (snake_case format)
   * @returns {Object} Updated inventory record
   */
  async updateById(inventoryId, updateData) {
    // Transform camelCase to snake_case for database fields
    // Database columns are snake_case: expiry_date, batch_no, purchase_price, selling_price
    const transformedData = {}
    
    // Handle batch_no (accept both batch_no and batchNo from frontend)
    if ('batch_no' in updateData || 'batchNo' in updateData) {
      const batchNo = 'batch_no' in updateData ? updateData.batch_no : updateData.batchNo
      // Allow empty string to clear the batch number
      transformedData.batch_no = (batchNo === null || batchNo === undefined || batchNo === '') ? null : String(batchNo).trim() || null
    }
    
    // Handle expiry_date (accept both expiry_date and expiryDate from frontend)
    if ('expiry_date' in updateData || 'expiryDate' in updateData) {
      const expiryDate = 'expiry_date' in updateData ? updateData.expiry_date : updateData.expiryDate
      // Allow empty string or null to clear the expiry date, otherwise use the provided date (trimmed)
      if (expiryDate === null || expiryDate === undefined || expiryDate === '') {
        transformedData.expiry_date = null
      } else {
        // Trim the date string and validate it's not empty after trimming
        const trimmedDate = String(expiryDate).trim()
        transformedData.expiry_date = trimmedDate === '' ? null : trimmedDate
      }
    }
    
    // Handle purchase_price (accept both unit_cost/unitCost from frontend, store as purchase_price in DB)
    if ('unit_cost' in updateData || 'unitCost' in updateData) {
      const unitCost = 'unit_cost' in updateData ? updateData.unit_cost : updateData.unitCost
      transformedData.purchase_price = parseFloat(unitCost)
    }
    
    // Handle selling_price (accept both selling_price and sellingPrice from frontend)
    if ('selling_price' in updateData || 'sellingPrice' in updateData) {
      const sellingPrice = 'selling_price' in updateData ? updateData.selling_price : updateData.sellingPrice
      // Allow 0 as a valid value, only set to null if explicitly null/undefined
      transformedData.selling_price = (sellingPrice === null || sellingPrice === undefined) ? null : parseFloat(sellingPrice)
    }

    // Only update if there's data to update
    if (Object.keys(transformedData).length === 0) {
      throw new Error('No valid fields to update')
    }

    // Always update the last_updated timestamp
    transformedData.last_updated = this.knex.fn.now()

    const [updated] = await this.knex('inventories')
      .where({ id: inventoryId })
      .update(transformedData)
      .returning('*')

    if (!updated) {
      throw new Error(`Inventory with ID ${inventoryId} not found`)
    }

    return updated
  }

  /**
   * Adjust stock quantity and create bin card transaction
   * @param {number} inventoryId - Inventory ID
   * @param {Object} adjustmentData - Adjustment data
   * @param {number} userId - User ID performing the adjustment
   * @returns {Object} Updated inventory record
   */
  async adjustStockQuantity(inventoryId, adjustmentData, userId = null) {
    const {
      adjustmentType,
      amount,
      newQuantity,
      reason,
      notes,
      adjustmentDate,
      adjustment_date,
      partnerId,
      partner_id
    } = adjustmentData

    // Get current inventory record
    const inventory = await this.knex('inventories')
      .where({ id: inventoryId })
      .first()

    if (!inventory) {
      throw new Error(`Inventory with ID ${inventoryId} not found`)
    }

    // Get product info for bin card
    const product = await this.knex('products')
      .where({ id: inventory.product_id })
      .first()

    if (!product) {
      throw new Error(`Product with ID ${inventory.product_id} not found`)
    }

    // Wrap all operations in a transaction for atomicity
    return await this.knex.transaction(async (trx) => {
      // Get last balance for this product
      const openingBalance = await this.getLastProductBalance(product.id)

      // Calculate quantity change
      let quantityIn = 0
      let quantityOut = 0
      let transactionType = 'adjustment'

      if (adjustmentType === 'add') {
        quantityIn = amount
        transactionType = 'received'
      } else if (adjustmentType === 'subtract') {
        quantityOut = amount
        transactionType = 'issued'
      } else { // 'set'
        const difference = newQuantity - inventory.quantity
        if (difference > 0) {
          quantityIn = difference
          transactionType = 'received'
        } else if (difference < 0) {
          quantityOut = Math.abs(difference)
          transactionType = 'issued'
        } else {
          // No change, but still create a transaction for audit trail
          transactionType = 'adjustment'
        }
      }

      const balance = openingBalance + quantityIn - quantityOut
      const transactionDate = adjustmentDate || adjustment_date || new Date().toISOString().split('T')[0]
      const partnerIdValue = partnerId || partner_id || null

      // Check if reason is "Borrow To" (case-insensitive)
      const isBorrowTo = reason && reason.toLowerCase().includes('borrow to')
      
      // Validate partner ID is required for "Borrow To"
      if (isBorrowTo && !partnerIdValue) {
        throw new Error('Partner ID is required when reason is "Borrow To"')
      }

      // Update inventory quantity
      const [updated] = await trx('inventories')
        .where({ id: inventoryId })
        .update({
          quantity: newQuantity
        })
        .returning('*')

      // Create bin card transaction
      await this.createBinCardTransaction({
        productId: product.id,
        inventoryId: inventoryId,
        batchNo: inventory.batch_no,
        expiryDate: inventory.expiry_date,
        transactionDate: transactionDate,
        quantity: quantityIn > 0 ? quantityIn : quantityOut,
        unitCost: inventory.purchase_price,
        openingBalance: openingBalance,
        reason: reason,
        notes: notes || null,
        createdBy: userId,
        transactionType: transactionType,
        quantityIn: quantityIn,
        quantityOut: quantityOut,
        balance: balance,
        partnerId: partnerIdValue
      }, trx)

      let borrowToRecordId = null
      // If reason is "Borrow To" and we're subtracting stock, create borrow_to_inventories record
      if (isBorrowTo && quantityOut > 0 && partnerIdValue) {
        const borrowToTableExists = await trx.schema.hasTable('borrow_to_inventories')
        if (borrowToTableExists) {
          const [borrowToRecord] = await trx('borrow_to_inventories')
            .insert({
              product_id: product.id,
              partner_id: partnerIdValue,
              source_inventory_id: inventoryId,
              batch_no: inventory.batch_no,
              expiry_date: inventory.expiry_date,
              unit_cost: inventory.purchase_price,
              selling_price: inventory.selling_price,
              quantity: quantityOut,
              lent_date: transactionDate,
              status: 'active',
              notes: notes || null,
              created_by: userId,
              created_at: trx.fn.now(),
              last_updated: trx.fn.now(),
              sync_status: 'pending'
            })
            .returning('id')
          borrowToRecordId = borrowToRecord?.id ?? borrowToRecord
        }
      }

      // Ledger: post GL entries when account_ledger exists
      const ledgerTableExists = await trx.schema.hasTable('account_ledger')
      if (ledgerTableExists) {
        const unitCost = parseFloat(inventory.purchase_price) || 0
        const refNo = `ADJ-${inventoryId}-${Date.now()}`
        if (quantityIn > 0) {
          await this.ledgerHelper.recordStockAdjustmentAdd({
            inventoryId,
            quantity: quantityIn,
            unitCost,
            transactionDate,
            reason: reason || 'Adjustment',
            referenceNumber: refNo,
            memo: notes,
            createdBy: userId
          }, trx)
        } else if (quantityOut > 0) {
          if (isBorrowTo && partnerIdValue) {
            await this.ledgerHelper.recordStockAdjustmentSubtractBorrowTo({
              inventoryId,
              quantity: quantityOut,
              unitCost,
              partnerId: partnerIdValue,
              transactionDate,
              reason: reason || 'Borrow To',
              referenceNumber: borrowToRecordId != null ? `BORROW-TO-${borrowToRecordId}` : undefined,
              referenceId: borrowToRecordId,
              memo: notes,
              createdBy: userId
            }, trx)
          } else {
            await this.ledgerHelper.recordStockAdjustmentSubtract({
              inventoryId,
              quantity: quantityOut,
              unitCost,
              transactionDate,
              reason: reason || 'Adjustment',
              referenceNumber: refNo,
              memo: notes,
              createdBy: userId
            }, trx)
          }
        }
      }

      return updated
    })
  }

  /**
   * Create a borrow from inventory record
   * This method:
   * 1. Creates/updates inventory record (because we're getting stock to our stock)
   * 2. Creates bin card entry (to track the transaction)
   * 3. Creates borrow_from_inventories record (to keep record of who, what, when, etc.)
   * @param {Object} borrowData - Borrow from data
   * @param {number} userId - User ID creating the record
   * @returns {Object} Created borrow_from_inventories record with inventory info
   */
  async createBorrowFromInventory(borrowData, userId = null) {
    const {
      partnerId,
      partner_id,
      productId,
      product_id,
      purchasePrice,
      purchase_price,
      quantity,
      batchNo,
      batch_no,
      expiryDate,
      expiry_date,
      location,
      notes,
      description
    } = borrowData

    const partnerIdValue = partnerId || partner_id
    const productIdValue = productId || product_id
    const purchasePriceValue = purchasePrice || purchase_price
    const batchNoValue = batchNo || batch_no || null
    const expiryDateValue = expiryDate || expiry_date || null
    const quantityValue = parseInt(quantity, 10)

    if (!partnerIdValue || !productIdValue || !purchasePriceValue || !quantity) {
      throw new Error('Partner ID, Product ID, Purchase Price, and Quantity are required')
    }

    // Check if borrow_from_inventories table exists
    const tableExists = await this.knex.schema.hasTable('borrow_from_inventories')
    if (!tableExists) {
      throw new Error('borrow_from_inventories table does not exist')
    }

    // Use a transaction to ensure all operations succeed or fail together
    return await this.knex.transaction(async (trx) => {
      // 1. Get product information to generate inventory code
      const product = await trx('products')
        .where({ id: productIdValue })
        .first()

      if (!product) {
        throw new Error(`Product with ID ${productIdValue} not found`)
      }

      // 2. Check if inventory record already exists with same variation
      const existing = await this.findExistingInventory(
        productIdValue,
        batchNoValue,
        expiryDateValue,
        purchasePriceValue
      )

      let inventoryCode
      let inventoryId
      let quantityAdded = quantityValue
      let purchasePrice = parseFloat(purchasePriceValue)
      const purchaseDate = new Date().toISOString().split('T')[0]

      if (existing) {
        // Use existing inventory code
        inventoryCode = existing.inventory_code
        inventoryId = existing.id
        
        // Update quantity (add to existing)
        await trx('inventories')
          .where({ id: existing.id })
          .update({
            quantity: trx.raw('quantity + ?', [quantityAdded]),
            last_updated: trx.fn.now()
          })
      } else {
        // Generate new inventory code
        inventoryCode = await this.generateInventoryCode(product.product_code)
        
        // Insert new inventory record
        const [inserted] = await trx('inventories')
          .insert({
            product_id: productIdValue,
            inventory_code: inventoryCode,
            batch_no: batchNoValue,
            expiry_date: expiryDateValue,
            purchase_date: purchaseDate,
            acquisition_type: 'borrow', // Borrow-from operation
            purchase_price: purchasePrice,
            quantity: quantityAdded,
            selling_price: null,
            location: location || null,
            notes: description || notes || 'Borrowed from partner',
            created_at: trx.fn.now(),
            last_updated: trx.fn.now()
          })
          .returning('id')
        
        inventoryId = inserted.id || inserted
      }

      // 3. Create borrow_from_inventories record (link to inventory for return-status / returns)
      const [borrowFromRecord] = await trx('borrow_from_inventories')
        .insert({
          product_id: productIdValue,
          partner_id: partnerIdValue,
          inventory_id: inventoryId,
          batch_no: batchNoValue,
          expiry_date: expiryDateValue,
          unit_cost: purchasePriceValue,
          selling_price: null, // Can be set later
          location: location || null,
          quantity: quantityValue,
          borrowed_date: trx.fn.now(),
          expected_return_date: null,
          status: 'active',
          notes: notes || description || null,
          document_no: null,
          created_by: userId,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now(),
          sync_status: 'pending'
        })
        .returning('*')

      // 4. Get opening balance for bin card transaction
      // For opening balance, we want the last committed balance, so using this.knex is fine
      const openingBalance = await this.getLastProductBalance(productIdValue)

      // 5. Create bin card transaction for this borrow from (within transaction)
      const finalQuantityIn = quantityAdded
      const finalQuantityOut = 0
      const finalBalance = openingBalance + finalQuantityIn - finalQuantityOut
      const totalCost = finalQuantityIn * purchasePrice

      await trx('bin_cards')
        .insert({
          product_id: productIdValue,
          inventory_id: inventoryId,
          batch_no: batchNoValue || null,
          expiry_date: expiryDateValue || null,
          transaction_date: purchaseDate,
          transaction_type: 'received',
          reference_id: borrowFromRecord.id, // Reference the borrow_from_inventories record
          reference_table: 'borrow_from_inventories',
          opening_balance: openingBalance,
          quantity_in: finalQuantityIn,
          quantity_out: finalQuantityOut,
          balance: finalBalance,
          unit_cost: purchasePrice,
          total_cost: totalCost,
          reason: 'Borrow From',
          notes: notes || description || `Borrowed from partner (ID: ${partnerIdValue})`,
          created_by: userId || null,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now()
        })

      // Return borrow_from_inventories record with inventory info
      return {
        ...borrowFromRecord,
        inventory_id: inventoryId,
        inventory_code: inventoryCode
      }
    })
  }

  /**
   * Get return history for a borrow_to_inventory record
   * @param {number} borrowToInventoryId - ID from borrow_to_inventories table
   * @returns {Array} Array of return records
   */
  async getBorrowToReturnHistory(borrowToInventoryId) {
    const tableExists = await this.knex.schema.hasTable('borrow_to_returns')
    if (!tableExists) {
      return []
    }

    return await this.knex('borrow_to_returns')
      .where('borrow_to_inventory_id', borrowToInventoryId)
      .orderBy('returned_date', 'desc')
      .orderBy('id', 'desc')
  }

  /**
   * Process return of borrowed-to items
   * Creates: borrow_to_returns record, inventory record, bin card entry
   * Updates: borrow_to_inventories status
   * @param {Object} returnData - Return data
   * @param {number} userId - User ID processing the return
   * @returns {Object} Created return record with inventory info
   */
  async processBorrowToReturn(returnData, userId = null) {
    const {
      borrowToInventoryId,
      borrow_to_inventory_id,
      quantityReturned,
      quantity_returned,
      returnItems, // New format: array of items with batch/expiry
      returnedDate,
      returned_date,
      notes,
      condition
    } = returnData

    const borrowToId = borrowToInventoryId || borrow_to_inventory_id
    const returnDate = returnedDate || returned_date || new Date().toISOString().split('T')[0]

    if (!borrowToId) {
      throw new Error('Borrow To Inventory ID is required')
    }

    // Support both old format (single quantity) and new format (multiple items)
    let itemsToProcess = []
    if (returnItems && Array.isArray(returnItems) && returnItems.length > 0) {
      // New format: multiple items with different batches/expiries
      itemsToProcess = returnItems.map(item => ({
        product_id: Number(item.product_id),
        unit_cost: Number(item.unit_cost),
        batch_no: item.batch_number || item.batch_no || null,
        expiry_date: item.expiry_date || null,
        quantity_returned: Number(item.quantity_returned || item.quantityReturned || 0),
        location: item.location || null
      }))
    } else {
      // Old format: single quantity (backward compatibility)
      const quantity = parseInt(quantityReturned || quantity_returned, 10)
      if (!quantity || quantity <= 0) {
        throw new Error('Quantity returned is required and must be positive')
      }
      // We'll get product_id and unit_cost from borrowToRecord below
      itemsToProcess = [{ quantity_returned: quantity }]
    }

    // Check if borrow_to_inventories and borrow_to_returns tables exist
    const borrowToTableExists = await this.knex.schema.hasTable('borrow_to_inventories')
    const returnsTableExists = await this.knex.schema.hasTable('borrow_to_returns')
    
    if (!borrowToTableExists || !returnsTableExists) {
      throw new Error('Borrow to tables do not exist')
    }

    // Use transaction to ensure all operations succeed or fail together
    return await this.knex.transaction(async (trx) => {
      // 1. Get the borrow_to_inventory record
      const borrowToRecord = await trx('borrow_to_inventories')
        .where({ id: borrowToId })
        .first()

      if (!borrowToRecord) {
        throw new Error(`Borrow to inventory record with ID ${borrowToId} not found`)
      }

      if (borrowToRecord.status === 'returned' || borrowToRecord.status === 'settled') {
        throw new Error(`Cannot return items from a ${borrowToRecord.status} borrow record`)
      }

      // 2. Validate return items match the original borrow
      // For new format, validate product_id and unit_cost match
      // For old format, we'll use borrowToRecord values
      if (returnItems && Array.isArray(returnItems) && returnItems.length > 0) {
        const borrowedProductId = Number(borrowToRecord.product_id)
        const borrowedUnitCost = parseFloat(borrowToRecord.unit_cost)
        
        itemsToProcess.forEach((item, idx) => {
          const itemProductId = Number(item.product_id)
          const itemUnitCost = Number(item.unit_cost)

          if (itemProductId !== borrowedProductId) {
            throw new Error(`Return item ${idx + 1}: Product ID (${itemProductId}) must match borrowed product (${borrowedProductId})`)
          }
          if (Math.abs(itemUnitCost - borrowedUnitCost) > 0.01) {
            throw new Error(`Return item ${idx + 1}: Unit cost (${itemUnitCost}) must match borrowed unit cost (${borrowedUnitCost})`)
          }
        })
      } else {
        // Old format: use borrowToRecord values
        itemsToProcess[0].product_id = borrowToRecord.product_id
        itemsToProcess[0].unit_cost = parseFloat(borrowToRecord.unit_cost)
        itemsToProcess[0].batch_no = borrowToRecord.batch_no
        itemsToProcess[0].expiry_date = borrowToRecord.expiry_date
        itemsToProcess[0].location = null
      }

      // 3. Check how much has already been returned
      const previousReturns = await trx('borrow_to_returns')
        .where('borrow_to_inventory_id', borrowToId)
        .sum('quantity_returned as total_returned')
        .first()

      const totalReturned = parseInt(previousReturns?.total_returned || 0, 10)
      const totalQuantityToReturn = itemsToProcess.reduce((sum, item) => sum + item.quantity_returned, 0)
      const remainingQuantity = borrowToRecord.quantity - totalReturned

      if (totalQuantityToReturn > remainingQuantity) {
        throw new Error(`Cannot return ${totalQuantityToReturn} items. Only ${remainingQuantity} items remaining`)
      }

      // 4. Get product information
      const product = await trx('products')
        .where({ id: borrowToRecord.product_id })
        .first()

      if (!product) {
        throw new Error(`Product with ID ${borrowToRecord.product_id} not found`)
      }

      // Get partner name for notes
      const partner = await trx('customers')
        .where({ id: borrowToRecord.partner_id })
        .first()

      const partnerName = partner?.name || `Partner ID: ${borrowToRecord.partner_id}`

      // 5. Process each return item (create inventory, bin card, return record)
      const returnRecords = []
      let currentOpeningBalance = await this.getLastProductBalance(borrowToRecord.product_id)

      for (const item of itemsToProcess) {
        // Find or create inventory record for this batch/expiry combination
        const existing = await this.findExistingInventory(
          item.product_id,
          item.batch_no,
          item.expiry_date,
          item.unit_cost
        )

        let inventoryId
        let inventoryCode

        if (existing) {
          // Update existing inventory
          inventoryId = existing.id
          inventoryCode = existing.inventory_code
          
          await trx('inventories')
            .where({ id: existing.id })
            .update({
              quantity: trx.raw('quantity + ?', [item.quantity_returned]),
              location: item.location || existing.location, // Update location if provided
              last_updated: trx.fn.now()
            })
        } else {
          // Create new inventory record
          inventoryCode = await this.generateInventoryCode(product.product_code)
          
          // Insert new inventory record
          const [inserted] = await trx('inventories')
            .insert({
              product_id: item.product_id,
              inventory_code: inventoryCode,
              batch_no: item.batch_no || null,
              expiry_date: item.expiry_date || null,
              purchase_date: returnDate,
              acquisition_type: 'borrow', // Borrow-to return operation
              purchase_price: item.unit_cost,
              quantity: item.quantity_returned,
              selling_price: borrowToRecord.selling_price,
              location: item.location || null,
              notes: `Returned from borrow to partner (ID: ${borrowToRecord.partner_id})`,
              created_at: trx.fn.now(),
              last_updated: trx.fn.now()
            })
            .returning('id')
          
          inventoryId = inserted.id || inserted
        }

        // Create bin card entry
        const finalQuantityIn = item.quantity_returned
        const finalQuantityOut = 0
        const finalBalance = currentOpeningBalance + finalQuantityIn - finalQuantityOut
        const totalCost = finalQuantityIn * parseFloat(item.unit_cost)

        // Create borrow_to_returns record
        const [returnRecord] = await trx('borrow_to_returns')
          .insert({
            borrow_to_inventory_id: borrowToId,
            quantity_returned: item.quantity_returned,
            returned_date: returnDate,
            returned_to_inventory_id: inventoryId,
            actual_price: item.unit_cost,
            condition: condition || 'good',
            notes: notes || null,
            created_by: userId || null,
            created_at: trx.fn.now(),
            last_updated: trx.fn.now()
          })
          .returning('*')

        // Create bin card entry referencing the return record
        await trx('bin_cards')
          .insert({
            product_id: item.product_id,
            inventory_id: inventoryId,
            batch_no: item.batch_no || null,
            expiry_date: item.expiry_date || null,
            transaction_date: returnDate,
            transaction_type: 'received',
            reference_id: returnRecord.id,
            reference_table: 'borrow_to_returns',
            opening_balance: currentOpeningBalance,
            quantity_in: finalQuantityIn,
            quantity_out: finalQuantityOut,
            balance: finalBalance,
            unit_cost: item.unit_cost,
            total_cost: totalCost,
            reason: 'Return Borrowed To',
            notes: notes || `Returned from ${partnerName} (Borrow To ID: ${borrowToId})`,
            created_by: userId || null,
            created_at: trx.fn.now(),
            last_updated: trx.fn.now()
          })

        // Ledger: DR Inventory (1300), CR Accounts Receivable (1200) when account_ledger exists
        const ledgerTableExists = await trx.schema.hasTable('account_ledger')
        if (ledgerTableExists) {
          await this.ledgerHelper.recordReturnBorrowedTo({
            inventoryId,
            returnId: returnRecord.id,
            quantity: item.quantity_returned,
            unitCost: parseFloat(item.unit_cost) || 0,
            partnerId: borrowToRecord.partner_id,
            transactionDate: returnDate,
            referenceNumber: `RETURN-TO-${returnRecord.id}`,
            memo: notes,
            createdBy: userId
          }, trx)
        }

        // Update opening balance for next item
        currentOpeningBalance = finalBalance

        returnRecords.push({
          ...returnRecord,
          inventory_id: inventoryId,
          inventory_code: inventoryCode
        })
      }

      // 6. Update borrow_to_inventories status
      const newTotalReturned = totalReturned + totalQuantityToReturn
      let newStatus = 'active'
      
      if (newTotalReturned >= borrowToRecord.quantity) {
        newStatus = 'returned'
      }

      await trx('borrow_to_inventories')
        .where({ id: borrowToId })
        .update({
          status: newStatus,
          last_updated: trx.fn.now()
        })

      // Return all return records with inventory info
      return {
        returns: returnRecords,
        total_returned: totalQuantityToReturn,
        remaining_quantity: borrowToRecord.quantity - newTotalReturned
      }
    })
  }

  /**
   * Get return status for a borrowed-from item (total borrowed, total returned, remaining).
   *
   * Mechanism:
   * - Original borrow is stored in borrow_from_inventories (snapshot per row).
   * - Each return is recorded in borrow_from_returns (history of quantity_returned).
   * - Remaining to return = original borrowed quantity − sum(quantity_returned) for that borrow.
   * - If no borrow_from_returns row exists for the borrow → no return yet → totalReturned = 0.
   *
   * Accepts either borrowFromId (borrow_from_inventories.id) or borrowedInventoryId (inventories.id).
   * Total borrowed always comes from borrow_from_inventories.quantity — never from inventories.
   *
   * @param {Object} opts - { borrowFromId?: number, borrowedInventoryId?: number }
   * @returns {Promise<{ totalBorrowed: number, totalReturned: number, remaining: number }>}
   */
  async getBorrowFromReturnStatus(opts = {}) {
    // Require borrowFromId - frontend should always provide this
    const borrowFromId = opts.borrowFromId != null ? Number(opts.borrowFromId) : null
    if (!borrowFromId) {
      throw new Error('borrowFromId is required')
    }

    // Get borrow record directly by ID
    const borrowRecord = await this.knex('borrow_from_inventories').where('id', borrowFromId).first()
    if (!borrowRecord) {
      throw new Error('Borrow-from record not found')
    }

    // Use borrowedInventoryId if provided by frontend, otherwise extract from borrow record
    // Frontend should always provide this when stockItem.inventoryId is available
    const borrowedInventoryId = opts.borrowedInventoryId != null ? Number(opts.borrowedInventoryId) : null
    const inventoryId = borrowedInventoryId || (borrowRecord.inventory_id ? Number(borrowRecord.inventory_id) : null)

    // 1. Original borrowed quantity (snapshot from borrow_from_inventories)
    const totalBorrowed = borrowRecord ? parseInt(borrowRecord.quantity, 10) || 0 : 0

    // 2. Sum of return quantities so far (borrow_from_returns history for this borrow)
    //    Returns are keyed by borrowed_inventory_id; we use borrow.inventory_id to link.
    //    If no return rows for this borrow → totalReturned = 0.
    const returnsTableExists = await this.knex.schema.hasTable('borrow_from_returns')
    let totalReturned = 0
    
    if (returnsTableExists) {
      if (inventoryId) {
        // Primary method: Query by inventory_id from borrow_from_inventories
        const returnRows = await this.knex('borrow_from_returns')
          .where('borrowed_inventory_id', inventoryId)
        
        totalReturned = returnRows.reduce((sum, r) => {
          const qty = parseInt(r.quantity_returned || 0, 10)
          return sum + qty
        }, 0)
      } else {
        // If inventoryId is null, log a warning - this shouldn't happen if borrow was created correctly
        console.warn('[getBorrowFromReturnStatus] inventoryId is null - cannot query returns', {
          borrowFromId,
          borrowedInventoryId,
          borrowRecordInventoryId: borrowRecord?.inventory_id,
          totalBorrowed
        })
      }
    }

    // 3. Remaining to return = original − sum(returns)
    const remaining = Math.max(0, totalBorrowed - totalReturned)
    
    return { totalBorrowed, totalReturned, remaining }
  }

  /**
   * Process borrow returns - Main processing routine
   * Accepts data from frontend with array of returning inventories {inventory_id, quantity}
   * Loops through each return item and processes them using processBorrowReturn routine
   * 
   * @param {Object} returnData - Return data from frontend
   * @param {number} returnData.borrowedInventoryId - ID of the borrowed inventory
   * @param {Array} returnData.returnItems - Array of {inventory_id, quantity} or {returningInventoryId, quantityReturned}
   * @param {string} returnData.returnedOn - Return date (YYYY-MM-DD)
   * @param {string} [returnData.note] - Optional note
   * @param {number} userId - User ID processing the return
   * @returns {Object} Result of the operation
   */
  async processBorrowFromReturn(returnData, userId = null) {
    const {
      borrowedInventoryId,
      borrowed_inventory_id,
      returnItems,
      returnedOn,
      returned_on,
      note
    } = returnData

    const borrowed_inventory_id_value = borrowedInventoryId || borrowed_inventory_id
    const returned_on_value = returnedOn || returned_on || new Date().toISOString().split('T')[0]

    // Validate returnItems array
    if (!Array.isArray(returnItems) || returnItems.length === 0) {
      throw new Error('returnItems must be a non-empty array')
    }

    // Normalize return items - accept both {inventory_id, quantity} and {returningInventoryId, quantityReturned}
    const normalizedReturnItems = returnItems.map(item => ({
      returning_inventory_id: item.inventory_id || item.returningInventoryId || item.returning_inventory_id,
      quantity_returned: parseInt(item.quantity || item.quantityReturned || item.quantity_returned || 0, 10)
    })).filter(item => item.returning_inventory_id && item.quantity_returned > 0)

    if (normalizedReturnItems.length === 0) {
      throw new Error('No valid return items provided')
    }

    // Use transaction to ensure all operations succeed or fail together
    return await this.knex.transaction(async (trx) => {
      const processedReturns = []
      const allGlEntries = []
      let highestCost = 0
      let initialBorrowedPrice = 0

      // Get initial borrowed inventory price (before any returns)
      const borrowedInventory = await trx('inventories')
        .where('id', borrowed_inventory_id_value)
        .first()

      if (!borrowedInventory) {
        throw new Error('Borrowed inventory record not found')
      }

      initialBorrowedPrice = parseFloat(borrowedInventory.purchase_price) || 0
      highestCost = initialBorrowedPrice

      // Loop through each return item and process using processBorrowReturn routine
      for (const returnItem of normalizedReturnItems) {
        const result = await this.processBorrowReturn(trx, {
          borrowed_inventory_id: borrowed_inventory_id_value,
          returning_inventory_id: returnItem.returning_inventory_id,
          quantity_returned: returnItem.quantity_returned,
          returned_on: returned_on_value,
          note: note || null,
          userId: userId || null
        })

        processedReturns.push(result)

        // Track highest cost (high-water mark)
        if (result.newAdjustedPrice > highestCost) {
          highestCost = result.newAdjustedPrice
        }

        // Collect GL entries (they're already posted by processBorrowReturn, but we track them)
        if (result.glEntries && result.glEntries.entries) {
          allGlEntries.push(...result.glEntries.entries)
        }
      }

      // Get final status after all returns
      const borrowFromRecord = await trx('borrow_from_inventories')
        .where('inventory_id', borrowed_inventory_id_value)
        .whereIn('status', ['active', 'partially_returned', 'returned'])
        .orderBy('id', 'desc')
        .first()

      const totalQuantityReturned = normalizedReturnItems.reduce((sum, item) => sum + item.quantity_returned, 0)
      const isSettled = borrowFromRecord && totalQuantityReturned >= borrowFromRecord.quantity

      return {
        success: true,
        borrowReturnIds: processedReturns.map(r => r.borrowReturnId),
        isSettled: isSettled || false,
        oldAdjustedPrice: initialBorrowedPrice,
        newAdjustedPrice: highestCost, // High-water mark (highest cost among all returns)
        priceDifference: highestCost - initialBorrowedPrice,
        totalQuantityReturned: totalQuantityReturned,
        processedReturns: processedReturns // Individual return results
      }
    })
  }

  /**
   * Process a single borrow return item
   * Enhanced version that processes one returning inventory with quantity
   * Designed to be called in a loop for multiple return items
    const {
      borrowedInventoryId,
      borrowed_inventory_id,
      returnItems,
      returnedOn,
      returned_on,
      note
    } = returnData

    const borrowed_inventory_id_value = borrowedInventoryId || borrowed_inventory_id
    const returned_on_value = returnedOn || returned_on || new Date().toISOString().split('T')[0]

    // Validate returnItems array
    if (!Array.isArray(returnItems) || returnItems.length === 0) {
      throw new Error('returnItems must be a non-empty array')
    }

    // Normalize return items
    const normalizedReturnItems = returnItems.map(item => ({
      returningInventoryId: item.returningInventoryId || item.returning_inventory_id,
      quantityReturned: parseInt(item.quantityReturned || item.quantity_returned || 0, 10)
    })).filter(item => item.returningInventoryId && item.quantityReturned > 0)

    if (normalizedReturnItems.length === 0) {
      throw new Error('No valid return items provided')
    }

    // Helper for financial rounding to 2 decimal places
    const fm = (num) => Math.round((num + Number.EPSILON) * 100) / 100

    // Use transaction to ensure all operations succeed or fail together
    return await this.knex.transaction(async (trx) => {
      // 1. Data Retrieval - Get borrowed inventory
      const borrowedInventory = await trx('inventories')
        .where('id', borrowed_inventory_id_value)
        .first()

      if (!borrowedInventory) {
        throw new Error('Borrowed inventory record not found.')
      }

      // Get all returning inventories
      const returningInventoryIds = normalizedReturnItems.map(item => item.returningInventoryId)
      const returningInventories = await trx('inventories')
        .whereIn('id', returningInventoryIds)
        .select('*')

      if (returningInventories.length !== returningInventoryIds.length) {
        throw new Error('One or more returning inventory records not found.')
      }

      const returningInventoryMap = {}
      returningInventories.forEach(inv => {
        returningInventoryMap[inv.id] = inv
      })

      // Find the borrow_from_inventories record by matching product and characteristics
      // Note: inventory_id exists but may be NULL if inventory was deleted, so we match by product_id, batch_no, expiry_date, and unit_cost
      let originalBorrowRecord = await trx('borrow_from_inventories')
        .where('product_id', borrowedInventory.product_id)
        .where('unit_cost', borrowedInventory.purchase_price)
        .where(function() {
          if (borrowedInventory.batch_no) {
            this.where('batch_no', borrowedInventory.batch_no)
          } else {
            this.whereNull('batch_no')
          }
        })
        .where(function() {
          if (borrowedInventory.expiry_date) {
            this.where('expiry_date', borrowedInventory.expiry_date)
          } else {
            this.whereNull('expiry_date')
          }
        })
        .where('status', 'active')
        .orderBy('id', 'desc')
        .first()

      if (!originalBorrowRecord) {
        throw new Error('Borrow from inventory record not found for this inventory item.')
      }

      // Check if borrow_from_returns table exists
      const returnsTableExists = await trx.schema.hasTable('borrow_from_returns')
      if (!returnsTableExists) {
        throw new Error('borrow_from_returns table does not exist')
      }

      // 2. Get existing return history and sales data
      const borrowReturnsRaw = await trx('borrow_from_returns')
        .where('borrowed_inventory_id', borrowed_inventory_id_value)
        .select('*')
      const borrowReturns = Array.isArray(borrowReturnsRaw) ? borrowReturnsRaw : []

      const salesTableExists = await trx.schema.hasTable('sales_order_items')
      const soldItemsRaw = salesTableExists
        ? await trx('sales_order_items').where('inventory_id', borrowed_inventory_id_value).select('*')
        : []
      const soldItems = Array.isArray(soldItemsRaw) ? soldItemsRaw : []

      const totalReturnedBefore = borrowReturns.reduce((sum, r) => sum + (r.quantity_returned || 0), 0)
      const totalSoldBefore = soldItems.reduce((sum, s) => sum + (s.quantity || 0), 0)

      // 3. Calculate total quantity to return and validate
      const totalQuantityToReturn = normalizedReturnItems.reduce((sum, item) => sum + item.quantityReturned, 0)
      const unreturnedQty = originalBorrowRecord.quantity - totalReturnedBefore

      if (totalQuantityToReturn > unreturnedQty) {
        throw new Error(`Cannot return ${totalQuantityToReturn}. Only ${unreturnedQty} remaining in debt.`)
      }

      // 4. Process each return item and determine high-water mark (highest cost)
      const lastAdjustedCost = borrowedInventory.purchase_price
      const borrowReturnIds = []
      let highestReturningCost = lastAdjustedCost // Start with current price

      // First pass: Create return records and find the highest cost (high-water mark)
      for (const returnItem of normalizedReturnItems) {
        const returningInventory = returningInventoryMap[returnItem.returningInventoryId]
        if (!returningInventory) {
          throw new Error(`Returning inventory ${returnItem.returningInventoryId} not found`)
        }

        const returningCost = parseFloat(returningInventory.purchase_price) || 0
        
        // Track highest cost (true high-water mark)
        if (returningCost > highestReturningCost) {
          highestReturningCost = returningCost
        }

        // Create return record (using same pattern as other inserts in this file)
        const insertResult = await trx('borrow_from_returns')
          .insert({
            borrowed_inventory_id: borrowed_inventory_id_value,
            returning_inventory_id: returnItem.returningInventoryId,
            estimated_price: returningCost,
            actual_price: returningCost,
            quantity_returned: returnItem.quantityReturned,
            returned_on: returned_on_value,
            note: note || null,
            created_at: trx.fn.now(),
            last_updated: trx.fn.now(),
            sync_status: 'pending'
          })
          .returning('id')
        
        // Handle insert result (PostgreSQL returns array of objects: [{id: 1}])
        if (!insertResult || !Array.isArray(insertResult) || insertResult.length === 0) {
          throw new Error('Failed to create borrow_from_returns record')
        }
        
        const borrowReturnId = insertResult[0]?.id || insertResult[0]
        if (borrowReturnId) {
          borrowReturnIds.push(borrowReturnId)
        }

        // Decrement quantity from returning inventory
        await trx('inventories')
          .where('id', returnItem.returningInventoryId)
          .decrement('quantity', returnItem.quantityReturned)
      }

      // Update borrowed inventory price to the highest cost (high-water mark)
      // This ensures the borrowed inventory is valued at the highest cost among all returns
      await trx('inventories')
        .where('id', borrowed_inventory_id_value)
        .update({
          purchase_price: highestReturningCost,
          last_updated: trx.fn.now()
        })

      // 5. Update borrow_from_inventories status
      const totalReturnedAfter = totalReturnedBefore + totalQuantityToReturn
      const isSettled = totalReturnedAfter === originalBorrowRecord.quantity

      await trx('borrow_from_inventories')
        .where('id', originalBorrowRecord.id)
        .update({
          status: isSettled ? 'returned' : 'partially_returned',
          last_updated: trx.fn.now()
        })

      // 6. GL Entry Generation (aggregated across all returns)
      // Use high-water mark (highest cost) for GL calculations
      const entries = []
      const finalCostDiff = fm(highestReturningCost - lastAdjustedCost)
      const excessSoldQty = Math.max(totalSoldBefore, totalReturnedBefore) - totalReturnedBefore
      const unreturnedQtyAfter = originalBorrowRecord.quantity - totalReturnedAfter

      // A. Revalue the Debt/Inventory Basis (Mark-to-Market) - based on final price
      if (finalCostDiff !== 0) {
        const totalAdj = fm(Math.abs(finalCostDiff * unreturnedQtyAfter))
        entries.push({
          account_code: '1300', // Inventory
          debit: finalCostDiff > 0 ? totalAdj : 0,
          credit: finalCostDiff < 0 ? totalAdj : 0,
          description: `Mark-to-market adjustment for unreturned quantity (${unreturnedQtyAfter} units)`
        })
        entries.push({
          account_code: '3100', // Accounts Payable
          debit: finalCostDiff < 0 ? totalAdj : 0,
          credit: finalCostDiff > 0 ? totalAdj : 0,
          description: `Mark-to-market adjustment for unreturned quantity (${unreturnedQtyAfter} units)`
        })
      }

      // B. Catch-up COGS for units already sold at the old price
      if (excessSoldQty > 0 && finalCostDiff !== 0) {
        const cogsAdj = fm(Math.abs(finalCostDiff * excessSoldQty))
        entries.push({
          account_code: '6100', // Cost of Goods Sold
          debit: finalCostDiff > 0 ? cogsAdj : 0,
          credit: finalCostDiff < 0 ? cogsAdj : 0,
          description: `COGS catch-up for excess sold quantity (${excessSoldQty} units)`
        })
        entries.push({
          account_code: '1300', // Inventory
          debit: finalCostDiff < 0 ? cogsAdj : 0,
          credit: finalCostDiff > 0 ? cogsAdj : 0,
          description: `COGS catch-up for excess sold quantity (${excessSoldQty} units)`
        })
      }

      // C. Settlement (Clear specific quantity from debt) - aggregate all returns
      const totalSettlementVal = normalizedReturnItems.reduce((sum, item) => {
        const returningInv = returningInventoryMap[item.returningInventoryId]
        return sum + fm(returningInv.purchase_price * item.quantityReturned)
      }, 0)

      entries.push({
        account_code: '3100', // Accounts Payable
        debit: totalSettlementVal,
        credit: 0,
        description: `Settlement for returned quantity (${totalQuantityToReturn} units)`
      })
      entries.push({
        account_code: '1300', // Inventory
        debit: 0,
        credit: totalSettlementVal,
        description: `Settlement for returned quantity (${totalQuantityToReturn} units)`
      })

      // 7. Post GL Transaction (single transaction for all returns)
      if (Array.isArray(entries) && entries.length > 0 && borrowReturnIds.length > 0) {
        await this.ledgerHelper.postGLTransaction({
          transaction_date: returned_on_value,
          reference_no: `BR-${borrowReturnIds.join(',')}`,
          reference_table: 'borrow_from_returns',
          reference_id: borrowReturnIds[0], // Use first return ID as primary reference
          description: `Market adjustment & return for debt batch ${borrowed_inventory_id_value} (${normalizedReturnItems.length} items)`,
          transaction_type: 'borrow_return',
          entries: entries,
          inventory_id: borrowed_inventory_id_value,
          created_by: userId
        }, trx)
      }

      return {
        success: true,
        borrowReturnIds,
        isSettled,
        oldAdjustedPrice: lastAdjustedCost,
        newAdjustedPrice: highestReturningCost, // High-water mark (highest cost)
        priceDifference: finalCostDiff,
        totalQuantityReturned: totalQuantityToReturn
      }
    })
  }

  /**
   * Process a single borrow return item
   * Enhanced version that processes one returning inventory with quantity
   * Designed to be called in a loop for multiple return items
   * 
   * @param {Object} trx - Knex transaction object (must be provided)
   * @param {Object} borrowReturnData - Return data for single item
   * @param {number} borrowReturnData.borrowed_inventory_id - ID of the borrowed inventory
   * @param {number} borrowReturnData.returning_inventory_id - ID of the returning inventory
   * @param {number} borrowReturnData.quantity_returned - Quantity being returned
   * @param {string} borrowReturnData.returned_on - Return date (YYYY-MM-DD)
   * @param {string} [borrowReturnData.note] - Optional note
   * @param {number} [borrowReturnData.userId] - User ID processing the return
   * @returns {Promise<Object>} Result with borrowReturnId and adjustment details
   */
  async processBorrowReturn(trx, borrowReturnData) {
    const {
      borrowed_inventory_id,
      returning_inventory_id,
      quantity_returned,
      returned_on,
      note,
      userId
    } = borrowReturnData

    // Validate required fields
    if (!borrowed_inventory_id || !returning_inventory_id || !quantity_returned || !returned_on) {
      throw new Error('Missing required fields: borrowed_inventory_id, returning_inventory_id, quantity_returned, returned_on')
    }

    if (quantity_returned <= 0) {
      throw new Error('quantity_returned must be greater than 0')
    }

    // Account codes constants
    const ACC_INVENTORY = { code: '1300', name: 'Inventory' }
    const ACC_COGS = { code: '6100', name: 'Cost of Goods Sold' }
    const ACC_AP = { code: '3100', name: 'Accounts Payable' }

    // Helper for financial rounding to 2 decimal places
    const fm = (num) => Math.round((num + Number.EPSILON) * 100) / 100

    try {
      // 1. Validate the borrowed inventory exists
      const borrowedInventory = await trx('inventories')
        .where('id', borrowed_inventory_id)
        .first()

      if (!borrowedInventory) {
        throw new Error(`Borrowed inventory with ID ${borrowed_inventory_id} not found`)
      }

      // 2. Validate the returning inventory exists and has sufficient quantity
      const returningInventory = await trx('inventories')
        .where('id', returning_inventory_id)
        .first()

      if (!returningInventory) {
        throw new Error(`Returning inventory with ID ${returning_inventory_id} not found`)
      }

      if (returningInventory.quantity < quantity_returned) {
        throw new Error(
          `Insufficient quantity in returning inventory. Available: ${returningInventory.quantity}, Required: ${quantity_returned}`
        )
      }

      // 3. Get all previous borrow returns for this borrowed inventory
      const borrowReturns = await trx('borrow_from_returns')
        .where('borrowed_inventory_id', borrowed_inventory_id)
        .orderBy('id', 'desc')

      // 4. Find the original borrow_from_inventories record
      // Try by inventory_id first (preferred), then fallback to product matching
      let originalBorrowRecord = await trx('borrow_from_inventories')
        .where('inventory_id', borrowed_inventory_id)
        .whereIn('status', ['active', 'partially_returned'])
        .orderBy('id', 'desc')
        .first()

      // Fallback: match by product characteristics if inventory_id match fails
      if (!originalBorrowRecord) {
        originalBorrowRecord = await trx('borrow_from_inventories')
          .where('product_id', borrowedInventory.product_id)
          .where('unit_cost', borrowedInventory.purchase_price)
          .where(function() {
            if (borrowedInventory.batch_no) {
              this.where('batch_no', borrowedInventory.batch_no)
            } else {
              this.whereNull('batch_no')
            }
          })
          .where(function() {
            if (borrowedInventory.expiry_date) {
              this.where('expiry_date', borrowedInventory.expiry_date)
            } else {
              this.whereNull('expiry_date')
            }
          })
          .whereIn('status', ['active', 'partially_returned'])
          .orderBy('id', 'desc')
          .first()
      }

      if (!originalBorrowRecord) {
        throw new Error('Borrow from inventory record not found for this inventory item')
      }

      // 5. Get all sold items from the borrowed inventory
      const salesTableExists = await trx.schema.hasTable('sales_order_items')
      const soldBorrowedInventory = salesTableExists
        ? await trx('sales_order_items')
            .where('inventory_id', borrowed_inventory_id)
            .select('*')
        : []

      // 6. Calculate totals
      const lastReturnedAdjustedCost = parseFloat(borrowedInventory.purchase_price) || 0
      const totalBorrowedQuantity = parseInt(originalBorrowRecord.quantity, 10) || 0

      let totalReturnedQuantityBeforeReturn = 0
      if (borrowReturns && borrowReturns.length > 0) {
        totalReturnedQuantityBeforeReturn = borrowReturns.reduce(
          (acc, curr) => acc + (parseInt(curr.quantity_returned, 10) || 0),
          0
        )
      }

      let totalSoldQuantityBeforeReturn = 0
      if (soldBorrowedInventory && soldBorrowedInventory.length > 0) {
        totalSoldQuantityBeforeReturn = soldBorrowedInventory.reduce(
          (acc, curr) => acc + (parseInt(curr.quantity, 10) || 0),
          0
        )
      }

      const quantityToReturn = parseInt(quantity_returned, 10)
      const returningInventoryCost = parseFloat(returningInventory.purchase_price) || 0

      // Validate we're not returning more than borrowed
      const unreturnedQuantity = totalBorrowedQuantity - totalReturnedQuantityBeforeReturn
      if (quantityToReturn > unreturnedQuantity) {
        throw new Error(
          `Cannot return ${quantityToReturn}. Only ${unreturnedQuantity} remaining to return (borrowed: ${totalBorrowedQuantity}, already returned: ${totalReturnedQuantityBeforeReturn})`
        )
      }

      // 7. Calculate cost difference and excess sold quantity
      const costDifference = fm(returningInventoryCost - lastReturnedAdjustedCost)
      const excessSoldQuantity = Math.max(totalSoldQuantityBeforeReturn, totalReturnedQuantityBeforeReturn) - totalReturnedQuantityBeforeReturn

      // 8. Insert borrow return record
      const insertResult = await trx('borrow_from_returns')
        .insert({
          borrowed_inventory_id,
          returning_inventory_id,
          estimated_price: returningInventoryCost,
          actual_price: returningInventoryCost,
          quantity_returned: quantityToReturn,
          returned_on: returned_on,
          note: note || null,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now(),
          sync_status: 'pending'
        })
        .returning('id')

      if (!insertResult || !Array.isArray(insertResult) || insertResult.length === 0) {
        throw new Error('Failed to create borrow_from_returns record')
      }

      const borrowReturnId = insertResult[0]?.id || insertResult[0]

      // 9. Update borrow_from_inventories status
      const totalReturnedAfter = totalReturnedQuantityBeforeReturn + quantityToReturn
      const isSettled = totalReturnedAfter >= totalBorrowedQuantity

      await trx('borrow_from_inventories')
        .where('id', originalBorrowRecord.id)
        .update({
          status: isSettled ? 'returned' : 'partially_returned',
          last_updated: trx.fn.now()
        })

      // 10. Update borrowed inventory price to the returning cost (high-water mark logic)
      // Only update if returning cost is higher than current cost
      if (returningInventoryCost > lastReturnedAdjustedCost) {
        await trx('inventories')
          .where('id', borrowed_inventory_id)
          .update({
            purchase_price: returningInventoryCost,
            last_updated: trx.fn.now()
          })
      }

      // 11. Decrement quantity from returning inventory
      await trx('inventories')
        .where('id', returning_inventory_id)
        .decrement('quantity', quantityToReturn)
        .update({
          last_updated: trx.fn.now()
        })

      // 12. Create bin card entry for the return
      const binRecord = await trx('bin_cards')
        .where({ product_id: returningInventory.product_id })
        .orderBy('id', 'desc')
        .first()

      const binBalance = binRecord ? (parseInt(binRecord.balance, 10) || 0) : 0

      await trx('bin_cards')
        .insert({
          product_id: returningInventory.product_id,
          inventory_id: returning_inventory_id,
          transaction_type: 'issued', // Outgoing transaction
          quantity_out: quantityToReturn,
          quantity_in: 0,
          unit_cost: returningInventoryCost,
          total_cost: fm(returningInventoryCost * quantityToReturn),
          balance: binBalance - quantityToReturn,
          batch_no: returningInventory.batch_no || null,
          expiry_date: returningInventory.expiry_date || null,
          transaction_date: returned_on,
          reference_id: borrowReturnId,
          reference_table: 'borrow_from_returns',
          reason: 'Borrow Return - Return to Supplier',
          notes: note || null,
          created_by: userId || null,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now(),
          sync_status: 'pending'
        })

      // 13. Prepare GL entries
      const entries = []
      const unreturnedQtyAfter = totalBorrowedQuantity - totalReturnedAfter

      // A. Revalue the unreturned inventory (mark-to-market adjustment)
      if (costDifference !== 0 && unreturnedQtyAfter > 0) {
        if (costDifference > 0) {
          // Cost increased: DR Inventory, CR Accounts Payable
          entries.push({
            account_code: ACC_INVENTORY.code,
            debit: fm(costDifference * unreturnedQtyAfter),
            credit: 0,
            description: `Inventory revaluation for unreturned quantity (${unreturnedQtyAfter} units)`
          })
          entries.push({
            account_code: ACC_AP.code,
            debit: 0,
            credit: fm(costDifference * unreturnedQtyAfter),
            description: `Accounts Payable adjustment for inventory revaluation`
          })
        } else {
          // Cost decreased: CR Inventory, DR Accounts Payable
          entries.push({
            account_code: ACC_INVENTORY.code,
            debit: 0,
            credit: fm(Math.abs(costDifference) * unreturnedQtyAfter),
            description: `Inventory revaluation for unreturned quantity (${unreturnedQtyAfter} units)`
          })
          entries.push({
            account_code: ACC_AP.code,
            debit: fm(Math.abs(costDifference) * unreturnedQtyAfter),
            credit: 0,
            description: `Accounts Payable adjustment for inventory revaluation`
          })
        }
      }

      // B. Adjust COGS for excess sold quantity (if any)
      if (excessSoldQuantity > 0 && costDifference !== 0) {
        if (costDifference > 0) {
          // Cost increased: DR COGS, CR Inventory
          entries.push({
            account_code: ACC_COGS.code,
            debit: fm(costDifference * excessSoldQuantity),
            credit: 0,
            description: `COGS adjustment for excess sold quantity (${excessSoldQuantity} units)`
          })
          entries.push({
            account_code: ACC_INVENTORY.code,
            debit: 0,
            credit: fm(costDifference * excessSoldQuantity),
            description: `Inventory adjustment for excess sold quantity`
          })
        } else {
          // Cost decreased: CR COGS, DR Inventory
          entries.push({
            account_code: ACC_COGS.code,
            debit: 0,
            credit: fm(Math.abs(costDifference) * excessSoldQuantity),
            description: `COGS adjustment for excess sold quantity (${excessSoldQuantity} units)`
          })
          entries.push({
            account_code: ACC_INVENTORY.code,
            debit: fm(Math.abs(costDifference) * excessSoldQuantity),
            credit: 0,
            description: `Inventory adjustment for excess sold quantity`
          })
        }
      }

      // C. Record the return transaction (reduce Accounts Payable, reduce Inventory)
      const returnValue = fm(returningInventoryCost * quantityToReturn)
      if (returnValue > 0) {
        entries.push({
          account_code: ACC_AP.code,
          debit: returnValue,
          credit: 0,
          description: `Accounts Payable reduction for returned quantity (${quantityToReturn} units)`
        })
        entries.push({
          account_code: ACC_INVENTORY.code,
          debit: 0,
          credit: returnValue,
          description: `Inventory reduction for returned quantity (${quantityToReturn} units)`
        })
      }

      // 14. Post GL transaction if there are entries
      let glEntries = null
      if (entries.length > 0) {
        const referenceNo = `BR-${returned_on.replace(/-/g, '')}-${borrowReturnId}`
        glEntries = await this.ledgerHelper.postGLTransaction({
          transaction_date: returned_on,
          reference_no: referenceNo,
          reference_table: 'borrow_from_returns',
          reference_id: borrowReturnId,
          description: `Borrow return adjustments for inventory ${borrowed_inventory_id} on ${returned_on}${note ? ` - ${note}` : ''}`,
          transaction_type: 'borrow_return',
          entries: entries,
          inventory_id: borrowed_inventory_id,
          created_by: userId || null
        }, trx)
      }

      return {
        success: true,
        borrowReturnId,
        oldAdjustedPrice: lastReturnedAdjustedCost,
        newAdjustedPrice: returningInventoryCost,
        priceDifference: costDifference,
        adjustments: entries.length,
        glEntries: glEntries,
        message: 'Borrow return processed successfully'
      }
    } catch (error) {
      throw new Error(`Borrow return processing failed: ${error.message}`)
    }
  }
}
