/**
 * Fiscal years service: business logic for listing, current, and closing
 */
import { LedgerHelper } from '../../services/ledger.helper.js'

export class FiscalYearsService {
  constructor(repository, knex) {
    this.repository = repository
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  async listAll() {
    return this.repository.listAll()
  }

  /**
   * Create a fiscal year with custom start and end dates.
   * Supports any calendar (Gregorian, Ethiopian, etc.).
   */
  async createFiscalYear({ fiscal_year, start_date, end_date }) {
    const yearNum = Number(fiscal_year)
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      const err = new Error('Invalid fiscal year. Must be between 1900 and 2100.')
      err.status = 400
      throw err
    }
    if (!start_date || !end_date || typeof start_date !== 'string' || typeof end_date !== 'string') {
      const err = new Error('start_date and end_date are required (YYYY-MM-DD)')
      err.status = 400
      throw err
    }
    const start = new Date(start_date)
    const end = new Date(end_date)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const err = new Error('Invalid start_date or end_date')
      err.status = 400
      throw err
    }
    if (start >= end) {
      const err = new Error('start_date must be before end_date')
      err.status = 400
      throw err
    }
    const existing = await this.repository.getByYear(yearNum)
    if (existing) {
      const err = new Error(`Fiscal year ${yearNum} already exists`)
      err.status = 400
      throw err
    }
    // Option A: only one open fiscal year is allowed at any time.
    const openYear = await this.repository.getAnyOpen()
    if (openYear) {
      const err = new Error(
        `Cannot create fiscal year ${yearNum}: fiscal year ${openYear.fiscal_year} is currently open. Close it first.`
      )
      err.status = 400
      throw err
    }
    const overlaps = await this.repository.hasOverlappingDates(start_date, end_date)
    if (overlaps) {
      const err = new Error('Date range overlaps with an existing fiscal year')
      err.status = 400
      throw err
    }
    return this.repository.create({ fiscal_year: yearNum, start_date, end_date })
  }

  /**
   * Get current open fiscal year.
   * Returns the year that contains today and is open, or the latest open year if before year start.
   */
  async getCurrent() {
    let row = await this.repository.getCurrent()
    if (!row) {
      row = await this.repository.getLatestOpen()
    }
    return row
  }

  /** Temporary (Revenue/Expense) account codes – close to Retained Earnings (4200). */
  static REVENUE_CODES = ['5100', '5200']
  static EXPENSE_CODES = ['6100', '6200', '6300']

  /**
   * Close a fiscal year: close Revenue and Expense to Retained Earnings (4200).
   * Does NOT post entries for permanent accounts (Assets, Liabilities, other Equity);
   * their balances carry forward naturally in the ledger.
   */
  async closeFiscalYear(year, userId) {
    const yearNum = Number(year)
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      const err = new Error('Invalid fiscal year')
      err.status = 400
      throw err
    }

    const fy = await this.repository.getByYear(yearNum)
    if (!fy) {
      const err = new Error(`Fiscal year ${yearNum} not found`)
      err.status = 404
      throw err
    }
    if (fy.status === 'closed') {
      const err = new Error(`Fiscal year ${yearNum} is already closed`)
      err.status = 400
      throw err
    }
    const today = new Date().toISOString().split('T')[0]
    if (fy.end_date > today) {
      const err = new Error(`Cannot close fiscal year before it ends. End date is ${fy.end_date}.`)
      err.status = 400
      throw err
    }

    const endDate = fy.end_date
    const end = new Date(endDate)
    end.setDate(end.getDate() + 1)
    const nextYearStart = end.toISOString().split('T')[0]

    const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

    return this.knex.transaction(async (trx) => {
      const balances = await this.repository.getClosingBalances(endDate, trx)
      const balanceMap = Object.fromEntries(balances.map((b) => [b.account_code, round2(b.balance)]))

      const entries = []
      let totalRevenue = 0
      let totalExpenses = 0

      // Close Revenue (5100, 5200): credit-normal, balance negative. DR to zero.
      for (const code of FiscalYearsService.REVENUE_CODES) {
        const bal = balanceMap[code] ?? 0
        if (Math.abs(bal) < 0.01) continue
        const amt = Math.abs(bal)
        totalRevenue += amt
        entries.push({
          account_code: code,
          debit: amt,
          credit: 0,
          description: `FY ${yearNum} closing – revenue to retained earnings`
        })
      }

      // Close Expenses (6100, 6200, 6300): debit-normal, balance positive. CR to zero.
      for (const code of FiscalYearsService.EXPENSE_CODES) {
        const bal = balanceMap[code] ?? 0
        if (Math.abs(bal) < 0.01) continue
        totalExpenses += bal
        entries.push({
          account_code: code,
          debit: 0,
          credit: bal,
          description: `FY ${yearNum} closing – expense to retained earnings`
        })
      }

      const netIncome = round2(totalRevenue - totalExpenses)
      if (Math.abs(netIncome) >= 0.01) {
        if (netIncome > 0) {
          entries.push({
            account_code: '4200',
            debit: 0,
            credit: netIncome,
            description: `FY ${yearNum} net income to retained earnings`
          })
        } else {
          entries.push({
            account_code: '4200',
            debit: Math.abs(netIncome),
            credit: 0,
            description: `FY ${yearNum} net loss to retained earnings`
          })
        }
      }

      if (entries.length > 0) {
        await this.ledgerHelper.postGLTransaction(
          {
            transaction_date: nextYearStart,
            reference_no: `FY-CLOSE-${yearNum}`,
            reference_table: 'fiscal_years',
            reference_id: fy.id,
            description: `Year-end closing: Revenue & Expenses → Retained Earnings (FY ${yearNum})`,
            transaction_type: 'year_end_closing',
            entries,
            created_by: userId
          },
          trx
        )
      }

      const [closedRow] = await this.knex('fiscal_years')
        .transacting(trx)
        .where({ fiscal_year: yearNum })
        .update({
          status: 'closed',
          closed_at: trx.fn.now(),
          closed_by: userId,
          last_updated: trx.fn.now()
        })
        .returning('*')
      if (!closedRow) {
        const err = new Error('Failed to close fiscal year')
        err.status = 500
        throw err
      }
      return closedRow
    })
  }

  /**
   * Reopen a closed fiscal year: reverse closing ledger entries and set status to open.
   */
  async reopenFiscalYear(year, userId) {
    const yearNum = Number(year)
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      const err = new Error('Invalid fiscal year')
      err.status = 400
      throw err
    }

    const fy = await this.repository.getByYear(yearNum)
    if (!fy) {
      const err = new Error(`Fiscal year ${yearNum} not found`)
      err.status = 404
      throw err
    }
    if (fy.status !== 'closed') {
      const err = new Error(`Fiscal year ${yearNum} is not closed`)
      err.status = 400
      throw err
    }
    // Option A: cannot reopen while another year is open
    const openYear = await this.repository.getAnyOpen()
    if (openYear) {
      const err = new Error(
        `Cannot reopen fiscal year ${yearNum}: fiscal year ${openYear.fiscal_year} is currently open. Close it first.`
      )
      err.status = 400
      throw err
    }

    const today = new Date().toISOString().split('T')[0]

    return this.knex.transaction(async (trx) => {
      await this.ledgerHelper.reverseFiscalYearClosing(
        {
          fiscalYearId: fy.id,
          transactionDate: today,
          reason: 'Reopen fiscal year',
          referenceNumber: `FY-REOPEN-${yearNum}`,
          createdBy: userId
        },
        trx
      )

      const [reopenedRow] = await this.knex('fiscal_years')
        .transacting(trx)
        .where({ fiscal_year: yearNum })
        .update({
          status: 'open',
          closed_at: null,
          closed_by: null,
          last_updated: trx.fn.now()
        })
        .returning('*')

      if (!reopenedRow) {
        const err = new Error('Failed to reopen fiscal year')
        err.status = 500
        throw err
      }
      return reopenedRow
    })
  }

  /**
   * Delete a fiscal year. Only allowed if open. With transactions, use force=true to override.
   */
  async deleteFiscalYear(year, force = false) {
    const yearNum = Number(year)
    if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
      const err = new Error('Invalid fiscal year')
      err.status = 400
      throw err
    }
    const fy = await this.repository.getByYear(yearNum)
    if (!fy) {
      const err = new Error(`Fiscal year ${yearNum} not found`)
      err.status = 404
      throw err
    }
    if (fy.status === 'closed') {
      const err = new Error('Cannot delete a closed fiscal year')
      err.status = 400
      throw err
    }
    const counts = await this.repository.getTransactionCountsInRange(fy.start_date, fy.end_date)
    const hasTx = counts.ledger + counts.deposits + counts.expenses + counts.purchases + counts.sales > 0
    if (hasTx && !force) {
      const parts = []
      if (counts.ledger) parts.push(`${counts.ledger} ledger`)
      if (counts.deposits) parts.push(`${counts.deposits} deposits`)
      if (counts.expenses) parts.push(`${counts.expenses} expenses`)
      if (counts.purchases) parts.push(`${counts.purchases} purchases`)
      if (counts.sales) parts.push(`${counts.sales} sales`)
      const err = new Error(`This fiscal year has transactions (${parts.join(', ')}). Use Force Delete to remove only the fiscal year record; your transaction data will stay.`)
      err.status = 400
      err.details = { counts }
      throw err
    }
    const ok = await this.repository.delete(yearNum)
    if (!ok) {
      const err = new Error('Failed to delete fiscal year')
      err.status = 500
      throw err
    }
    return { success: true }
  }

  /**
   * Get report summary for a closed fiscal year
   */
  async getReport(year) {
    const yearNum = Number(year)
    const fy = await this.repository.getByYear(yearNum)
    if (!fy) {
      const err = new Error(`Fiscal year ${yearNum} not found`)
      err.status = 404
      throw err
    }
    if (fy.status !== 'closed') {
      const err = new Error('Report available only for closed fiscal years')
      err.status = 400
      throw err
    }
    return this.repository.getReport(yearNum)
  }
}
