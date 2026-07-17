/**
 * Financial service: business logic for expenses, deposits, cash loans
 */
import { assertFiscalYearOpen } from '../../services/fiscal-year.guard.js'

export class FinancialService {
  constructor(repository) {
    this.repository = repository
  }

  async createExpense(body, user) {
    const data = {
      customer_id: body.customer_id ?? null,
      category: body.category,
      paid_on: body.paid_on,
      invoice_no: body.invoice_no || null,
      amount: Number(body.amount),
      description: body.description || null,
      payment_method: body.payment_method || 'cash',
      withhold_percentage: body.withhold_percentage != null ? Number(body.withhold_percentage) : null,
      cheque_no: body.cheque_no || null,
      cheque_date: body.cheque_date || null,
      bank_name: body.bank_name || null,
      bank_transfer_ref: body.bank_transfer_ref || null
    }
    if (!data.paid_on || !data.category || !data.amount || data.amount <= 0) {
      const err = new Error('paid_on, category, and amount (positive) are required')
      err.status = 400
      throw err
    }
    const fy = await assertFiscalYearOpen(this.repository.knex, data.paid_on)
    data.fiscal_year = fy.fiscal_year
    return this.repository.createExpense(data, user?.id)
  }

  async listExpenses(params) {
    return this.repository.listExpenses(params)
  }

  async getExpenseById(id) {
    const row = await this.repository.getExpenseById(id)
    if (!row) {
      const err = new Error('Expense not found')
      err.status = 404
      throw err
    }
    return row
  }

  async createDeposit(body, user) {
    const data = {
      deposit_date: body.deposit_date,
      type: body.type || 'deposit',
      amount: Number(body.amount),
      description: body.description || null,
      source: body.source || null,
      reference_no: body.reference_no || null
    }
    if (!data.deposit_date || !data.amount || data.amount <= 0) {
      const err = new Error('deposit_date and amount (positive) are required')
      err.status = 400
      throw err
    }
    const validTypes = ['deposit', 'contribution', 'initial_seed', 'capital_injection', 'donation', 'grant', 'interest_income', 'other_revenue', 'other']
    if (data.type && !validTypes.includes(data.type)) {
      const err = new Error('Invalid type. Must be one of: ' + validTypes.join(', '))
      err.status = 400
      throw err
    }
    const fy = await assertFiscalYearOpen(this.repository.knex, data.deposit_date)
    data.fiscal_year = fy.fiscal_year
    return this.repository.createDeposit(data, user?.id)
  }

  async getDepositStats(params) {
    return this.repository.getDepositStats(params)
  }

  async listDeposits(params) {
    return this.repository.listDeposits(params)
  }

  async getDepositById(id) {
    const row = await this.repository.getDepositById(id)
    if (!row) {
      const err = new Error('Deposit not found')
      err.status = 404
      throw err
    }
    return row
  }

  async updateDeposit(id, body, user) {
    const data = {
      deposit_date: body.deposit_date,
      type: body.type,
      amount: body.amount != null ? Number(body.amount) : undefined,
      description: body.description,
      source: body.source,
      reference_no: body.reference_no
    }
    const validTypes = ['deposit', 'contribution', 'initial_seed', 'capital_injection', 'donation', 'grant', 'interest_income', 'other_revenue', 'other']
    if (data.type && !validTypes.includes(data.type)) {
      const err = new Error('Invalid type. Must be one of: ' + validTypes.join(', '))
      err.status = 400
      throw err
    }
    if (data.amount != null && data.amount <= 0) {
      const err = new Error('amount must be positive')
      err.status = 400
      throw err
    }

    const existing = await this.repository.getDepositById(id)
    if (!existing) {
      const err = new Error('Deposit not found')
      err.status = 404
      throw err
    }

    const transactionDate = data.deposit_date ?? existing.deposit_date
    const fy = await assertFiscalYearOpen(this.repository.knex, transactionDate)
    data.fiscal_year = fy.fiscal_year

    const row = await this.repository.updateDeposit(Number(id), data, user?.id)
    if (!row) {
      const err = new Error('Deposit not found')
      err.status = 404
      throw err
    }
    return row
  }

  async reverseDeposit(id, user) {
    const existing = await this.repository.getDepositById(id)
    if (!existing) {
      const err = new Error('Deposit not found')
      err.status = 404
      throw err
    }

    const reversalDate = new Date().toISOString().split('T')[0]
    await assertFiscalYearOpen(this.repository.knex, reversalDate)

    const row = await this.repository.reverseDeposit(Number(id), user?.id)
    if (!row) {
      const err = new Error('Deposit not found')
      err.status = 404
      throw err
    }
    return row
  }

  async createCashLoanReceivable(body, user) {
    const data = {
      partner_id: body.partner_id,
      amount: Number(body.amount),
      lent_date: body.lent_date,
      expected_return_date: body.expected_return_date || null,
      notes: body.notes || null,
      reference_no: body.reference_no || null
    }
    if (!data.partner_id || !data.amount || data.amount <= 0 || !data.lent_date) {
      const err = new Error('partner_id, amount (positive), and lent_date are required')
      err.status = 400
      throw err
    }
    const fy = await assertFiscalYearOpen(this.repository.knex, data.lent_date)
    data.fiscal_year = fy.fiscal_year
    return this.repository.createCashLoanReceivable(data, user?.id)
  }

  async listCashLoansReceivable(params) {
    return this.repository.listCashLoansReceivable(params)
  }

  async recordCashLoanReceivableReturn(loanId, body, user) {
    const amount = Number(body.amount || 0)
    const returnDate = body.return_date || new Date().toISOString().split('T')[0]
    if (!amount || amount <= 0) {
      const err = new Error('amount (positive) is required')
      err.status = 400
      throw err
    }
    await assertFiscalYearOpen(this.repository.knex, returnDate)
    return this.repository.recordCashLoanReceivableReturn(loanId, amount, returnDate, user?.id)
  }

  async createCashLoanPayable(body, user) {
    const data = {
      partner_id: body.partner_id,
      amount: Number(body.amount),
      borrowed_date: body.borrowed_date,
      expected_repay_date: body.expected_repay_date || null,
      notes: body.notes || null,
      reference_no: body.reference_no || null
    }
    if (!data.partner_id || !data.amount || data.amount <= 0 || !data.borrowed_date) {
      const err = new Error('partner_id, amount (positive), and borrowed_date are required')
      err.status = 400
      throw err
    }
    const fy = await assertFiscalYearOpen(this.repository.knex, data.borrowed_date)
    data.fiscal_year = fy.fiscal_year
    return this.repository.createCashLoanPayable(data, user?.id)
  }

  async listCashLoansPayable(params) {
    return this.repository.listCashLoansPayable(params)
  }

  async recordCashLoanPayableRepayment(loanId, body, user) {
    const amount = Number(body.amount || 0)
    const repayDate = body.repay_date || new Date().toISOString().split('T')[0]
    if (!amount || amount <= 0) {
      const err = new Error('amount (positive) is required')
      err.status = 400
      throw err
    }
    await assertFiscalYearOpen(this.repository.knex, repayDate)
    return this.repository.recordCashLoanPayableRepayment(loanId, amount, repayDate, user?.id)
  }

  async getTradeReceivablesSummary() {
    return this.repository.getTradeReceivablesSummary()
  }

  async getTradePayablesSummary() {
    return this.repository.getTradePayablesSummary()
  }

  async listWithholdReceivables(params) {
    return this.repository.listWithholdReceivables(params)
  }

  async createWithholdReceivableSettlement(body, user) {
    const { settlement_date, sales_order_ids, reference_no, notes } = body
    if (!settlement_date) {
      const err = new Error('settlement_date is required')
      err.status = 400
      throw err
    }
    const fy = await assertFiscalYearOpen(this.repository.knex, settlement_date)
    return this.repository.createWithholdReceivableSettlement({
      settlement_date,
      fiscal_year: fy.fiscal_year,
      sales_order_ids: Array.isArray(sales_order_ids) ? sales_order_ids.map((id) => Number(id)) : [],
      reference_no: reference_no || null,
      notes: notes || null
    }, user?.id)
  }

  async listWithholdPayables(params) {
    return this.repository.listWithholdPayables(params)
  }

  async createWithholdPayableSettlement(body, user) {
    const { settlement_date, purchase_order_ids, reference_no, notes } = body
    if (!settlement_date) {
      const err = new Error('settlement_date is required')
      err.status = 400
      throw err
    }
    const fy = await assertFiscalYearOpen(this.repository.knex, settlement_date)
    return this.repository.createWithholdPayableSettlement({
      settlement_date,
      fiscal_year: fy.fiscal_year,
      purchase_order_ids: Array.isArray(purchase_order_ids) ? purchase_order_ids.map((id) => Number(id)) : [],
      reference_no: reference_no || null,
      notes: notes || null
    }, user?.id)
  }
}
