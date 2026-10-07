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
  async createExpense(tenantId, data, userId = null) {
    return this.knex.transaction(async (trx) => {
      if (data.payment_method === 'cash' && data.amount > 0) {
        const hasLedger = await trx.schema.hasTable('account_ledger')
        if (hasLedger) {
          const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx, tenantId)
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
          tenant_id: tenantId,
          customer_id: data.customer_id ?? null,
          category: data.category,
          paid_on: data.paid_on,
          fiscal_year: data.fiscal_year ?? null,
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
          tenant_id: tenantId,
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

  async listExpenses(tenantId, { limit = 50, offset = 0, date_from, date_to, category }) {
    let base = this.knex('expenses').where({ 'expenses.tenant_id': tenantId })
    if (date_from) base = base.where('paid_on', '>=', date_from)
    if (date_to) base = base.where('paid_on', '<=', date_to)
    if (category) base = base.where('category', category)

    const totalResult = await base.clone().count('* as c').first()
    const rows = await base
      .leftJoin('customers', function () {
        this.on('expenses.customer_id', 'customers.id').andOn('expenses.tenant_id', 'customers.tenant_id')
      })
      .select('expenses.*', 'customers.name as customer_name')
      .orderBy('expenses.paid_on', 'desc')
      .orderBy('expenses.id', 'desc')
      .limit(limit)
      .offset(offset)

    return { expenses: rows, total: Number(totalResult?.c || 0) }
  }

  async getExpenseById(tenantId, id) {
    const row = await this.knex('expenses')
      .where({ 'expenses.id': id, 'expenses.tenant_id': tenantId })
      .leftJoin('customers', function () {
        this.on('expenses.customer_id', 'customers.id').andOn('expenses.tenant_id', 'customers.tenant_id')
      })
      .select('expenses.*', 'customers.name as customer_name')
      .first()
    return row
  }

  // ---------- Deposits ----------
  async createDeposit(tenantId, data, userId = null) {
    return this.knex.transaction(async (trx) => {
      const [row] = await trx('deposits')
        .insert({
          tenant_id: tenantId,
          deposit_date: data.deposit_date,
          fiscal_year: data.fiscal_year ?? null,
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
        const revenueTypes = ['donation', 'grant', 'interest_income', 'other_revenue']
        const accountCode = data.type === 'initial_seed' ? '4300'
          : revenueTypes.includes(data.type) ? '5200'
          : '4100'
        await this.ledgerHelper.recordDeposit({
          tenant_id: tenantId,
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

  async listDeposits(tenantId, { limit = 50, offset = 0, date_from, date_to, type, include_reversed = false }) {
    let q = this.knex('deposits')
      .where({ tenant_id: tenantId })
      .orderBy('deposit_date', 'desc')
      .orderBy('id', 'desc')
    if (!include_reversed) q = q.where((builder) => builder.where('is_reversed', false).orWhereNull('is_reversed'))

    if (date_from) q = q.where('deposit_date', '>=', date_from)
    if (date_to) q = q.where('deposit_date', '<=', date_to)
    if (type) q = q.where('type', type)

    const totalResult = await q.clone().clearSelect().clearOrder().count('* as c').first()
    const rows = await q.limit(limit).offset(offset)

    return { deposits: rows, total: Number(totalResult?.c || 0) }
  }

  async getDepositStats(tenantId, { date_from, date_to }) {
    let q = this.knex('deposits')
      .where({ tenant_id: tenantId })
      .select('type')
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

  async getDepositById(tenantId, id) {
    return this.knex('deposits').where({ id, tenant_id: tenantId }).first()
  }

  async updateDeposit(tenantId, id, data, userId = null) {
    return this.knex.transaction(async (trx) => {
      const existing = await trx('deposits').where({ id, tenant_id: tenantId }).first()
      if (!existing) return null
      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        await this.ledgerHelper.reverseDeposit({
          tenant_id: tenantId,
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
        .where({ id, tenant_id: tenantId })
        .update({
          deposit_date: data.deposit_date ?? existing.deposit_date,
          fiscal_year: data.fiscal_year ?? existing.fiscal_year,
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
          tenant_id: tenantId,
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

  async reverseDeposit(tenantId, id, userId = null) {
    return this.knex.transaction(async (trx) => {
      const existing = await trx('deposits').where({ id, tenant_id: tenantId }).first()
      if (!existing) return null
      if (existing.is_reversed) {
        const err = new Error('Deposit is already reversed')
        err.status = 400
        throw err
      }
      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger) {
        await this.ledgerHelper.reverseDeposit({
          tenant_id: tenantId,
          depositId: id,
          transactionDate: new Date().toISOString().split('T')[0],
          reason: 'Reversed by user',
          createdBy: userId
        }, trx)
      }
      const [row] = await trx('deposits')
        .where({ id, tenant_id: tenantId })
        .update({ is_reversed: true, last_updated: trx.fn.now() })
        .returning('*')
      return row
    })
  }

  // ---------- Cash Loans Receivable ----------
  async createCashLoanReceivable(tenantId, data, userId = null) {
    return this.knex.transaction(async (trx) => {
      if (data.amount > 0) {
        const hasLedger = await trx.schema.hasTable('account_ledger')
        if (hasLedger) {
          const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx, tenantId)
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
          tenant_id: tenantId,
          partner_id: data.partner_id,
          amount: data.amount,
          lent_date: data.lent_date,
          fiscal_year: data.fiscal_year ?? null,
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
          tenant_id: tenantId,
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

  async listCashLoansReceivable(tenantId, { limit = 50, offset = 0, status }) {
    let q = this.knex('cash_loans_receivable as clr')
      .where('clr.tenant_id', tenantId)
      .leftJoin('customers as c', function () {
        this.on('clr.partner_id', 'c.id').andOn('clr.tenant_id', 'c.tenant_id')
      })
      .select('clr.*', 'c.name as partner_name')
      .orderBy('clr.lent_date', 'desc')

    if (status) q = q.where('clr.status', status)

    const totalResult = await q.clone().clearSelect().clearOrder().count('clr.id as c').first()
    const rows = await q.limit(limit).offset(offset)

    let sumQ = this.knex('cash_loans_receivable')
      .where({ tenant_id: tenantId })
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

  async recordCashLoanReceivableReturn(tenantId, loanId, amount, returnDate, userId = null) {
    return this.knex.transaction(async (trx) => {
      const hasLedger = await trx.schema.hasTable('account_ledger')
      const loan = await trx('cash_loans_receivable').where({ id: loanId, tenant_id: tenantId }).first()
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
        .where({ id: loanId, tenant_id: tenantId })
        .update({
          returned_amount: newReturned,
          status: newStatus,
          last_updated: trx.fn.now()
        })

      if (hasLedger && amount > 0) {
        await this.ledgerHelper.recordCashLoanReceivableReturn({
          tenant_id: tenantId,
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
  async createCashLoanPayable(tenantId, data, userId = null) {
    const [row] = await this.knex('cash_loans_payable')
      .insert({
        tenant_id: tenantId,
        partner_id: data.partner_id,
        amount: data.amount,
        borrowed_date: data.borrowed_date,
        fiscal_year: data.fiscal_year ?? null,
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
        tenant_id: tenantId,
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

  async listCashLoansPayable(tenantId, { limit = 50, offset = 0, status }) {
    let q = this.knex('cash_loans_payable as clp')
      .where('clp.tenant_id', tenantId)
      .leftJoin('customers as c', function () {
        this.on('clp.partner_id', 'c.id').andOn('clp.tenant_id', 'c.tenant_id')
      })
      .select('clp.*', 'c.name as partner_name')
      .orderBy('clp.borrowed_date', 'desc')

    if (status) q = q.where('clp.status', status)

    const totalResult = await q.clone().clearSelect().clearOrder().count('clp.id as c').first()
    const rows = await q.limit(limit).offset(offset)

    return { loans: rows, total: Number(totalResult?.c || 0) }
  }

  async recordCashLoanPayableRepayment(tenantId, loanId, amount, repayDate, userId = null) {
    return this.knex.transaction(async (trx) => {
      const loan = await trx('cash_loans_payable').where({ id: loanId, tenant_id: tenantId }).first()
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
        const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx, tenantId)
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
        .where({ id: loanId, tenant_id: tenantId })
        .update({
          repaid_amount: newRepaid,
          status: newStatus,
          last_updated: trx.fn.now()
        })

      if (hasLedger && amount > 0) {
        await this.ledgerHelper.recordCashLoanPayableRepayment({
          tenant_id: tenantId,
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
  async getTradeReceivablesSummary(tenantId) {
    const hasSales = await this.knex.schema.hasTable('sales_orders')
    if (!hasSales) return { orders: [], total_outstanding: 0 }

    const spSub = this.knex('sales_payments')
      .where({ tenant_id: tenantId })
      .select('sales_order_id')
      .sum({ total_paid: 'amount' })
      .groupBy('sales_order_id')
      .as('sp')

    const rows = await this.knex('sales_orders as so')
      .where('so.tenant_id', tenantId)
      .leftJoin('customers as c', function () {
        this.on('so.customer_id', 'c.id').andOn('so.tenant_id', 'c.tenant_id')
      })
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
  async getTradePayablesSummary(tenantId) {
    const hasPurchase = await this.knex.schema.hasTable('purchase_orders')
    if (!hasPurchase) return { orders: [], total_outstanding: 0 }

    const ppSub = this.knex('purchase_payments')
      .where({ tenant_id: tenantId })
      .select('purchase_order_id')
      .sum({ total_paid: 'amount' })
      .groupBy('purchase_order_id')
      .as('pp')

    const rows = await this.knex('purchase_orders as po')
      .where('po.tenant_id', tenantId)
      .leftJoin('customers as c', function () {
        this.on('po.supplier_id', 'c.id').andOn('po.tenant_id', 'c.tenant_id')
      })
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
  async listWithholdReceivables(tenantId, { limit = 50, offset = 0, status }) {
    const hasSales = await this.knex.schema.hasTable('sales_orders')
    if (!hasSales) {
      return { orders: [], total: 0, stats: { total_unsettled: 0, count_confirmed_unsettled: 0, count_unconfirmed: 0, count_settled: 0 } }
    }

    let base = this.knex('sales_orders as so')
      .where('so.tenant_id', tenantId)
      .leftJoin('customers as c', function () {
        this.on('so.customer_id', 'c.id').andOn('so.tenant_id', 'c.tenant_id')
      })
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

    const statsRows = await this.knex('sales_orders as so')
      .where('so.tenant_id', tenantId)
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

  async createWithholdReceivableSettlement(tenantId, data, userId = null) {
    const { settlement_date, fiscal_year, sales_order_ids, reference_no, notes } = data

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
        .where({ tenant_id: tenantId })
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
          tenant_id: tenantId,
          settlement_date: settlement_date || new Date().toISOString().split('T')[0],
          fiscal_year: fiscal_year ?? null,
          total_amount: totalAmount,
          reference_no: reference_no || null,
          notes: notes || null,
          created_by: userId,
          created_at: trx.fn.now()
        })
        .returning('*')

      for (const o of orders) {
        await trx('withhold_receivable_settlement_items').insert({
          tenant_id: tenantId,
          settlement_id: settlement.id,
          sales_order_id: o.id,
          withhold_amount: Number(o.withhold_amount || 0)
        })
      }

      await trx('sales_orders')
        .where({ tenant_id: tenantId })
        .whereIn('id', sales_order_ids)
        .update({ withhold_settled: true, last_updated: trx.fn.now() })

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger && totalAmount > 0) {
        await this.ledgerHelper.recordWithholdReceivableSettlement({
          tenant_id: tenantId,
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
  async listWithholdPayables(tenantId, { limit = 50, offset = 0, status }) {
    const hasPurchase = await this.knex.schema.hasTable('purchase_orders')
    if (!hasPurchase) {
      return { orders: [], total: 0, stats: { total_unsettled: 0, count_unsettled: 0, count_settled: 0 } }
    }

    let base = this.knex('purchase_orders as po')
      .where('po.tenant_id', tenantId)
      .leftJoin('customers as c', function () {
        this.on('po.supplier_id', 'c.id').andOn('po.tenant_id', 'c.tenant_id')
      })
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
      .where('po.tenant_id', tenantId)
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

  async createWithholdPayableSettlement(tenantId, data, userId = null) {
    const { settlement_date, fiscal_year, purchase_order_ids, reference_no, notes } = data

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
        .where({ tenant_id: tenantId })
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

      const hasLedger = await trx.schema.hasTable('account_ledger')
      if (hasLedger && totalAmount > 0) {
        const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx, tenantId)
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
          tenant_id: tenantId,
          settlement_date: settlement_date || new Date().toISOString().split('T')[0],
          fiscal_year: fiscal_year ?? null,
          total_amount: totalAmount,
          reference_no: reference_no || null,
          notes: notes || null,
          created_by: userId,
          created_at: trx.fn.now()
        })
        .returning('*')

      for (const o of orders) {
        await trx('withhold_payable_settlement_items').insert({
          tenant_id: tenantId,
          settlement_id: settlement.id,
          purchase_order_id: o.id,
          withhold_amount: Number(o.withhold_amount || 0)
        })
      }

      await trx('purchase_orders')
        .where({ tenant_id: tenantId })
        .whereIn('id', purchase_order_ids)
        .update({ withhold_settled: true, last_updated: trx.fn.now() })

      if (hasLedger && totalAmount > 0) {
        await this.ledgerHelper.recordWithholdPayableSettlement({
          tenant_id: tenantId,
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
