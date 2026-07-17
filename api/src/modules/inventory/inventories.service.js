/**
 * Service: Business logic layer for inventories/stock
 * Orchestrates use cases and coordinates between repository and business rules
 */
import { assertFiscalYearOpen } from '../../services/fiscal-year.guard.js'

function todayIso () {
  return new Date().toISOString().split('T')[0]
}

export class InventoriesService {
  constructor(repository) {
    this.repository = repository
  }

  /**
   * Bulk import stock items
   * @param {Array} stockItems - Array of stock items to import
   * @param {Object} options - Import options (purchase_date, acquisition_type, reason, created_by)
   * @returns {Object} Summary with { total, successful, failed, results }
   */
  async bulkImport(stockItems, options = {}) {
    if (!Array.isArray(stockItems) || stockItems.length === 0) {
      throw new Error('Stock items array is required and must not be empty')
    }

    const transactionDate = options.purchase_date || options.purchaseDate || todayIso()
    await assertFiscalYearOpen(this.repository.knex, transactionDate)

    // Stock items are already transformed to backend format in the controller
    const result = await this.repository.bulkImport(stockItems, options)

    return {
      total: result.summary.total,
      successful: result.summary.successful,
      failed: result.summary.failed,
      results: result.successful.map(r => ({
        success: true,
        index: r.index,
        inventory_id: r.inventory_id,
        inventory_code: r.inventory_code,
        product_id: r.product_id,
        product_code: r.product_code
      })).concat(
        result.failed.map(r => ({
          success: false,
          issueKind: 'error',
          index: r.index,
          csvRowNumber: r.csvRowNumber ?? null,
          error: r.error || r.message
        }))
      )
    }
  }

  /**
   * Get all stock/inventories with pagination, search, filters, and sorting
   * @param {Object} params - { limit, offset, search, filter, sortBy, orderBy }
   * @returns {Object} - { stock, total, stats }
   */
  async findAll(params = {}) {
    return this.repository.findAll(params)
  }

  /**
   * Get inventories by product_id (inventories table only). All have valid inventory id.
   * @param {number} productId
   * @returns {Promise<Array>}
   */
  async findInventoriesByProduct(productId) {
    return this.repository.findInventoriesByProduct(productId)
  }

  /**
   * Export stock/inventories to CSV
   * @param {Object} params - { limit, offset, search, filter, sortBy, orderBy }
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
    const stockItems = result.stock || []
    
    // CSV Headers
    const headers = ['Product Code', 'Product Name', 'Category', 'Location', 'Quantity', 'Unit', 'Unit Cost', 'Selling Price', 'Expiry Date', 'Batch Number', 'Inventory Code', 'Status']
    
    // Helper function to escape CSV fields
    const escapeCSV = (field) => {
      if (field === null || field === undefined) return ''
      const str = String(field)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }
    
    // Helper function to format date
    const formatDate = (dateStr) => {
      if (!dateStr) return ''
      try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return ''
        const day = String(date.getDate()).padStart(2, '0')
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const year = date.getFullYear()
        return `${day}/${month}/${year}`
      } catch (error) {
        return ''
      }
    }
    
    // Helper function to get status (low stock = product total quantity < threshold)
    const getStatus = (item) => {
      const productTotal = item.productTotalQuantity != null ? item.productTotalQuantity : item.quantity
      if (productTotal === 0) return 'Out of Stock'
      if (item.expiryDate) {
        const expiry = new Date(item.expiryDate)
        const today = new Date()
        if (expiry < today) return 'Expired'
        const expiryThreshold = item.expiry_threshold || item.product?.expiry_threshold || 30
        const thresholdDate = new Date()
        thresholdDate.setDate(today.getDate() + expiryThreshold)
        if (expiry <= thresholdDate) return 'Expiring Soon'
      }
      if (productTotal < 50) return 'Low Stock'
      return 'In Stock'
    }
    
    // Convert stock items to CSV rows
    const rows = stockItems.map(item => {
      return [
        escapeCSV(item.productCode || item.product_code || ''),
        escapeCSV(item.name || item.product_name || ''),
        escapeCSV(item.category || ''),
        escapeCSV(item.location || ''),
        escapeCSV(item.quantity || 0),
        escapeCSV(item.unit || ''),
        escapeCSV(item.unitCost || item.unit_cost || 0),
        escapeCSV(item.sellingPrice || item.selling_price || ''),
        escapeCSV(formatDate(item.expiryDate || item.expiry_date)),
        escapeCSV(item.batchNumber || item.batch_number || ''),
        escapeCSV(item.inventoryCode || item.inventory_code || ''),
        escapeCSV(getStatus(item))
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
   * Update a stock item
   * @param {number} inventoryId - Inventory ID
   * @param {Object} updateData - Fields to update
   * @returns {Object} Updated inventory record
   */
  async update(inventoryId, updateData) {
    if (!inventoryId || isNaN(parseInt(inventoryId, 10))) {
      const error = new Error('Valid inventory ID is required')
      error.status = 400
      throw error
    }

    const updated = await this.repository.updateById(inventoryId, updateData)
    
    // Transform to frontend format
    return {
      id: updated.id,
      inventoryCode: updated.inventory_code,
      productCode: updated.product_code,
      location: updated.location,
      quantity: parseInt(updated.quantity, 10),
      unitCost: parseFloat(updated.purchase_price),
      sellingPrice: updated.selling_price ? parseFloat(updated.selling_price) : null,
      expiryDate: updated.expiry_date,
      batchNumber: updated.batch_no,
      location: updated.location
    }
  }

  /**
   * Adjust stock quantity
   * @param {number} inventoryId - Inventory ID
   * @param {Object} adjustmentData - Adjustment data
   * @param {number} userId - User ID performing the adjustment
   * @returns {Object} Updated inventory record
   */
  async adjustStock(inventoryId, adjustmentData, userId = null) {
    if (!inventoryId || isNaN(parseInt(inventoryId, 10))) {
      const error = new Error('Valid inventory ID is required')
      error.status = 400
      throw error
    }

    const transactionDate =
      adjustmentData.adjustmentDate ||
      adjustmentData.adjustment_date ||
      todayIso()
    await assertFiscalYearOpen(this.repository.knex, transactionDate)

    const updated = await this.repository.adjustStockQuantity(inventoryId, adjustmentData, userId)
    
    // Transform to frontend format
    return {
      id: updated.id,
      inventoryCode: updated.inventory_code,
      productCode: updated.product_code,
      location: updated.location,
      quantity: parseInt(updated.quantity, 10),
      unitCost: parseFloat(updated.purchase_price),
      sellingPrice: updated.selling_price ? parseFloat(updated.selling_price) : null,
      expiryDate: updated.expiry_date,
      batchNumber: updated.batch_no
    }
  }

  /**
   * Create borrow from inventory record
   * This creates:
   * 1. Inventory record (stock added to our inventory)
   * 2. Bin card entry (transaction tracking)
   * 3. Borrow_from_inventories record (borrowing record)
   * @param {Object} borrowData - Borrow from data
   * @param {number} userId - User ID creating the record
   * @returns {Object} Created borrow_from_inventories record with inventory info
   */
  async createBorrowFrom(borrowData, userId = null) {
    await assertFiscalYearOpen(this.repository.knex, todayIso())

    const borrowFromRecord = await this.repository.createBorrowFromInventory(borrowData, userId)
    
    // Transform to frontend format
    return {
      id: borrowFromRecord.id,
      productId: borrowFromRecord.product_id,
      partnerId: borrowFromRecord.partner_id,
      quantity: parseInt(borrowFromRecord.quantity, 10),
      unitCost: parseFloat(borrowFromRecord.unit_cost),
      batchNo: borrowFromRecord.batch_no,
      expiryDate: borrowFromRecord.expiry_date,
      location: borrowFromRecord.location,
      borrowedDate: borrowFromRecord.borrowed_date,
      status: borrowFromRecord.status,
      notes: borrowFromRecord.notes,
      inventoryId: borrowFromRecord.inventory_id,
      inventoryCode: borrowFromRecord.inventory_code
    }
  }

  /**
   * Get return history for a borrow_to_inventory record
   * @param {number} borrowToInventoryId - ID from borrow_to_inventories table
   * @returns {Array} Array of return records
   */
  async getBorrowToReturnHistory(borrowToInventoryId) {
    return await this.repository.getBorrowToReturnHistory(borrowToInventoryId)
  }

  /**
   * Process return of borrowed-to items
   * @param {Object} returnData - Return data
   * @param {number} userId - User ID processing the return
   * @returns {Object} Created return record with inventory info
   */
  async processBorrowToReturn(returnData, userId = null) {
    const transactionDate =
      returnData.returnedDate ||
      returnData.returned_date ||
      todayIso()
    await assertFiscalYearOpen(this.repository.knex, transactionDate)

    return await this.repository.processBorrowToReturn(returnData, userId)
  }

  /**
   * Get return status for a borrowed-from item (total borrowed, total returned, remaining).
   * @param {Object} opts - { borrowFromId?: number, borrowedInventoryId?: number }
   * @returns {Object} { totalBorrowed, totalReturned, remaining }
   */
  async getBorrowFromReturnStatus(opts) {
    return await this.repository.getBorrowFromReturnStatus(opts)
  }

  /**
   * Process return of borrowed-from items (AP + Borrow Variance + inventory at returning lot cost).
   * @param {Object} returnData - Return data
   * @param {number} userId - User ID processing the return
   * @returns {Object} Result of the operation
   */
  async processBorrowFromReturn(returnData, userId = null) {
    const transactionDate =
      returnData.returnedOn ||
      returnData.returned_on ||
      todayIso()
    await assertFiscalYearOpen(this.repository.knex, transactionDate)

    return await this.repository.processBorrowFromReturn(returnData, userId)
  }
}
