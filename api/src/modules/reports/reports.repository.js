/**
 * Reports repository: ledger and chart of accounts data for financial statements
 */
import { LedgerHelper } from '../../services/ledger.helper.js'

export class ReportsRepository {
  constructor(knex) {
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  async getChartOfAccounts(tenantId) {
    const rows = await this.knex('chart_of_accounts')
      .where({ tenant_id: tenantId, is_active: true })
      .orderBy('account_code', 'asc')
    return rows
  }

  async getChartOfAccountsForReporting(tenantId) {
    const codesWithLedger = await this.knex('account_ledger')
      .where({ tenant_id: tenantId })
      .distinct('account_code')
      .pluck('account_code')
    const rows = await this.knex('chart_of_accounts')
      .where({ tenant_id: tenantId })
      .where(function includeActiveOrUsed() {
        this.where({ is_active: true }).orWhereIn('account_code', codesWithLedger)
      })
      .orderBy('account_code', 'asc')
    return rows
  }

  async getClosingBalances(tenantId, asOfDate) {
    return this.ledgerHelper.getClosingBalances(asOfDate, null, tenantId)
  }

  async getPeriodActivity(tenantId, dateFrom, dateTo) {
    const rows = await this.knex('account_ledger')
      .where({ tenant_id: tenantId })
      .whereBetween('transaction_date', [dateFrom, dateTo])
      .select(
        'account_code',
        this.knex.raw('MAX(account_name) as account_name'),
        this.knex.raw('COALESCE(SUM(debit), 0) as total_debit'),
        this.knex.raw('COALESCE(SUM(credit), 0) as total_credit')
      )
      .groupBy('account_code')

    return rows.map((r) => ({
      account_code: r.account_code,
      account_name: r.account_name,
      total_debit: parseFloat(r.total_debit || 0),
      total_credit: parseFloat(r.total_credit || 0)
    }))
  }
}
