/**
 * Service: Business logic layer for bin_cards
 * Orchestrates use cases and coordinates between repository and business rules
 */
export class BinCardsService {
  constructor(repository) {
    this.repository = repository
  }

  async getByProductId(tenantId, productId, params = {}) {
    if (!productId || isNaN(parseInt(productId, 10))) {
      const error = new Error('Valid product ID is required')
      error.status = 400
      throw error
    }

    const { search = '', filter = {} } = params

    const transactions = await this.repository.findByProductId(tenantId, productId, params)
    const total = await this.repository.countByProductId(tenantId, productId, { search, filter })

    return {
      transactions,
      total
    }
  }

  async exportToCSV(tenantId, productId, params = {}) {
    if (!productId || isNaN(parseInt(productId, 10))) {
      const error = new Error('Valid product ID is required')
      error.status = 400
      throw error
    }

    const exportParams = {
      ...params,
      limit: params.limit || 10000,
      offset: 0
    }

    const transactions = await this.repository.findByProductId(tenantId, productId, exportParams)

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

    const formatTransactionType = (type) => {
      const typeMap = {
        received: 'Received (IN)',
        issued: 'Issued (OUT)',
        voided: 'Voided',
        adjustment: 'Adjustment',
        opening: 'Opening',
        return: 'Return',
        transfer_in: 'Transfer In',
        transfer_out: 'Transfer Out',
        expired: 'Expired',
        damaged: 'Damaged'
      }
      return typeMap[type] || type || ''
    }

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

    return [headers.join(','), ...rows].join('\n')
  }
}
