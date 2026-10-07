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

  async bulkImport(tenantId, stockItems, options = {}) {
    if (!Array.isArray(stockItems) || stockItems.length === 0) {
      throw new Error('Stock items array is required and must not be empty')
    }

    const transactionDate = options.purchase_date || options.purchaseDate || todayIso()
    await assertFiscalYearOpen(this.repository.knex, tenantId, transactionDate)

    const result = await this.repository.bulkImport(tenantId, stockItems, options)

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

  async findAll(tenantId, params = {}) {
    return this.repository.findAll(tenantId, params)
  }

  async findInventoriesByProduct(tenantId, productId) {
    return this.repository.findInventoriesByProduct(tenantId, productId)
  }

  async exportToCSV(tenantId, params = {}) {
    const exportParams = {
      ...params,
      limit: params.limit || 10000,
      offset: 0
    }

    const result = await this.repository.findAll(tenantId, exportParams)
    const stockItems = result.stock || []

    const headers = ['Product Code', 'Product Name', 'Category', 'Location', 'Quantity', 'Unit', 'Unit Cost', 'Selling Price', 'Expiry Date', 'Batch Number', 'Inventory Code', 'Status']

    const escapeCSV = (field) => {
      if (field === null || field === undefined) return ''
      const str = String(field)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

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

    return [headers.join(','), ...rows].join('\n')
  }

  async update(tenantId, inventoryId, updateData) {
    if (!inventoryId || isNaN(parseInt(inventoryId, 10))) {
      const error = new Error('Valid inventory ID is required')
      error.status = 400
      throw error
    }

    const updated = await this.repository.updateById(tenantId, inventoryId, updateData)

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

  async adjustStock(tenantId, inventoryId, adjustmentData, userId = null) {
    if (!inventoryId || isNaN(parseInt(inventoryId, 10))) {
      const error = new Error('Valid inventory ID is required')
      error.status = 400
      throw error
    }

    const transactionDate =
      adjustmentData.adjustmentDate ||
      adjustmentData.adjustment_date ||
      todayIso()
    await assertFiscalYearOpen(this.repository.knex, tenantId, transactionDate)

    const updated = await this.repository.adjustStockQuantity(tenantId, inventoryId, adjustmentData, userId)

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

  async createBorrowFrom(tenantId, borrowData, userId = null) {
    await assertFiscalYearOpen(this.repository.knex, tenantId, todayIso())

    const borrowFromRecord = await this.repository.createBorrowFromInventory(tenantId, borrowData, userId)

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

  async getBorrowToReturnHistory(tenantId, borrowToInventoryId) {
    return await this.repository.getBorrowToReturnHistory(tenantId, borrowToInventoryId)
  }

  async processBorrowToReturn(tenantId, returnData, userId = null) {
    const transactionDate =
      returnData.returnedDate ||
      returnData.returned_date ||
      todayIso()
    await assertFiscalYearOpen(this.repository.knex, tenantId, transactionDate)

    return await this.repository.processBorrowToReturn(tenantId, returnData, userId)
  }

  async getBorrowFromReturnStatus(tenantId, opts) {
    return await this.repository.getBorrowFromReturnStatus(tenantId, opts)
  }

  async processBorrowFromReturn(tenantId, returnData, userId = null) {
    const transactionDate =
      returnData.returnedOn ||
      returnData.returned_on ||
      todayIso()
    await assertFiscalYearOpen(this.repository.knex, tenantId, transactionDate)

    return await this.repository.processBorrowFromReturn(tenantId, returnData, userId)
  }
}
