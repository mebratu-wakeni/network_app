/**
 * Fiscal years repository: DB access for fiscal years and ledger balances
 */
import { LedgerHelper } from '../../services/ledger.helper.js'

export class FiscalYearsRepository {
  constructor(knex) {
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  /**
   * List all fiscal years, ordered by fiscal_year descending
   */
  async listAll() {
    const rows = await this.knex('fiscal_years')
      .select('*')
      .orderBy('fiscal_year', 'desc')
    return rows
  }

  /**
   * Get fiscal year by year number
   */
  async getByYear(year) {
    return this.knex('fiscal_years').where({ fiscal_year: Number(year) }).first()
  }

  /**
   * Get current open fiscal year (today's date falls within start_date..end_date and status=open)
   */
  async getCurrent() {
    const today = new Date().toISOString().split('T')[0]
    const row = await this.knex('fiscal_years')
      .where('start_date', '<=', today)
      .where('end_date', '>=', today)
      .where('status', 'open')
      .first()
    return row
  }

  /**
   * Get the latest open fiscal year if no current exists (e.g. before start of year)
   */
  async getLatestOpen() {
    return this.knex('fiscal_years')
      .where('status', 'open')
      .orderBy('fiscal_year', 'desc')
      .first()
  }

  /**
   * Return ANY open fiscal year (used to enforce the single-open-year rule).
   * Returns null if all years are closed or no years exist.
   */
  async getAnyOpen() {
    return this.knex('fiscal_years').where('status', 'open').first()
  }

  /**
   * Check if any fiscal year overlaps with the given date range.
   * Overlap: existing.start <= new.end AND existing.end >= new.start
   */
  async hasOverlappingDates(start_date, end_date, excludeYear = null) {
    let q = this.knex('fiscal_years')
      .where('start_date', '<=', end_date)
      .where('end_date', '>=', start_date)
    if (excludeYear != null) {
      q = q.whereNot('fiscal_year', excludeYear)
    }
    const row = await q.first()
    return !!row
  }

  /**
   * Get transaction counts in date range (for error messages)
   */
  async getTransactionCountsInRange(start_date, end_date) {
    const [[ledger], [deps], [exps], [pos], [sos]] = await Promise.all([
      this.knex('account_ledger').whereBetween('transaction_date', [start_date, end_date]).count('* as c'),
      this.knex('deposits').whereBetween('deposit_date', [start_date, end_date]).where((b) => b.where('is_reversed', false).orWhereNull('is_reversed')).count('* as c'),
      this.knex('expenses').whereBetween('paid_on', [start_date, end_date]).count('* as c'),
      this.knex('purchase_orders').whereBetween('order_date', [start_date, end_date]).count('* as c'),
      this.knex('sales_orders').whereBetween('order_date', [start_date, end_date]).count('* as c')
    ])
    return {
      ledger: Number(ledger?.c || 0),
      deposits: Number(deps?.c || 0),
      expenses: Number(exps?.c || 0),
      purchases: Number(pos?.c || 0),
      sales: Number(sos?.c || 0)
    }
  }

  /**
   * Check if any transactions exist in the given date range (ledger, deposits, expenses, etc.)
   */
  async hasTransactionsInRange(start_date, end_date) {
    const counts = await this.getTransactionCountsInRange(start_date, end_date)
    return counts.ledger + counts.deposits + counts.expenses + counts.purchases + counts.sales > 0
  }

  /**
   * Delete a fiscal year
   */
  async delete(year) {
    const deleted = await this.knex('fiscal_years')
      .where({ fiscal_year: Number(year) })
      .delete()
    return deleted > 0
  }

  /**
   * Create a fiscal year with custom start and end dates
   */
  async create({ fiscal_year, start_date, end_date }) {
    const [row] = await this.knex('fiscal_years')
      .insert({
        fiscal_year: Number(fiscal_year),
        start_date,
        end_date,
        status: 'open'
      })
      .returning('*')
    return row
  }

  /**
   * Update fiscal year - close it
   */
  async closeFiscalYear(year, userId) {
    const [updated] = await this.knex('fiscal_years')
      .where({ fiscal_year: Number(year) })
      .update({
        status: 'closed',
        closed_at: this.knex.fn.now(),
        closed_by: userId,
        last_updated: this.knex.fn.now()
      })
      .returning('*')
    return updated
  }

  /**
   * Get summary report for a fiscal year (for closed years)
   */
  async getReport(year) {
    const fy = await this.getByYear(year)
    if (!fy) return null
    const start = fy.start_date
    const end = fy.end_date

    const [deposits] = await this.knex('deposits')
      .whereBetween('deposit_date', [start, end])
      .where((b) => b.where('is_reversed', false).orWhereNull('is_reversed'))
      .sum('amount as total')
    const [expenses] = await this.knex('expenses')
      .whereBetween('paid_on', [start, end])
      .sum('amount as total')
    const [purchases] = await this.knex('purchase_orders')
      .whereBetween('order_date', [start, end])
      .count('* as count')
      .sum('total_amount as total')
    const [sales] = await this.knex('sales_orders')
      .whereBetween('order_date', [start, end])
      .count('* as count')
      .sum('total_amount as total')
    const [ledgerRows] = await this.knex('account_ledger')
      .whereBetween('transaction_date', [start, end])
      .count('* as count')

    const closingBalances = await this.getClosingBalances(end)

    return {
      fiscal_year: fy,
      deposits_total: parseFloat(deposits?.total || 0),
      expenses_total: parseFloat(expenses?.total || 0),
      purchases_count: Number(purchases?.count || 0),
      purchases_total: parseFloat(purchases?.total || 0),
      sales_count: Number(sales?.count || 0),
      sales_total: parseFloat(sales?.total || 0),
      ledger_entries_count: Number(ledgerRows?.count || 0),
      closing_balances: closingBalances
    }
  }

  /**
   * Get ending balance per account as of a given date.
   * Delegates to LedgerHelper.getClosingBalances (computed from debit/credit).
   */
  async getClosingBalances(asOfDate, trx = null) {
    return this.ledgerHelper.getClosingBalances(asOfDate, trx)
  }
}
