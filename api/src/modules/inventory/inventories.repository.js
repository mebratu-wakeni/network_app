/**
 * Repository: Data access layer for inventories/stock
 * Encapsulates all database queries for inventories table
 */
export class InventoriesRepository {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * Get the last balance for a product from bin cards
   * Returns the most recent balance for the product, or 0 if no transactions exist
   */
  async getLastProductBalance(productId) {
    const lastTransaction = await this.knex('bin_cards')
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
  async createBinCardTransaction(params) {
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

    // Calculate values if not provided (backward compatibility for import)
    const finalQuantityIn = quantityIn !== null ? quantityIn : (transactionType === 'received' ? quantity : 0)
    const finalQuantityOut = quantityOut !== null ? quantityOut : (transactionType === 'issued' ? quantity : 0)
    const finalBalance = balance !== null ? balance : (openingBalance + finalQuantityIn - finalQuantityOut)
    const totalCost = finalQuantityIn * unitCost

    const [binCard] = await this.knex('bin_cards')
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
        created_at: this.knex.fn.now(),
        last_updated: this.knex.fn.now()
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
   * Find existing inventory record by product and variation details
   * Checks for existing record with same product_id, batch_no, expiry_date, purchase_price
   */
  async findExistingInventory(productId, batchNo, expiryDate, purchasePrice) {
    let query = this.knex('inventories')
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
  async getMaxVariationNumber(productCode) {
    // Extract 4 digits from product code (e.g., 'PRD0011' -> '0011')
    const productCodeDigits = this.extractProductCodeDigits(productCode)
    if (!productCodeDigits) {
      return 0
    }

    // Find all inventory codes for this product that match pattern 'I###XXXX'
    const inventories = await this.knex('inventories')
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
  async generateInventoryCode(productCode) {
    const productCodeDigits = this.extractProductCodeDigits(productCode)
    if (!productCodeDigits) {
      throw new Error(`Invalid product code format: ${productCode}`)
    }

    const maxVariation = await this.getMaxVariationNumber(productCode)
    const nextVariation = maxVariation + 1
    
    // Format variation number as 3-digit string (001, 002, ..., 999)
    const variationStr = String(nextVariation).padStart(3, '0')
    
    return `I${variationStr}${productCodeDigits}`
  }

  /**
   * Bulk import stock items
   * @param {Array} stockItems - Array of stock items to import
   * @param {Object} options - Import options (e.g., purchase_date, acquisition_type, reason, created_by)
   * @returns {Object} - { successful: [], failed: [], summary: {...} }
   */
  async bulkImport(stockItems, options = {}) {
    const successful = []
    const failed = []
    const purchaseDate = options.purchase_date || new Date().toISOString().split('T')[0]
    const acquisitionType = options.acquisition_type || 'cash'
    const reason = options.reason || 'Bulk Import'
    const createdBy = options.created_by || null

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

        // Find product by code or name
        let product = null
        if (item.product_code) {
          product = await this.findProductByCode(item.product_code)
        }
        
        if (!product && item.product_name) {
          product = await this.findProductByName(item.product_name)
        }

        if (!product) {
          failed.push({
            index: i,
            item,
            error: `Product not found: ${item.product_code || item.product_name}`
          })
          continue
        }

        // Check if inventory record already exists with same variation
        const existing = await this.findExistingInventory(
          product.id,
          item.batch_number || null,
          item.expiry_date || null,
          parseFloat(item.unit_cost)
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
          await this.knex('inventories')
            .where({ id: existing.id })
            .update({
              quantity: this.knex.raw('quantity + ?', [quantityAdded]),
              last_updated: this.knex.fn.now()
            })
        } else {
          // Generate new inventory code
          inventoryCode = await this.generateInventoryCode(product.product_code)
          
          // Insert new inventory record
          const [inserted] = await this.knex('inventories')
            .insert({
              product_id: product.id,
              inventory_code: inventoryCode,
              batch_no: item.batch_number || null,
              expiry_date: item.expiry_date || null,
              purchase_date: purchaseDate,
              acquisition_type: acquisitionType,
              purchase_price: purchasePrice,
              quantity: quantityAdded,
              selling_price: item.selling_price ? parseFloat(item.selling_price) : null,
              location: item.location || null,
              notes: reason,
              created_at: this.knex.fn.now(),
              last_updated: this.knex.fn.now()
            })
            .returning('id')
          
          inventoryId = inserted.id || inserted
        }

        // Get opening balance for bin card transaction
        const openingBalance = await this.getLastProductBalance(product.id)

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
        })

        successful.push({
          index: i,
          item,
          inventory_id: inventoryId,
          inventory_code: inventoryCode,
          product_id: product.id,
          product_code: product.product_code
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

  /**
   * Find all inventories/stock with pagination, search, and sorting
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

    // Base query with joins for product and category/unit names
    // Note: expiry_threshold column may not exist if migration hasn't been run
    // We'll default to 30 in the transformation code
    let query = this.knex('inventories')
      .select(
        'inventories.*',
        'products.product_code',
        'products.name as product_name',
        'products.description as product_description',
        'categories.name as category',
        'units.name as unit'
      )
      .leftJoin('products', 'inventories.product_id', 'products.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .leftJoin('units', 'products.unit_id', 'units.id')

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

    // Apply filters
    if (filter !== 'all') {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const HIGH_VALUE_THRESHOLD = 1000

      query = query.where(function() {
        if (filter === 'out-of-stock') {
          this.where('inventories.quantity', 0)
        } else if (filter === 'low-stock') {
          this.where('inventories.quantity', '>', 0)
            .where('inventories.quantity', '<', 50)
        } else if (filter === 'expired') {
          this.whereNotNull('inventories.expiry_date')
            .where('inventories.expiry_date', '<', todayStr)
        } else if (filter === 'expiring-soon') {
          // Get products with expiry_threshold
          this.whereNotNull('inventories.expiry_date')
            .where('inventories.expiry_date', '>=', todayStr)
            .where(function() {
              // Use default 30 days (expiry_threshold column may not exist if migration hasn't been run)
              this.whereRaw(`inventories.expiry_date <= (?::date + INTERVAL '30 days')`, [todayStr])
            })
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

    // Calculate stats from all matching records (not just paginated)
    // Note: Not selecting expiry_threshold as it may not exist yet
    const statsQuery = this.knex('inventories')
      .select('inventories.*')
      .leftJoin('products', 'inventories.product_id', 'products.id')

    // Apply same search and filter for stats
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      statsQuery.where(function() {
        this.whereRaw('LOWER(products.name) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(products.product_code) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(inventories.inventory_code) LIKE ?', [searchTerm.toLowerCase()])
          .orWhereRaw('LOWER(inventories.location) LIKE ?', [searchTerm.toLowerCase()])
      })
    }

    if (filter !== 'all') {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const HIGH_VALUE_THRESHOLD = 1000

      statsQuery.where(function() {
        if (filter === 'out-of-stock') {
          this.where('inventories.quantity', 0)
        } else if (filter === 'low-stock') {
          this.where('inventories.quantity', '>', 0)
            .where('inventories.quantity', '<', 50)
        } else if (filter === 'expired') {
          this.whereNotNull('inventories.expiry_date')
            .where('inventories.expiry_date', '<', todayStr)
        } else if (filter === 'expiring-soon') {
          this.whereNotNull('inventories.expiry_date')
            .where('inventories.expiry_date', '>=', todayStr)
            .where(function() {
              // Use default 30 days (expiry_threshold column may not exist if migration hasn't been run)
              this.whereRaw(`inventories.expiry_date <= (?::date + INTERVAL '30 days')`, [todayStr])
            })
        } else if (filter === 'high-value') {
          this.where('inventories.purchase_price', '>=', HIGH_VALUE_THRESHOLD)
        }
      })
    }

    const allStock = await statsQuery
    const stats = this.calculateStockStats(allStock)

    // Transform to frontend format
    const transformedStock = stock.map(item => ({
      id: item.id,
      inventoryCode: item.inventory_code,
      productCode: item.product_code,
      name: item.product_name,
      category: item.category,
      location: item.location,
      quantity: parseInt(item.quantity, 10),
      unit: item.unit,
      unitCost: parseFloat(item.purchase_price),
      sellingPrice: item.selling_price ? parseFloat(item.selling_price) : null,
      expiryDate: item.expiry_date,
      batchNumber: item.batch_no,
      status: item.quantity === 0 ? 'out-of-stock' : (item.quantity < 50 ? 'low-stock' : 'active'),
      expiry_threshold: item.expiry_threshold || 30,
      product: {
        expiry_threshold: item.expiry_threshold || 30
      }
    }))

    return {
      stock: transformedStock,
      total: parseInt(total || 0, 10),
      stats
    }
  }

  /**
   * Calculate stock statistics
   * @param {Array} stockList - Array of stock items
   * @returns {Object} Statistics object
   */
  calculateStockStats(stockList) {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const DEFAULT_EXPIRY_THRESHOLD = 30
    const HIGH_VALUE_THRESHOLD = 1000

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

    stockList.forEach(item => {
      const quantity = parseInt(item.quantity || 0, 10)
      const purchasePrice = parseFloat(item.purchase_price || 0)
      const expiryDate = item.expiry_date
      const expiryThreshold = item.expiry_threshold || DEFAULT_EXPIRY_THRESHOLD

      if (quantity === 0) stats.outOfStock++
      if (quantity > 0 && quantity < 50) stats.lowStock++
      if (purchasePrice >= HIGH_VALUE_THRESHOLD) stats.highValue++

      if (expiryDate) {
        const expiry = new Date(expiryDate)
        const expiryDateStr = expiry.toISOString().split('T')[0]
        
        if (expiryDateStr < todayStr) {
          stats.expired++
        } else {
          const thresholdDate = new Date(today)
          thresholdDate.setDate(today.getDate() + expiryThreshold)
          const thresholdDateStr = thresholdDate.toISOString().split('T')[0]
          
          if (expiryDateStr <= thresholdDateStr) {
            stats.expiringSoon++
          }
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
    const [updated] = await this.knex('inventories')
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
    })

    // If reason is "Borrow To" and we're subtracting stock, create borrow_to_inventories record
    if (isBorrowTo && quantityOut > 0 && partnerIdValue) {
      // Check if borrow_to_inventories table exists (for migration safety)
      const tableExists = await this.knex.schema.hasTable('borrow_to_inventories')
      
      if (tableExists) {
        await this.knex('borrow_to_inventories').insert({
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
          created_at: this.knex.fn.now(),
          last_updated: this.knex.fn.now(),
          sync_status: 'pending'
        })
      }
    }

    return updated
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
            acquisition_type: 'borrow',
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

      // 3. Create borrow_from_inventories record first (so we can reference it in bin card)
      const [borrowFromRecord] = await trx('borrow_from_inventories')
        .insert({
          product_id: productIdValue,
          partner_id: partnerIdValue,
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
}
