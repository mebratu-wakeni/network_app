/**
 * Reports repository: ledger and chart of accounts data for financial statements
 */
import { LedgerHelper } from '../../services/ledger.helper.js'

export class ReportsRepository {
  constructor(knex) {
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  /**
   * Get chart of accounts ordered by account_code
   */
  async getChartOfAccounts() {
    const rows = await this.knex('chart_of_accounts')
      .where({ is_active: true })
      .orderBy('account_code', 'asc')
    return rows
  }

  /**
   * Get closing balance per account as of a date.
   * Delegates to LedgerHelper.getClosingBalances (computed from debit/credit).
   */
  async getClosingBalances(asOfDate) {
    return this.ledgerHelper.getClosingBalances(asOfDate)
  }

  /**
   * Get period activity (sum of debit, credit) per account in date range.
   * Groups by account_code only so all activity for the same account is summed,
   * regardless of account_name variations (e.g. from chart updates over time).
   */
  async getPeriodActivity(dateFrom, dateTo) {
    const rows = await this.knex('account_ledger')
      .select(
        'account_code',
        this.knex.raw('MAX(account_name) as account_name'),
        this.knex.raw('COALESCE(SUM(debit), 0) as total_debit'),
        this.knex.raw('COALESCE(SUM(credit), 0) as total_credit')
      )
      .whereBetween('transaction_date', [dateFrom, dateTo])
      .groupBy('account_code')

    return rows.map((r) => ({
      account_code: r.account_code,
      account_name: r.account_name,
      total_debit: parseFloat(r.total_debit || 0),
      total_credit: parseFloat(r.total_credit || 0)
    }))
  }
}
