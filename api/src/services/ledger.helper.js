/**
 * Ledger Helper: Helper functions for recording account ledger transactions
 * Handles double-entry accounting for all financial transactions
 * Shared resource for inventory, sales, purchase, financials, and other modules
 * Inspired by general ledger helper pattern with running balance calculation
 */

export class LedgerHelper {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * Get account ID by account code
   * @param {string} accountCode - Account code (e.g., '1300', '1100')
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<number|null>} Account ID or null if not found
   */
  async getAccountIdByCode(accountCode, trx = null) {
    const db = trx || this.knex
    const account = await db('chart_of_accounts')
      .where({ account_code: accountCode, is_active: true })
      .first()
    
    return account ? account.id : null
  }

  /**
   * Get account balance as of a specific date
   * Gets the last balance entry for the account up to the given date
   * @param {string} accountCode - Account code
   * @param {string} asOfDate - Date in YYYY-MM-DD format
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<number>} Account balance
   */
  async getAccountBalance(accountCode, asOfDate, trx = null) {
    const db = trx || this.knex
    
    // Get the last entry for this account up to the given date
    // The balance field stores the running balance
    const lastEntry = await db('account_ledger')
      .where('account_code', accountCode)
      .where('transaction_date', '<=', asOfDate)
      .orderBy('id', 'desc')
      .first()

    return lastEntry ? parseFloat(lastEntry.balance || 0) : 0
  }

  /**
   * Get current balance for multiple accounts (latest ledger row per account by id).
   * Balance can be positive or negative depending on account nature (e.g. AP may be negative when we owe).
   * @param {string[]} accountCodes - Account codes (e.g. ['5100', '1300', '6100', '3100', '1200'])
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} { accountCode: balance (number), ... }
   */
  async getCurrentBalances(accountCodes, trx = null) {
    const db = trx || this.knex
    if (!accountCodes || accountCodes.length === 0) return {}

    const result = {}
    for (const code of accountCodes) {
      const lastEntry = await db('account_ledger')
        .where('account_code', code)
        .orderBy('id', 'desc')
        .first()
      result[code] = lastEntry ? parseFloat(lastEntry.balance || 0) : 0
    }
    return result
  }

  /**
   * Post a double-entry transaction to the account ledger
   * Creates separate rows for each account (matching reference implementation)
   * @param {Object} transactionData - Transaction data
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries with calculated balances
   */
  async postGLTransaction(transactionData, trx = null) {
    const {
      transaction_date: rawTransactionDate,
      reference_no,
      reference_table,
      reference_id,
      description,
      transaction_type,
      entries, // Array of { account_code, debit, credit, description }
      inventory_id = null,
      created_by = null
    } = transactionData

    const db = trx || this.knex

    // Normalize transaction_date to YYYY-MM-DD string (DB may return Date object)
    let transaction_date
    if (rawTransactionDate == null) {
      transaction_date = null
    } else if (typeof rawTransactionDate === 'string') {
      transaction_date = rawTransactionDate.length >= 10 ? rawTransactionDate.slice(0, 10) : rawTransactionDate
    } else if (rawTransactionDate instanceof Date) {
      transaction_date = rawTransactionDate.toISOString().split('T')[0]
    } else {
      transaction_date = String(rawTransactionDate).slice(0, 10)
    }

    // Validate required fields
    if (!transaction_date || !entries || !Array.isArray(entries) || entries.length === 0) {
      throw new Error('Missing required fields: transaction_date, entries (array)')
    }

    // Validate that debits equal credits
    const totalDebits = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0)
    const totalCredits = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0)
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error('Debits and credits must be equal')
    }

    // Get account names for each entry
    const accountCodes = entries.map(entry => entry.account_code)
    const accounts = await db('chart_of_accounts')
      .whereIn('account_code', accountCodes)
      .select('account_code', 'account_name')

    const accountMap = {}
    accounts.forEach(account => {
      accountMap[account.account_code] = account.account_name
    })

    // Extract fiscal year and period from transaction date
    const fiscalYear = transaction_date.substring(0, 4)
    const fiscalPeriod = transaction_date.substring(5, 7)

    const insertedEntries = []

    // Post each entry (creates one row per account)
    for (const entry of entries) {
      const accountName = accountMap[entry.account_code]
      if (!accountName) {
        throw new Error(`Account code ${entry.account_code} not found`)
      }

      // Get current balance for this account (before this transaction)
      const lastEntry = await db('account_ledger')
        .where('account_code', entry.account_code)
        .orderBy('id', 'desc')
        .first()

      const currentBalance = lastEntry ? parseFloat(lastEntry.balance || 0) : 0
      const debitAmount = parseFloat(entry.debit || 0)
      const creditAmount = parseFloat(entry.credit || 0)
      const newBalance = currentBalance + debitAmount - creditAmount

      // Insert GL entry (one row per account)
      const [ledgerEntry] = await db('account_ledger')
        .insert({
          transaction_date: transaction_date,
          account_code: entry.account_code,
          account_name: accountName,
          debit: debitAmount,
          credit: creditAmount,
          balance: newBalance,
          reference_no: reference_no,
          reference_table: reference_table,
          reference_id: reference_id,
          description: entry.description || description,
          transaction_type: transaction_type,
          fiscal_year: fiscalYear,
          fiscal_period: fiscalPeriod,
          inventory_id: inventory_id,
          created_by: created_by,
          created_at: db.fn.now(),
          last_updated: db.fn.now(),
          sync_status: 'pending'
        })
        .returning('*')

      insertedEntries.push(ledgerEntry)
    }

    return {
      success: true,
      message: 'GL transaction posted successfully',
      entries: insertedEntries,
      total_debits: totalDebits,
      total_credits: totalCredits
    }
  }

  /**
   * Record ledger entry for initial stock import
   * DR Inventory (1300), CR Opening Balance (4300)
   * Used when importing stock as initial company property
   * @param {Object} params - Transaction parameters
   * @param {number} params.inventoryId - Inventory ID
   * @param {number} params.quantity - Quantity imported
   * @param {number} params.unitCost - Unit cost
   * @param {Date|string} params.transactionDate - Import date
   * @param {string} params.referenceNumber - Reference number (optional)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordInitialStockImport(params, trx = null) {
    const {
      inventoryId,
      quantity,
      unitCost,
      transactionDate,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const totalAmount = quantity * unitCost

    const description = `Initial Stock Import - ${quantity} units @ ${unitCost.toFixed(2)}`

    const entries = [
      {
        account_code: '1300', // Inventory
        debit: totalAmount,
        credit: 0,
        description: description
      },
      {
        account_code: '4300', // Opening Balance
        debit: 0,
        credit: totalAmount,
        description: description
      }
    ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `INIT-STOCK-${inventoryId}`,
      reference_table: 'inventories',
      reference_id: inventoryId,
      description: description,
      transaction_type: 'opening_balance',
      entries: entries,
      inventory_id: inventoryId,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record ledger entry for stock adjustment (add)
   * DR Inventory (1300), CR Opening Balance (4300)
   * @param {Object} params - Transaction parameters
   * @param {number} params.inventoryId - Inventory ID
   * @param {number} params.quantity - Quantity added
   * @param {number} params.unitCost - Unit cost
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.reason - Adjustment reason
   * @param {string} params.referenceNumber - Reference number (optional)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordStockAdjustmentAdd(params, trx = null) {
    const {
      inventoryId,
      quantity,
      unitCost,
      transactionDate,
      reason,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const totalAmount = quantity * unitCost

    const description = `Stock Adjustment (Add) - ${quantity} units @ ${unitCost.toFixed(2)} - ${reason}`

    const entries = [
      {
        account_code: '1300', // Inventory
        debit: totalAmount,
        credit: 0,
        description: description
      },
      {
        account_code: '4300', // Opening Balance
        debit: 0,
        credit: totalAmount,
        description: description
      }
    ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `ADJ-${inventoryId}`,
      reference_table: 'inventories',
      reference_id: inventoryId,
      description: description,
      transaction_type: 'adjustment',
      entries: entries,
      inventory_id: inventoryId,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record ledger entry for stock adjustment (subtract) - Borrow To
   * DR Accounts Receivable (1200), CR Inventory (1300)
   * @param {Object} params - Transaction parameters
   * @param {number} params.inventoryId - Inventory ID
   * @param {number} params.quantity - Quantity subtracted/lent
   * @param {number} params.unitCost - Unit cost
   * @param {number} params.partnerId - Partner/Customer ID (optional)
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.reason - Adjustment reason
   * @param {string} params.referenceNumber - Reference number (optional)
   * @param {number} params.referenceId - borrow_to_inventories id (optional; defaults to inventoryId)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordStockAdjustmentSubtractBorrowTo(params, trx = null) {
    const {
      inventoryId,
      quantity,
      unitCost,
      partnerId = null,
      transactionDate,
      reason,
      referenceNumber = null,
      referenceId = null,
      memo = null,
      createdBy = null
    } = params

    const totalAmount = quantity * unitCost

    const description = `Stock Adjustment (Borrow To) - ${quantity} units @ ${unitCost.toFixed(2)} - ${reason}${partnerId ? ` (Partner ID: ${partnerId})` : ''}`

    const entries = [
      {
        account_code: '1200', // Accounts Receivable
        debit: totalAmount,
        credit: 0,
        description: description
      },
      {
        account_code: '1300', // Inventory
        debit: 0,
        credit: totalAmount,
        description: description
      }
    ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `BORROW-TO-${inventoryId}`,
      reference_table: 'borrow_to_inventories',
      reference_id: referenceId != null ? referenceId : inventoryId,
      description: description,
      transaction_type: 'borrow_to',
      entries: entries,
      inventory_id: inventoryId,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record ledger entry for stock adjustment (subtract) - Other reasons
   * DR Cost of Goods Sold (6100), CR Inventory (1300)
   * @param {Object} params - Transaction parameters
   * @param {number} params.inventoryId - Inventory ID
   * @param {number} params.quantity - Quantity subtracted
   * @param {number} params.unitCost - Unit cost
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.reason - Adjustment reason
   * @param {string} params.referenceNumber - Reference number (optional)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordStockAdjustmentSubtract(params, trx = null) {
    const {
      inventoryId,
      quantity,
      unitCost,
      transactionDate,
      reason,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const totalAmount = quantity * unitCost

    const description = `Stock Adjustment (Subtract) - ${quantity} units @ ${unitCost.toFixed(2)} - ${reason}`

    const entries = [
      {
        account_code: '6100', // Cost of Goods Sold
        debit: totalAmount,
        credit: 0,
        description: description
      },
      {
        account_code: '1300', // Inventory
        debit: 0,
        credit: totalAmount,
        description: description
      }
    ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `ADJ-${inventoryId}`,
      reference_table: 'inventories',
      reference_id: inventoryId,
      description: description,
      transaction_type: 'adjustment',
      entries: entries,
      inventory_id: inventoryId,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record ledger entry for borrow from (receiving borrowed stock)
   * DR Inventory (1300), CR Accounts Payable (3100)
   * @param {Object} params - Transaction parameters
   * @param {number} params.inventoryId - Inventory ID
   * @param {number} params.borrowFromId - Borrow from inventory record ID
   * @param {number} params.quantity - Quantity borrowed
   * @param {number} params.unitCost - Unit cost
   * @param {number} params.partnerId - Partner/Customer ID
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.referenceNumber - Reference number (optional)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordBorrowFrom(params, trx = null) {
    const {
      inventoryId,
      borrowFromId,
      quantity,
      unitCost,
      partnerId,
      transactionDate,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const totalAmount = quantity * unitCost

    const description = `Borrow From - ${quantity} units @ ${unitCost.toFixed(2)} (Partner ID: ${partnerId})`

    const entries = [
      {
        account_code: '1300', // Inventory
        debit: totalAmount,
        credit: 0,
        description: description
      },
      {
        account_code: '3100', // Accounts Payable
        debit: 0,
        credit: totalAmount,
        description: description
      }
    ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `BORROW-FROM-${borrowFromId}`,
      reference_table: 'borrow_from_inventories',
      reference_id: borrowFromId,
      description: description,
      transaction_type: 'borrow_from',
      entries: entries,
      inventory_id: inventoryId,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record ledger entry for return borrowed to (receiving back lent stock)
   * DR Inventory (1300), CR Accounts Receivable (1200)
   * @param {Object} params - Transaction parameters
   * @param {number} params.inventoryId - Inventory ID
   * @param {number} params.returnId - Return record ID
   * @param {number} params.quantity - Quantity returned
   * @param {number} params.unitCost - Unit cost (from original borrow)
   * @param {number} params.partnerId - Partner/Customer ID
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.referenceNumber - Reference number (optional)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordReturnBorrowedTo(params, trx = null) {
    const {
      inventoryId,
      returnId,
      quantity,
      unitCost,
      partnerId,
      transactionDate,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const totalAmount = quantity * unitCost

    const description = `Return Borrowed To - ${quantity} units @ ${unitCost.toFixed(2)} (Partner ID: ${partnerId})`

    const entries = [
      {
        account_code: '1300', // Inventory
        debit: totalAmount,
        credit: 0,
        description: description
      },
      {
        account_code: '1200', // Accounts Receivable
        debit: 0,
        credit: totalAmount,
        description: description
      }
    ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `RETURN-TO-${returnId}`,
      reference_table: 'borrow_to_returns',
      reference_id: returnId,
      description: description,
      transaction_type: 'borrow_to_return',
      entries: entries,
      inventory_id: inventoryId,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record ledger entry for purchase order (cash payment)
   * DR Inventory (1300), CR Cash (1100)
   * @param {Object} params - Transaction parameters
   * @param {number} params.purchaseOrderId - Purchase order ID
   * @param {number} params.totalAmount - Total purchase amount (subtotal)
   * @param {number} params.withholdAmount - Withhold amount (if any)
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.referenceNumber - Receipt number (optional)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordPurchaseCash(params, trx = null) {
    const {
      purchaseOrderId,
      totalAmount,
      withholdAmount = 0,
      transactionDate,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const netAmount = totalAmount - withholdAmount

    const description = `Purchase Order (Cash) - ${referenceNumber || `PO-${purchaseOrderId}`}${memo ? ` - ${memo}` : ''}`

    const entries = [
      {
        account_code: '1300', // Inventory
        debit: netAmount,
        credit: 0,
        description: description
      },
      {
        account_code: '1100', // Cash
        debit: 0,
        credit: netAmount,
        description: description
      }
    ]

    // Add withhold entry if applicable
    if (withholdAmount > 0.01) {
      entries.push({
        account_code: '3200', // Accounts Withhold Payable (assumed code)
        debit: 0,
        credit: withholdAmount,
        description: `Withhold - ${referenceNumber || `PO-${purchaseOrderId}`}`
      })
      // Adjust inventory debit to account for withhold
      entries[0].debit = totalAmount
    }

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `PO-${purchaseOrderId}`,
      reference_table: 'purchase_orders',
      reference_id: purchaseOrderId,
      description: description,
      transaction_type: 'purchase',
      entries: entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record ledger entry for purchase order (credit payment)
   * DR Inventory (1300), CR Accounts Payable (3100)
   * @param {Object} params - Transaction parameters
   * @param {number} params.purchaseOrderId - Purchase order ID
   * @param {number} params.totalAmount - Total purchase amount (subtotal)
   * @param {number} params.withholdAmount - Withhold amount (if any)
   * @param {number} params.firstPayment - First payment amount (if any)
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.referenceNumber - Receipt number (optional)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordPurchaseCredit(params, trx = null) {
    const {
      purchaseOrderId,
      totalAmount,
      withholdAmount = 0,
      firstPayment = 0,
      transactionDate,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const netAmount = totalAmount - withholdAmount
    const accountsPayableAmount = netAmount - firstPayment

    const description = `Purchase Order (Credit) - ${referenceNumber || `PO-${purchaseOrderId}`}${memo ? ` - ${memo}` : ''}`

    const entries = [
      {
        account_code: '1300', // Inventory
        debit: totalAmount,
        credit: 0,
        description: description
      }
    ]

    // Accounts Payable for remaining balance
    if (accountsPayableAmount > 0.01) {
      entries.push({
        account_code: '3100', // Accounts Payable
        debit: 0,
        credit: accountsPayableAmount,
        description: description
      })
    }

    // First payment (if any) - Cash
    if (firstPayment > 0.01) {
      entries.push({
        account_code: '1100', // Cash
        debit: 0,
        credit: firstPayment,
        description: `First Payment - ${referenceNumber || `PO-${purchaseOrderId}`}`
      })
    }

    // Withhold (if any)
    if (withholdAmount > 0.01) {
      entries.push({
        account_code: '3200', // Accounts Withhold Payable
        debit: 0,
        credit: withholdAmount,
        description: `Withhold - ${referenceNumber || `PO-${purchaseOrderId}`}`
      })
    }

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `PO-${purchaseOrderId}`,
      reference_table: 'purchase_orders',
      reference_id: purchaseOrderId,
      description: description,
      transaction_type: 'purchase',
      entries: entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record ledger entry for purchase order (cheque payment)
   * DR Inventory (1300), CR Bank/Cash (1100)
   * @param {Object} params - Transaction parameters
   * @param {number} params.purchaseOrderId - Purchase order ID
   * @param {number} params.totalAmount - Total purchase amount (subtotal)
   * @param {number} params.withholdAmount - Withhold amount (if any)
   * @param {number} params.chequeAmount - Cheque payment amount
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.referenceNumber - Receipt number (optional)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordPurchaseCheque(params, trx = null) {
    const {
      purchaseOrderId,
      totalAmount,
      withholdAmount = 0,
      chequeAmount,
      transactionDate,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const netAmount = totalAmount - withholdAmount
    const accountsPayableAmount = netAmount - chequeAmount

    const description = `Purchase Order (Cheque) - ${referenceNumber || `PO-${purchaseOrderId}`}${memo ? ` - ${memo}` : ''}`

    const entries = [
      {
        account_code: '1300', // Inventory
        debit: totalAmount,
        credit: 0,
        description: description
      }
    ]

    // Cheque payment - Bank/Cash
    if (chequeAmount > 0.01) {
      entries.push({
        account_code: '1100', // Cash/Bank
        debit: 0,
        credit: chequeAmount,
        description: `Cheque Payment - ${referenceNumber || `PO-${purchaseOrderId}`}`
      })
    }

    // Accounts Payable for remaining balance (if cheque doesn't cover full amount)
    if (accountsPayableAmount > 0.01) {
      entries.push({
        account_code: '3100', // Accounts Payable
        debit: 0,
        credit: accountsPayableAmount,
        description: description
      })
    }

    // Withhold (if any)
    if (withholdAmount > 0.01) {
      entries.push({
        account_code: '3200', // Accounts Withhold Payable
        debit: 0,
        credit: withholdAmount,
        description: `Withhold - ${referenceNumber || `PO-${purchaseOrderId}`}`
      })
    }

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `PO-${purchaseOrderId}`,
      reference_table: 'purchase_orders',
      reference_id: purchaseOrderId,
      description: description,
      transaction_type: 'purchase',
      entries: entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record payment against purchase order (credit/cheque)
   * DR Cash/Bank (1100) or Accounts Payable (3100), CR Accounts Payable (3100)
   * @param {Object} params - Transaction parameters
   * @param {number} params.purchaseOrderId - Purchase order ID
   * @param {number} params.paymentId - Payment record ID
   * @param {number} params.amount - Payment amount
   * @param {string} params.paymentMethod - Payment method ('cash' or 'cheque')
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.referenceNumber - Reference number (optional)
   * @param {string} params.memo - Additional notes (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordPurchasePayment(params, trx = null) {
    const {
      purchaseOrderId,
      paymentId,
      amount,
      paymentMethod,
      transactionDate,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const description = `Purchase Payment (${paymentMethod}) - ${referenceNumber || `PO-${purchaseOrderId}`}${memo ? ` - ${memo}` : ''}`

    const entries = [
      {
        account_code: '3100', // Accounts Payable
        debit: amount,
        credit: 0,
        description: description
      },
      {
        account_code: '1100', // Cash/Bank
        debit: 0,
        credit: amount,
        description: description
      }
    ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `PAY-${paymentId}`,
      reference_table: 'purchase_payments',
      reference_id: paymentId,
      description: description,
      transaction_type: 'purchase_payment',
      entries: entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record payment against sales order (customer pays on account)
   * DR Cash (1100), CR Accounts Receivable (1200)
   * @param {Object} params - Transaction parameters
   * @param {number} params.salesOrderId - Sales order ID
   * @param {number} params.paymentId - Payment record ID (sales_payments.id)
   * @param {number} params.amount - Payment amount
   * @param {string} params.paymentMethod - Payment method ('cash' or 'cheque')
   * @param {Date|string} params.transactionDate - Transaction date
   * @param {string} params.referenceNumber - Reference number (e.g. receipt_no)
   * @param {string} params.memo - Optional memo
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordSalesPayment(params, trx = null) {
    const {
      salesOrderId,
      paymentId,
      amount,
      paymentMethod,
      transactionDate,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const description = `Sales Payment (${paymentMethod}) - ${referenceNumber || `SO-${salesOrderId}`}${memo ? ` - ${memo}` : ''}`

    const entries = [
      {
        account_code: '1100', // Cash/Bank
        debit: amount,
        credit: 0,
        description: description
      },
      {
        account_code: '1200', // Accounts Receivable
        debit: 0,
        credit: amount,
        description: description
      }
    ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber ? `PAY-${referenceNumber}` : `PAY-SO-${paymentId}`,
      reference_table: 'sales_payments',
      reference_id: paymentId,
      description: description,
      transaction_type: 'sales_payment',
      entries: entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Reverse purchase order ledger entries
   * Creates reverse entries for all original GL transactions
   * @param {Object} params - Transaction parameters
   * @param {number} params.purchaseOrderId - Purchase order ID
   * @param {Date|string} params.transactionDate - Reversal date
   * @param {string} params.reason - Reason for reversal
   * @param {string} params.referenceNumber - Reference number (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created reverse ledger entries
   */
  async reversePurchaseOrder(params, trx = null) {
    const {
      purchaseOrderId,
      transactionDate,
      reason,
      referenceNumber = null,
      createdBy = null
    } = params

    // Get all original ledger entries for this purchase order
    const originalEntries = await (trx || this.knex)('account_ledger')
      .where({
        reference_table: 'purchase_orders',
        reference_id: purchaseOrderId,
        transaction_type: 'purchase'
      })
      .orderBy('id', 'asc')

    if (originalEntries.length === 0) {
      throw new Error('No ledger entries found for this purchase order')
    }

    // Group entries by account_code to reverse them
    const accountGroups = {}
    originalEntries.forEach(entry => {
      const code = entry.account_code
      if (!accountGroups[code]) {
        accountGroups[code] = { debit: 0, credit: 0 }
      }
      accountGroups[code].debit += parseFloat(entry.debit || 0)
      accountGroups[code].credit += parseFloat(entry.credit || 0)
    })

    // Create reverse entries (swap debits and credits)
    const reverseEntries = Object.keys(accountGroups).map(accountCode => {
      const group = accountGroups[accountCode]
      return {
        account_code: accountCode,
        debit: group.credit, // Swap: original credit becomes debit
        credit: group.debit, // Swap: original debit becomes credit
        description: `REVERSAL: ${originalEntries[0].description || 'Purchase Order'} - ${reason}`
      }
    })

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `REV-${purchaseOrderId}`,
      reference_table: 'purchase_orders',
      reference_id: purchaseOrderId,
      description: `Purchase Order Reversal - ${reason}`,
      transaction_type: 'purchase_reversal',
      entries: reverseEntries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record ledger entry for sales order
   * DR Cash (1100) if first_payment > 0
   * DR AR (1200) if outstanding_balance > 0
   * DR Withhold Receivable (1250) if withhold_amount > 0
   * CR Revenue (5100) if subtotal > 0
   * DR COGS (6100) & CR Inventory (1300) if totalCoGS > 0
   * @param {Object} params - Transaction parameters
   * @param {number} params.salesOrderId - Sales order ID
   * @param {number} params.firstPayment - Amount paid at sale (amount_paid)
   * @param {number} params.outstandingBalance - Net - amount_paid (receivable)
   * @param {number} params.withholdAmount - Withhold amount
   * @param {number} params.subtotal - Revenue (total_amount / gross)
   * @param {number} params.totalCoGS - Total cost of goods sold
   * @param {Date|string} params.transactionDate - Order date
   * @param {string} params.referenceNumber - Receipt number (e.g. SO000001)
   * @param {string} params.memo - Optional memo
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created ledger entries
   */
  async recordSalesOrder(params, trx = null) {
    const {
      salesOrderId,
      firstPayment = 0,
      outstandingBalance = 0,
      withholdAmount = 0,
      subtotal = 0,
      totalCoGS = 0,
      transactionDate,
      referenceNumber = null,
      memo = null,
      createdBy = null
    } = params

    const description = `Sales Order - ${referenceNumber || `SO-${salesOrderId}`}${memo ? ` - ${memo}` : ''}`

    const entries = []

    if (firstPayment > 0.01) {
      entries.push({
        account_code: '1100', // Cash
        debit: firstPayment,
        credit: 0,
        description: description
      })
    }
    if (outstandingBalance > 0.01) {
      entries.push({
        account_code: '1200', // Accounts Receivable
        debit: outstandingBalance,
        credit: 0,
        description: description
      })
    }
    if (withholdAmount > 0.01) {
      entries.push({
        account_code: '1250', // Withhold Receivable
        debit: withholdAmount,
        credit: 0,
        description: `Withhold - ${referenceNumber || `SO-${salesOrderId}`}`
      })
    }
    if (subtotal > 0.01) {
      entries.push({
        account_code: '5100', // Sales Revenue
        debit: 0,
        credit: subtotal,
        description: description
      })
    }
    if (totalCoGS > 0.01) {
      entries.push({
        account_code: '6100', // Cost of Goods Sold
        debit: totalCoGS,
        credit: 0,
        description: `COGS - ${referenceNumber || `SO-${salesOrderId}`}`
      })
      entries.push({
        account_code: '1300', // Inventory
        debit: 0,
        credit: totalCoGS,
        description: `Inventory (sold) - ${referenceNumber || `SO-${salesOrderId}`}`
      })
    }

    if (entries.length === 0) {
      return { success: true, message: 'No ledger entries', entries: [] }
    }

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `SO-${salesOrderId}`,
      reference_table: 'sales_orders',
      reference_id: salesOrderId,
      description: description,
      transaction_type: 'sale',
      entries: entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record expense: DR Operating Expenses (6200), CR Cash (1100) or CR AP (3100)
   */
  async recordExpense(params, trx = null) {
    const {
      expenseId,
      amount,
      paymentMethod,
      transactionDate,
      description,
      referenceNumber = null,
      createdBy = null
    } = params

    const entries =
      paymentMethod === 'credit'
        ? [
            { account_code: '6200', debit: amount, credit: 0, description },
            { account_code: '3100', debit: 0, credit: amount, description }
          ]
        : [
            { account_code: '6200', debit: amount, credit: 0, description },
            { account_code: '1100', debit: 0, credit: amount, description }
          ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `EXP-${expenseId}`,
      reference_table: 'expenses',
      reference_id: expenseId,
      description,
      transaction_type: 'expense',
      entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Reverse deposit ledger entries
   * @param {Object} params - { depositId, transactionDate, reason, createdBy }
   */
  async reverseDeposit(params, trx = null) {
    const { depositId, transactionDate, reason, referenceNumber = null, createdBy = null } = params
    const db = trx || this.knex
    const entries = await db('account_ledger')
      .where({ reference_table: 'deposits', reference_id: depositId, transaction_type: 'deposit' })
      .orderBy('id', 'asc')
    if (entries.length === 0) return { success: true, message: 'No ledger entries to reverse', entries: [] }
    const accountGroups = {}
    entries.forEach((entry) => {
      const code = entry.account_code
      if (!accountGroups[code]) accountGroups[code] = { debit: 0, credit: 0 }
      accountGroups[code].debit += parseFloat(entry.debit || 0)
      accountGroups[code].credit += parseFloat(entry.credit || 0)
    })
    const reverseEntries = Object.keys(accountGroups).map((accountCode) => {
      const g = accountGroups[accountCode]
      return {
        account_code: accountCode,
        debit: g.credit,
        credit: g.debit,
        description: `REVERSAL: Deposit - ${reason}`
      }
    })
    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `DEP-REV-${depositId}`,
      reference_table: 'deposits',
      reference_id: depositId,
      description: `Deposit Reversal - ${reason}`,
      transaction_type: 'deposit_reversal',
      entries: reverseEntries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record deposit/contribution: DR Cash (1100), CR Owner's Capital (4100) or Opening Balance (4300)
   */
  async recordDeposit(params, trx = null) {
    const {
      depositId,
      amount,
      accountCode = '4100', // 4100 Owner's Capital or 4300 Opening Balance
      transactionDate,
      description,
      referenceNumber = null,
      createdBy = null
    } = params

    const entries = [
      { account_code: '1100', debit: amount, credit: 0, description },
      { account_code: accountCode, debit: 0, credit: amount, description }
    ]

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `DEP-${depositId}`,
      reference_table: 'deposits',
      reference_id: depositId,
      description,
      transaction_type: 'deposit',
      entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record cash loan receivable (lend): DR Loans Receivable (1210), CR Cash (1100)
   * When lending cash to a partner, loans receivable increases and cash decreases.
   */
  async recordCashLoanReceivable(params, trx = null) {
    const { loanId, amount, transactionDate, description, referenceNumber = null, createdBy = null } = params
    const entries = [
      { account_code: '1210', debit: amount, credit: 0, description },  // DR Loans Receivable – amount owed by partner
      { account_code: '1100', debit: 0, credit: amount, description }  // CR Cash – cash disbursed
    ]
    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `LOAN-REC-${loanId}`,
      reference_table: 'cash_loans_receivable',
      reference_id: loanId,
      description,
      transaction_type: 'cash_loan_receivable',
      entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record cash loan receivable return: DR Cash (1100), CR Loans Receivable (1210)
   * When partner returns cash, cash increases and loans receivable decreases.
   */
  async recordCashLoanReceivableReturn(params, trx = null) {
    const { loanId, returnAmount, transactionDate, description, referenceNumber = null, createdBy = null } = params
    const entries = [
      { account_code: '1100', debit: returnAmount, credit: 0, description },  // DR Cash – receive cash
      { account_code: '1210', debit: 0, credit: returnAmount, description }  // CR Loans Receivable – reduce receivable
    ]
    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `LOAN-REC-RET-${loanId}`,
      reference_table: 'cash_loans_receivable',
      reference_id: loanId,
      description,
      transaction_type: 'cash_loan_receivable_return',
      entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record cash loan payable (borrow): DR Cash (1100), CR Loans Payable (3300)
   */
  async recordCashLoanPayable(params, trx = null) {
    const { loanId, amount, transactionDate, description, referenceNumber = null, createdBy = null } = params
    const entries = [
      { account_code: '1100', debit: amount, credit: 0, description },
      { account_code: '3300', debit: 0, credit: amount, description }
    ]
    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `LOAN-PAY-${loanId}`,
      reference_table: 'cash_loans_payable',
      reference_id: loanId,
      description,
      transaction_type: 'cash_loan_payable',
      entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record cash loan payable repayment: DR Loans Payable (3300), CR Cash (1100)
   */
  async recordCashLoanPayableRepayment(params, trx = null) {
    const { repaymentAmount, transactionDate, description, referenceNumber = null, createdBy = null } = params
    const entries = [
      { account_code: '3300', debit: repaymentAmount, credit: 0, description },
      { account_code: '1100', debit: 0, credit: repaymentAmount, description }
    ]
    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `LOAN-PAY-REP`,
      reference_table: 'cash_loans_payable',
      reference_id: null,
      description,
      transaction_type: 'cash_loan_payable_repayment',
      entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record withhold receivable settlement: DR Cash (1100), CR Withhold Receivable (1250)
   * When settling withholds with tax authority, cash is received and withhold receivable is cleared.
   */
  async recordWithholdReceivableSettlement(params, trx = null) {
    const { settlementId, totalAmount, transactionDate, description, referenceNumber = null, createdBy = null } = params
    const entries = [
      { account_code: '1100', debit: totalAmount, credit: 0, description },  // DR Cash – receive from tax authority
      { account_code: '1250', debit: 0, credit: totalAmount, description }  // CR Withhold Receivable – clear receivable
    ]
    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `WITHHOLD-REC-SET-${settlementId}`,
      reference_table: 'withhold_receivable_settlements',
      reference_id: settlementId,
      description,
      transaction_type: 'withhold_receivable_settlement',
      entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Record withhold payable settlement: DR Withhold Payable (3210), CR Cash (1100)
   * When remitting withheld tax to the tax authority, we clear the liability and pay cash.
   */
  async recordWithholdPayableSettlement(params, trx = null) {
    const { settlementId, totalAmount, transactionDate, description, referenceNumber = null, createdBy = null } = params
    const entries = [
      { account_code: '3210', debit: totalAmount, credit: 0, description },  // DR Withhold Payable – clear liability
      { account_code: '1100', debit: 0, credit: totalAmount, description }  // CR Cash – payment to tax authority
    ]
    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `WITHHOLD-PAY-SET-${settlementId}`,
      reference_table: 'withhold_payable_settlements',
      reference_id: settlementId,
      description,
      transaction_type: 'withhold_payable_settlement',
      entries,
      created_by: createdBy
    }, trx)
  }

  /**
   * Reverse sales order ledger entries
   * @param {Object} params - Transaction parameters
   * @param {number} params.salesOrderId - Sales order ID
   * @param {Date|string} params.transactionDate - Reversal date
   * @param {string} params.reason - Reason for reversal
   * @param {string} params.referenceNumber - Reference number (optional)
   * @param {number} params.createdBy - User ID (optional)
   * @param {Object} trx - Knex transaction (optional)
   * @returns {Promise<Object>} Created reverse ledger entries
   */
  async reverseSalesOrder(params, trx = null) {
    const {
      salesOrderId,
      transactionDate,
      reason,
      referenceNumber = null,
      createdBy = null
    } = params

    const originalEntries = await (trx || this.knex)('account_ledger')
      .where({
        reference_table: 'sales_orders',
        reference_id: salesOrderId,
        transaction_type: 'sale'
      })
      .orderBy('id', 'asc')

    if (originalEntries.length === 0) {
      return { success: true, message: 'No ledger entries to reverse', entries: [] }
    }

    const accountGroups = {}
    originalEntries.forEach(entry => {
      const code = entry.account_code
      if (!accountGroups[code]) {
        accountGroups[code] = { debit: 0, credit: 0 }
      }
      accountGroups[code].debit += parseFloat(entry.debit || 0)
      accountGroups[code].credit += parseFloat(entry.credit || 0)
    })

    const reverseEntries = Object.keys(accountGroups).map(accountCode => {
      const group = accountGroups[accountCode]
      return {
        account_code: accountCode,
        debit: group.credit,
        credit: group.debit,
        description: `REVERSAL: ${originalEntries[0].description || 'Sales Order'} - ${reason}`
      }
    })

    return await this.postGLTransaction({
      transaction_date: transactionDate,
      reference_no: referenceNumber || `REV-SO-${salesOrderId}`,
      reference_table: 'sales_orders',
      reference_id: salesOrderId,
      description: `Sales Order Reversal - ${reason}`,
      transaction_type: 'sale_reversal',
      entries: reverseEntries,
      created_by: createdBy
    }, trx)
  }
}
