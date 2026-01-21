/**
 * Service: Business logic layer for bin_cards
 * Orchestrates use cases and coordinates between repository and business rules
 */
export class BinCardsService {
  constructor(repository) {
    this.repository = repository
  }

  /**
   * Get bin card transactions for a product
   * @param {number} productId - Product ID
   * @param {Object} params - { limit, offset, sortBy, orderBy, search, filter }
   * @returns {Object} - { transactions, total }
   */
  async getByProductId(productId, params = {}) {
    if (!productId || isNaN(parseInt(productId, 10))) {
      const error = new Error('Valid product ID is required')
      error.status = 400
      throw error
    }

    const { search = '', filter = {} } = params

    const transactions = await this.repository.findByProductId(productId, params)
    const total = await this.repository.countByProductId(productId, { search, filter })

    return {
      transactions,
      total
    }
  }

  /**
   * Export bin card transactions to CSV
   * @param {number} productId - Product ID
   * @param {Object} params - { limit, offset, sortBy, orderBy, search, filter }
   * @returns {string} CSV formatted string
   */
  async exportToCSV(productId, params = {}) {
    if (!productId || isNaN(parseInt(productId, 10))) {
      const error = new Error('Valid product ID is required')
      error.status = 400
      throw error
    }

    // For export, we typically want all matching records, not just one page
    const exportParams = {
      ...params,
      limit: params.limit || 10000, // Large limit for export
      offset: 0
    }

    const transactions = await this.repository.findByProductId(productId, exportParams)
    
    // CSV Headers
    const headers = [
      'Transaction Date',
      'Transaction Type',
      'Reason',
      'Quantity In',
      'Quantity Out',
      'Balance',
      'Location',
      'Batch Number',
      'Document Number',
      'Reference Table',
      'User',
      'Unit Cost',
      'Total Cost',
      'Notes'
    ]
    
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
    
    // Helper function to format transaction type
    const formatTransactionType = (type) => {
      const typeMap = {
        'received': 'Received (IN)',
        'issued': 'Issued (OUT)',
        'voided': 'Voided',
        'adjustment': 'Adjustment',
        'opening': 'Opening',
        'return': 'Return',
        'transfer_in': 'Transfer In',
        'transfer_out': 'Transfer Out',
        'expired': 'Expired',
        'damaged': 'Damaged'
      }
      return typeMap[type] || type || ''
    }
    
    // Convert transactions to CSV rows
    const rows = transactions.map(txn => {
      return [
        escapeCSV(formatDate(txn.transaction_date)),
        escapeCSV(formatTransactionType(txn.transaction_type)),
        escapeCSV(txn.reason || ''),
        escapeCSV(txn.quantity_in || 0),
        escapeCSV(txn.quantity_out || 0),
        escapeCSV(txn.balance || 0),
        escapeCSV(txn.location || ''),
        escapeCSV(txn.batch_no || ''),
        escapeCSV(txn.document_no || ''),
        escapeCSV(txn.reference_table || ''),
        escapeCSV(txn.user_name || ''),
        escapeCSV(txn.unit_cost || 0),
        escapeCSV(txn.total_cost || 0),
        escapeCSV(txn.notes || '')
      ].join(',')
    })
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n')
    
    return csvContent
  }
}
