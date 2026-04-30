/**
 * Financial repository: expenses, deposits, cash loans, withhold settlements
 */
import { LedgerHelper } from '../../services/ledger.helper.js'
import {
  effectiveWithholdConfirmed,
  rawWithholdEffectivelyConfirmed
} from '../../utils/salesWithhold.js'

export class FinancialRepository {
  constructor(knex) {
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  // ---------- Expenses ----------
  async createExpense(data, userId = null) {
    return this.knex.transaction(async (trx) => {
      if (data.payment_method === 'cash' && data.amount > 0) {
        const hasLedger = await trx.schema.hasTable('account_ledger')
        if (hasLedger) {
          const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx)
          const cashBalance = Number(balances['1100'] ?? 0)
          if (cashBalance < data.amount) {
            const err = new Error(`Insufficient cash balance. Current: ${cashBalance.toFixed(2)}. Required: ${data.amount.toFixed(2)}.`)
            err.status = 400
            throw err
          }
        }
      }

      const [row] = await trx('expenses')
        .insert({
          customer_id: data.customer_id ?? null,
          category: data.category,
          paid_on: data.paid_on,
          invoice_no: data.invoice_no || null,
          amount: data.amount,
          description: data.description || null,
          payment_method: data.payment_method || 'cash',
          withhold_percentage: data.withhold_percentage ?? null,
          cheque_no: data.cheque_no || null,
          cheque_date: data.cheque_date || null,
          bank_name: data.bank_name || null,
          bank_transfer_ref: data.bank_transfer_ref || null,
          created_by: userId,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now()
        })
        .returning('*')

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        await this.ledgerHelper.recordExpense({
          expenseId: row.id,
          amount: Number(row.amount),
          paymentMethod: row.payment_method,
          transactionDate: row.paid_on,
          description: `Expense - ${row.category}`,
          referenceNumber: row.invoice_no,
          createdBy: userId
        }, trx)
      }

      return row
    })
  }

  async listExpenses({ limit = 50, offset = 0, date_from, date_to, category }) {
    let base = this.knex('expenses')
    if (date_from) base = base.where('paid_on', '>=', date_from)
    if (date_to) base = base.where('paid_on', '<=', date_to)
    if (category) base = base.where('category', category)

    const totalResult = await base.clone().count('* as c').first()
    const rows = await base
      .leftJoin('customers', 'expenses.customer_id', 'customers.id')
      .select('expenses.*', 'customers.name as customer_name')
      .orderBy('expenses.paid_on', 'desc')
      .orderBy('expenses.id', 'desc')
      .limit(limit)
      .offset(offset)

    return { expenses: rows, total: Number(totalResult?.c || 0) }
  }

  async getExpenseById(id) {
    const row = await this.knex('expenses').where('expenses.id', id)
      .leftJoin('customers', 'expenses.customer_id', 'customers.id')
      .select('expenses.*', 'customers.name as customer_name')
      .first()
    return row
  }

  // ---------- Deposits ----------
  async createDeposit(data, userId = null) {
    return this.knex.transaction(async (trx) => {
      const [row] = await trx('deposits')
        .insert({
          deposit_date: data.deposit_date,
          type: data.type || 'deposit',
          amount: data.amount,
          description: data.description || null,
          source: data.source || null,
          reference_no: data.reference_no || null,
          created_by: userId,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now()
        })
        .returning('*')

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        // Chart of accounts: 4300 Opening Balance, 4100 Owner's Capital, 5200 Other Revenue
        const revenueTypes = ['donation', 'grant', 'interest_income', 'other_revenue']
        const accountCode = data.type === 'initial_seed' ? '4300'
          : revenueTypes.includes(data.type) ? '5200'
          : '4100'
        await this.ledgerHelper.recordDeposit({
          depositId: row.id,
          amount: Number(row.amount),
          accountCode,
          transactionDate: row.deposit_date,
          description: `Deposit - ${row.type}${row.description ? `: ${row.description}` : ''}`,
          referenceNumber: row.reference_no,
          createdBy: userId
        }, trx)
      }

      return row
    })
  }

  async listDeposits({ limit = 50, offset = 0, date_from, date_to, type, include_reversed = false }) {
    let q = this.knex('deposits').orderBy('deposit_date', 'desc').orderBy('id', 'desc')
    if (!include_reversed) q = q.where((builder) => builder.where('is_reversed', false).orWhereNull('is_reversed'))

    if (date_from) q = q.where('deposit_date', '>=', date_from)
    if (date_to) q = q.where('deposit_date', '<=', date_to)
    if (type) q = q.where('type', type)

    const totalResult = await q.clone().clearSelect().clearOrder().count('* as c').first()
    const rows = await q.limit(limit).offset(offset)

    return { deposits: rows, total: Number(totalResult?.c || 0) }
  }

  async getDepositStats({ date_from, date_to }) {
    let q = this.knex('deposits').select('type')
      .select(this.knex.raw('COUNT(*) as count'))
      .select(this.knex.raw('COALESCE(SUM(amount), 0) as value'))
      .groupBy('type')
      .where((builder) => builder.where('is_reversed', false).orWhereNull('is_reversed'))

    if (date_from) q = q.where('deposit_date', '>=', date_from)
    if (date_to) q = q.where('deposit_date', '<=', date_to)

    const rows = await q
    const stats = {}
    let totalCount = 0
    let totalValue = 0
    for (const r of rows) {
      stats[r.type] = { count: Number(r.count), value: Number(r.value) }
      totalCount += Number(r.count)
      totalValue += Number(r.value)
    }
    stats.all = { count: totalCount, value: totalValue }
    return stats
  }

  async getDepositById(id) {
    return this.knex('deposits').where({ id }).first()
  }

  async updateDeposit(id, data, userId = null) {
    return this.knex.transaction(async (trx) => {
      const existing = await trx('deposits').where({ id }).first()
      if (!existing) return null
      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        await this.ledgerHelper.reverseDeposit({
          depositId: id,
          transactionDate: data.deposit_date || existing.deposit_date,
          reason: 'Edit deposit',
          createdBy: userId
        }, trx)
      }
      const revenueTypes = ['donation', 'grant', 'interest_income', 'other_revenue']
      const accountCode = (data.type || existing.type) === 'initial_seed' ? '4300'
        : revenueTypes.includes(data.type || existing.type) ? '5200'
        : '4100'
      const [row] = await trx('deposits')
        .where({ id })
        .update({
          deposit_date: data.deposit_date ?? existing.deposit_date,
          type: data.type ?? existing.type,
          amount: data.amount != null ? data.amount : existing.amount,
          description: data.description !== undefined ? data.description : existing.description,
          source: data.source !== undefined ? data.source : existing.source,
          reference_no: data.reference_no !== undefined ? data.reference_no : existing.reference_no,
          last_updated: trx.fn.now()
        })
        .returning('*')
      if (hasLedger && row) {
        await this.ledgerHelper.recordDeposit({
          depositId: row.id,
          amount: Number(row.amount),
          accountCode,
          transactionDate: row.deposit_date,
          description: `Deposit - ${row.type}${row.description ? `: ${row.description}` : ''}`,
          referenceNumber: row.reference_no,
          createdBy: userId
        }, trx)
      }
      return row
    })
  }

  async reverseDeposit(id, userId = null) {
    return this.knex.transaction(async (trx) => {
      const existing = await trx('deposits').where({ id }).first()
      if (!existing) return null
      if (existing.is_reversed) {
        const err = new Error('Deposit is already reversed')
        err.status = 400
        throw err
      }
      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        await this.ledgerHelper.reverseDeposit({
          depositId: id,
          transactionDate: new Date().toISOString().split('T')[0],
          reason: 'Reversed by user',
          createdBy: userId
        }, trx)
      }
      const [row] = await trx('deposits')
        .where({ id })
        .update({ is_reversed: true, last_updated: trx.fn.now() })
        .returning('*')
      return row
    })
  }

  // ---------- Cash Loans Receivable ----------
  async createCashLoanReceivable(data, userId = null) {
    return this.knex.transaction(async (trx) => {
      if (data.amount > 0) {
        const hasLedger = await trx.schema.hasTable('account_ledger')
        if (hasLedger) {
          const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx)
          const cashBalance = Number(balances['1100'] ?? 0)
          if (cashBalance < data.amount) {
            const err = new Error(`Insufficient cash balance. Current: ${cashBalance.toFixed(2)}. Required: ${data.amount.toFixed(2)}.`)
            err.status = 400
            throw err
          }
        }
      }

      const [row] = await trx('cash_loans_receivable')
        .insert({
          partner_id: data.partner_id,
          amount: data.amount,
          lent_date: data.lent_date,
          expected_return_date: data.expected_return_date || null,
          notes: data.notes || null,
          reference_no: data.reference_no || null,
          created_by: userId,
          created_at: trx.fn.now(),
          last_updated: trx.fn.now()
        })
        .returning('*')

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        await this.ledgerHelper.recordCashLoanReceivable({
          loanId: row.id,
          amount: Number(row.amount),
          transactionDate: row.lent_date,
          description: `Cash loan receivable - Partner #${row.partner_id}`,
          referenceNumber: row.reference_no,
          createdBy: userId
        }, trx)
      }

      return row
    })
  }

  async listCashLoansReceivable({ limit = 50, offset = 0, status }) {
    let q = this.knex('cash_loans_receivable as clr')
      .leftJoin('customers as c', 'clr.partner_id', 'c.id')
      .select('clr.*', 'c.name as partner_name')
      .orderBy('clr.lent_date', 'desc')

    if (status) q = q.where('clr.status', status)

    const totalResult = await q.clone().clearSelect().clearOrder().count('clr.id as c').first()
    const rows = await q.limit(limit).offset(offset)

    let sumQ = this.knex('cash_loans_receivable')
      .select(this.knex.raw(`
        COALESCE(
          SUM(
            CASE
              WHEN amount - COALESCE(returned_amount, 0) > 0
              THEN amount - COALESCE(returned_amount, 0)
              ELSE 0
            END
          ),
          0
        ) as total_outstanding
      `))
    if (status) sumQ = sumQ.where('status', status)
    const sumRow = await sumQ.first()

    return {
      loans: rows,
      total: Number(totalResult?.c || 0),
      total_outstanding: Number(sumRow?.total_outstanding || 0)
    }
  }

  async recordCashLoanReceivableReturn(loanId, amount, returnDate, userId = null) {
    return this.knex.transaction(async (trx) => {
      const hasLedger = await trx.schema.hasTable('account_ledger')
      const loan = await trx('cash_loans_receivable').where({ id: loanId }).first()
      if (!loan) {
        const err = new Error('Loan not found')
        err.status = 404
        throw err
      }
      if (loan.status === 'returned') {
        const err = new Error('Loan already fully returned')
        err.status = 400
        throw err
      }

      const newReturned = Number(loan.returned_amount || 0) + amount
      const newStatus = newReturned >= Number(loan.amount) - 0.01 ? 'returned' : 'partially_returned'

      await trx('cash_loans_receivable')
        .where({ id: loanId })
        .update({
          returned_amount: newReturned,
          status: newStatus,
          last_updated: trx.fn.now()
        })

      if (hasLedger && amount > 0) {
        await this.ledgerHelper.recordCashLoanReceivableReturn({
          loanId,
          returnAmount: amount,
          transactionDate: returnDate,
          description: `Cash loan receivable return - Loan #${loanId}`,
          referenceNumber: `LOAN-REC-RET-${loanId}`,
          createdBy: userId
        }, trx)
      }

      return { loan_id: loanId, returned_amount: newReturned, status: newStatus }
    })
  }

  // ---------- Cash Loans Payable ----------
  async createCashLoanPayable(data, userId = null) {
    const [row] = await this.knex('cash_loans_payable')
      .insert({
        partner_id: data.partner_id,
        amount: data.amount,
        borrowed_date: data.borrowed_date,
        expected_repay_date: data.expected_repay_date || null,
        notes: data.notes || null,
        reference_no: data.reference_no || null,
        created_by: userId,
        created_at: this.knex.fn.now(),
        last_updated: this.knex.fn.now()
      })
      .returning('*')

    const hasLedger = await this.knex.schema.hasTable('account_ledger')
    if (hasLedger) {
      await this.ledgerHelper.recordCashLoanPayable({
        loanId: row.id,
        amount: Number(row.amount),
        transactionDate: row.borrowed_date,
        description: `Cash loan payable - Partner #${row.partner_id}`,
        referenceNumber: row.reference_no,
        createdBy: userId
      })
    }

    return row
  }

  async listCashLoansPayable({ limit = 50, offset = 0, status }) {
    let q = this.knex('cash_loans_payable as clp')
      .leftJoin('customers as c', 'clp.partner_id', 'c.id')
      .select('clp.*', 'c.name as partner_name')
      .orderBy('clp.borrowed_date', 'desc')

    if (status) q = q.where('clp.status', status)

    const totalResult = await q.clone().clearSelect().clearOrder().count('clp.id as c').first()
    const rows = await q.limit(limit).offset(offset)

    return { loans: rows, total: Number(totalResult?.c || 0) }
  }

  async recordCashLoanPayableRepayment(loanId, amount, repayDate, userId = null) {
    return this.knex.transaction(async (trx) => {
      const loan = await trx('cash_loans_payable').where({ id: loanId }).first()
      if (!loan) {
        const err = new Error('Loan not found')
        err.status = 404
        throw err
      }
      if (loan.status === 'repaid') {
        const err = new Error('Loan already fully repaid')
        err.status = 400
        throw err
      }

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger && amount > 0) {
        const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx)
        const cashBalance = Number(balances['1100'] ?? 0)
        if (cashBalance < amount) {
          const err = new Error(`Insufficient cash balance for repayment.`)
          err.status = 400
          throw err
        }
      }

      const newRepaid = Number(loan.repaid_amount || 0) + amount
      const newStatus = newRepaid >= Number(loan.amount) - 0.01 ? 'repaid' : 'partially_repaid'

      await trx('cash_loans_payable')
        .where({ id: loanId })
        .update({
          repaid_amount: newRepaid,
          status: newStatus,
          last_updated: trx.fn.now()
        })

      if (hasLedger && amount > 0) {
        await this.ledgerHelper.recordCashLoanPayableRepayment({
          repaymentAmount: amount,
          transactionDate: repayDate,
          description: `Cash loan payable repayment - Loan #${loanId}`,
          referenceNumber: `LOAN-PAY-REP-${loanId}`,
          createdBy: userId
        }, trx)
      }

      return { loan_id: loanId, repaid_amount: newRepaid, status: newStatus }
    })
  }

  // ---------- Trade Receivables (from sales) ----------
  async getTradeReceivablesSummary() {
    const hasSales = await this.knex.schema.hasTable('sales_orders')
    if (!hasSales) return { orders: [], total_outstanding: 0 }

    const spSub = this.knex('sales_payments')
      .select('sales_order_id')
      .sum({ total_paid: 'amount' })
      .groupBy('sales_order_id')
      .as('sp')

    const rows = await this.knex('sales_orders as so')
      .leftJoin('customers as c', 'so.customer_id', 'c.id')
      .leftJoin(spSub, 'so.id', 'sp.sales_order_id')
      .where('so.status', 'completed')
      .where('so.is_reversed', false)
      .select(
        'so.id',
        'so.receipt_no',
        'so.order_date',
        'so.payment_type',
        'so.total_amount',
        'so.withhold_amount',
        'c.name as customer_name',
        this.knex.raw('coalesce(sp.total_paid, 0) as total_paid')
      )

    const orders = []
    let totalOutstanding = 0
    for (const row of rows) {
      const net = Number(row.total_amount || 0) - Number(row.withhold_amount || 0)
      const paid = Number(row.total_paid || 0)
      const outstanding = Math.max(0, net - paid)
      if (outstanding > 0.01) {
        orders.push({
          id: row.id,
          receipt_no: row.receipt_no,
          order_date: row.order_date,
          payment_type: row.payment_type || 'credit',
          customer_name: row.customer_name,
          net_amount: net,
          amount_paid: paid,
          outstanding_balance: outstanding
        })
        totalOutstanding += outstanding
      }
    }

    return { orders, total_outstanding: totalOutstanding }
  }

  // ---------- Trade Payables (from purchases) ----------
  async getTradePayablesSummary() {
    const hasPurchase = await this.knex.schema.hasTable('purchase_orders')
    if (!hasPurchase) return { orders: [], total_outstanding: 0 }

    const ppSub = this.knex('purchase_payments')
      .select('purchase_order_id')
      .sum({ total_paid: 'amount' })
      .groupBy('purchase_order_id')
      .as('pp')

    const rows = await this.knex('purchase_orders as po')
      .leftJoin('customers as c', 'po.supplier_id', 'c.id')
      .leftJoin(ppSub, 'po.id', 'pp.purchase_order_id')
      .where('po.status', 'completed')
      .select(
        'po.id',
        'po.receipt_no',
        'po.order_date',
        'po.total_amount',
        'po.withhold_amount',
        'c.name as supplier_name',
        this.knex.raw('coalesce(pp.total_paid, 0) as total_paid')
      )

    const orders = []
    let totalOutstanding = 0
    for (const row of rows) {
      const net = Number(row.total_amount || 0) - Number(row.withhold_amount || 0)
      const paid = Number(row.total_paid || 0)
      const outstanding = Math.max(0, net - paid)
      if (outstanding > 0.01) {
        orders.push({
          id: row.id,
          receipt_no: row.receipt_no,
          order_date: row.order_date,
          supplier_name: row.supplier_name,
          net_amount: net,
          amount_paid: paid,
          outstanding_balance: outstanding
        })
        totalOutstanding += outstanding
      }
    }

    return { orders, total_outstanding: totalOutstanding }
  }

  // ---------- Withhold Receivables (from sales) ----------
  /**
   * List sales orders with withhold for settlement.
   * Status: '' (all), 'confirmed_unsettled', 'unconfirmed', 'settled'
   */
  async listWithholdReceivables({ limit = 50, offset = 0, status }) {
    const hasSales = await this.knex.schema.hasTable('sales_orders')
    if (!hasSales) {
      return { orders: [], total: 0, stats: { total_unsettled: 0, count_confirmed_unsettled: 0, count_unconfirmed: 0, count_settled: 0 } }
    }

    let base = this.knex('sales_orders as so')
      .leftJoin('customers as c', 'so.customer_id', 'c.id')
      .where('so.status', 'completed')
      .where('so.is_reversed', false)
      .whereRaw('coalesce(so.withhold_amount, 0) > 0.009')

    if (status === 'confirmed_unsettled') {
      base = base.andWhere(rawWithholdEffectivelyConfirmed(this.knex, 'so')).andWhere('so.withhold_settled', false)
    } else if (status === 'unconfirmed') {
      base = base.whereNot(rawWithholdEffectivelyConfirmed(this.knex, 'so')).andWhere('so.withhold_settled', false)
    } else if (status === 'settled') {
      base = base.andWhere(rawWithholdEffectivelyConfirmed(this.knex, 'so')).andWhere('so.withhold_settled', true)
    }

    base = base.select(
      'so.id',
      'so.receipt_no',
      'so.order_date',
      'so.total_amount',
      'so.withhold_amount',
      'so.withhold_confirmation',
      'so.withhold_settled',
      'so.withhold_ref',
      'so.remark',
      'c.name as customer_name'
    ).orderBy('so.order_date', 'desc').orderBy('so.id', 'desc')

    const totalResult = await base.clone().clearSelect().clearOrder().count('so.id as c').first()
    const rows = await base.limit(limit).offset(offset)

    // Stats: all with withhold_amount > 0
    const statsRows = await this.knex('sales_orders as so')
      .where('so.status', 'completed')
      .where('so.is_reversed', false)
      .whereRaw('coalesce(so.withhold_amount, 0) > 0.009')
      .select(
        'so.withhold_confirmation',
        'so.withhold_settled',
        'so.withhold_amount',
        'so.withhold_ref',
        'so.remark'
      )

    let totalUnsettled = 0
    let countConfirmedUnsettled = 0
    let countUnconfirmed = 0
    let countSettled = 0
    for (const r of statsRows) {
      const amt = Number(r.withhold_amount || 0)
      const confirmed = effectiveWithholdConfirmed(r)
      const settled = !!r.withhold_settled
      if (!settled) totalUnsettled += amt
      if (confirmed && !settled) countConfirmedUnsettled += 1
      if (!confirmed && !settled) countUnconfirmed += 1
      if (confirmed && settled) countSettled += 1
    }

    const orders = rows.map((r) => ({
      id: r.id,
      receipt_no: r.receipt_no,
      order_date: r.order_date,
      total_amount: Number(r.total_amount || 0),
      withhold_amount: Number(r.withhold_amount || 0),
      withhold_confirmation: effectiveWithholdConfirmed(r),
      withhold_settled: !!r.withhold_settled,
      withhold_ref: r.withhold_ref,
      customer_name: r.customer_name
    }))

    return {
      orders,
      total: Number(totalResult?.c || 0),
      stats: {
        total_unsettled: totalUnsettled,
        count_confirmed_unsettled: countConfirmedUnsettled,
        count_unconfirmed: countUnconfirmed,
        count_settled: countSettled
      }
    }
  }

  /**
   * Create withhold receivable settlement for given sales orders.
   * Validates all orders are confirmed and unsettled; creates settlement + items; posts GL; updates withhold_settled.
   */
  async createWithholdReceivableSettlement(data, userId = null) {
    const { settlement_date, sales_order_ids, reference_no, notes } = data

    const hasSettlements = await this.knex.schema.hasTable('withhold_receivable_settlements')
    if (!hasSettlements) {
      const err = new Error('Withhold settlements table not found')
      err.status = 500
      throw err
    }

    return this.knex.transaction(async (trx) => {
      if (!sales_order_ids || !Array.isArray(sales_order_ids) || sales_order_ids.length === 0) {
        const err = new Error('At least one sales order is required')
        err.status = 400
        throw err
      }

      const orders = await trx('sales_orders')
        .whereIn('id', sales_order_ids)
        .where('status', 'completed')
        .where('is_reversed', false)
        .whereRaw('coalesce(withhold_amount, 0) > 0.009')
        .where('withhold_settled', false)
        .whereRaw(rawWithholdEffectivelyConfirmed(trx, 'sales_orders'))
        .select('id', 'receipt_no', 'withhold_amount')

      if (orders.length !== sales_order_ids.length) {
        const err = new Error('One or more orders are not eligible for settlement (must be confirmed and unsettled with withhold)')
        err.status = 400
        throw err
      }

      const totalAmount = orders.reduce((s, o) => s + Number(o.withhold_amount || 0), 0)
      if (totalAmount < 0.01) {
        const err = new Error('Total settlement amount must be positive')
        err.status = 400
        throw err
      }

      const [settlement] = await trx('withhold_receivable_settlements')
        .insert({
          settlement_date: settlement_date || new Date().toISOString().split('T')[0],
          total_amount: totalAmount,
          reference_no: reference_no || null,
          notes: notes || null,
          created_by: userId,
          created_at: trx.fn.now()
        })
        .returning('*')

      for (const o of orders) {
        await trx('withhold_receivable_settlement_items').insert({
          settlement_id: settlement.id,
          sales_order_id: o.id,
          withhold_amount: Number(o.withhold_amount || 0)
        })
      }

      await trx('sales_orders')
        .whereIn('id', sales_order_ids)
        .update({ withhold_settled: true, last_updated: trx.fn.now() })

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger && totalAmount > 0) {
        await this.ledgerHelper.recordWithholdReceivableSettlement({
          settlementId: settlement.id,
          totalAmount,
          transactionDate: settlement.settlement_date,
          description: `Withhold receivable settlement - ${orders.length} order(s)`,
          referenceNumber: reference_no || `WITHHOLD-REC-SET-${settlement.id}`,
          createdBy: userId
        }, trx)
      }

      return {
        settlement,
        orders_settled: orders.length,
        total_amount: totalAmount
      }
    })
  }

  // ---------- Withhold Payables (from purchases) ----------
  /**
   * List purchase orders with withhold for settlement.
   * Purchase has withhold_settled only (no confirmation step); status: '' (all), 'unsettled', 'settled'
   */
  async listWithholdPayables({ limit = 50, offset = 0, status }) {
    const hasPurchase = await this.knex.schema.hasTable('purchase_orders')
    if (!hasPurchase) {
      return { orders: [], total: 0, stats: { total_unsettled: 0, count_unsettled: 0, count_settled: 0 } }
    }

    let base = this.knex('purchase_orders as po')
      .leftJoin('customers as c', 'po.supplier_id', 'c.id')
      .where('po.status', 'completed')
      .whereRaw('coalesce(po.withhold_amount, 0) > 0.009')

    if (status === 'unsettled') {
      base = base.andWhere('po.withhold_settled', false)
    } else if (status === 'settled') {
      base = base.andWhere('po.withhold_settled', true)
    }

    base = base.select(
      'po.id',
      'po.receipt_no',
      'po.order_date',
      'po.total_amount',
      'po.withhold_amount',
      'po.withhold_settled',
      'po.invoice_no',
      'c.name as supplier_name'
    ).orderBy('po.order_date', 'desc').orderBy('po.id', 'desc')

    const totalResult = await base.clone().clearSelect().clearOrder().count('po.id as c').first()
    const rows = await base.limit(limit).offset(offset)

    const statsRows = await this.knex('purchase_orders as po')
      .where('po.status', 'completed')
      .whereRaw('coalesce(po.withhold_amount, 0) > 0.009')
      .select('po.withhold_settled', 'po.withhold_amount')

    let totalUnsettled = 0
    let countUnsettled = 0
    let countSettled = 0
    for (const r of statsRows) {
      const amt = Number(r.withhold_amount || 0)
      const settled = !!r.withhold_settled
      if (!settled) { totalUnsettled += amt; countUnsettled += 1 }
      else countSettled += 1
    }

    const orders = rows.map((r) => ({
      id: r.id,
      receipt_no: r.receipt_no,
      order_date: r.order_date,
      total_amount: Number(r.total_amount || 0),
      withhold_amount: Number(r.withhold_amount || 0),
      withhold_settled: !!r.withhold_settled,
      invoice_no: r.invoice_no,
      supplier_name: r.supplier_name
    }))

    return {
      orders,
      total: Number(totalResult?.c || 0),
      stats: { total_unsettled: totalUnsettled, count_unsettled: countUnsettled, count_settled: countSettled }
    }
  }

  async createWithholdPayableSettlement(data, userId = null) {
    const { settlement_date, purchase_order_ids, reference_no, notes } = data

    const hasSettlements = await this.knex.schema.hasTable('withhold_payable_settlements')
    if (!hasSettlements) {
      const err = new Error('Withhold payable settlements table not found')
      err.status = 500
      throw err
    }

    return this.knex.transaction(async (trx) => {
      if (!purchase_order_ids || !Array.isArray(purchase_order_ids) || purchase_order_ids.length === 0) {
        const err = new Error('At least one purchase order is required')
        err.status = 400
        throw err
      }

      const orders = await trx('purchase_orders')
        .whereIn('id', purchase_order_ids)
        .where('status', 'completed')
        .whereRaw('coalesce(withhold_amount, 0) > 0.009')
        .where('withhold_settled', false)
        .select('id', 'receipt_no', 'withhold_amount')

      if (orders.length !== purchase_order_ids.length) {
        const err = new Error('One or more orders are not eligible for settlement (must be unsettled with withhold)')
        err.status = 400
        throw err
      }

      const totalAmount = orders.reduce((s, o) => s + Number(o.withhold_amount || 0), 0)
      if (totalAmount < 0.01) {
        const err = new Error('Total settlement amount must be positive')
        err.status = 400
        throw err
      }

      // Cash balance safeguard: withhold payable settlement pays cash to tax authority
      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger && totalAmount > 0) {
        const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx)
        const cashBalance = Number(balances['1100'] ?? 0)
        if (cashBalance < totalAmount) {
          const err = new Error(
            `Insufficient cash balance for withhold settlement. Current: ${cashBalance.toFixed(2)}. Required: ${totalAmount.toFixed(2)}.`
          )
          err.status = 400
          throw err
        }
      }

      const [settlement] = await trx('withhold_payable_settlements')
        .insert({
          settlement_date: settlement_date || new Date().toISOString().split('T')[0],
          total_amount: totalAmount,
          reference_no: reference_no || null,
          notes: notes || null,
          created_by: userId,
          created_at: trx.fn.now()
        })
        .returning('*')

      for (const o of orders) {
        await trx('withhold_payable_settlement_items').insert({
          settlement_id: settlement.id,
          purchase_order_id: o.id,
          withhold_amount: Number(o.withhold_amount || 0)
        })
      }

      await trx('purchase_orders')
        .whereIn('id', purchase_order_ids)
        .update({ withhold_settled: true, last_updated: trx.fn.now() })

      if (hasLedger && totalAmount > 0) {
        await this.ledgerHelper.recordWithholdPayableSettlement({
          settlementId: settlement.id,
          totalAmount,
          transactionDate: settlement.settlement_date,
          description: `Withhold payable settlement - ${orders.length} order(s)`,
          referenceNumber: reference_no || `WITHHOLD-PAY-SET-${settlement.id}`,
          createdBy: userId
        }, trx)
      }

      return {
        settlement,
        orders_settled: orders.length,
        total_amount: totalAmount
      }
    })
  }
}
