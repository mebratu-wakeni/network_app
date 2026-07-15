/**
 * Fiscal years repository: DB access for fiscal years and ledger balances
 */
import { LedgerHelper } from '../../services/ledger.helper.js'

export class FiscalYearsRepository {
  constructor(knex) {
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  async listAll(tenantId) {
    return this.knex('fiscal_years')
      .where({ tenant_id: tenantId })
      .select('*')
      .orderBy('fiscal_year', 'desc')
  }

  async getByYear(tenantId, year) {
    return this.knex('fiscal_years')
      .where({ tenant_id: tenantId, fiscal_year: Number(year) })
      .first()
  }

  async getCurrent(tenantId) {
    const today = new Date().toISOString().split('T')[0]
    return this.knex('fiscal_years')
      .where({ tenant_id: tenantId })
      .where('start_date', '<=', today)
      .where('end_date', '>=', today)
      .where('status', 'open')
      .first()
  }

  async getLatestOpen(tenantId) {
    return this.knex('fiscal_years')
      .where({ tenant_id: tenantId, status: 'open' })
      .orderBy('fiscal_year', 'desc')
      .first()
  }

  async getAnyOpen(tenantId) {
    return this.knex('fiscal_years')
      .where({ tenant_id: tenantId, status: 'open' })
      .first()
  }

  async hasOverlappingDates(tenantId, start_date, end_date, excludeYear = null) {
    let q = this.knex('fiscal_years')
      .where({ tenant_id: tenantId })
      .where('start_date', '<=', end_date)
      .where('end_date', '>=', start_date)
    if (excludeYear != null) {
      q = q.whereNot('fiscal_year', excludeYear)
    }
    const row = await q.first()
    return !!row
  }

  async getTransactionCountsInRange(tenantId, start_date, end_date) {
    const tenantFilter = { tenant_id: tenantId }
    const [[ledger], [deps], [exps], [pos], [sos]] = await Promise.all([
      this.knex('account_ledger').where(tenantFilter).whereBetween('transaction_date', [start_date, end_date]).count('* as c'),
      this.knex('deposits').where(tenantFilter).whereBetween('deposit_date', [start_date, end_date]).where((b) => b.where('is_reversed', false).orWhereNull('is_reversed')).count('* as c'),
      this.knex('expenses').where(tenantFilter).whereBetween('paid_on', [start_date, end_date]).count('* as c'),
      this.knex('purchase_orders').where(tenantFilter).whereBetween('order_date', [start_date, end_date]).count('* as c'),
      this.knex('sales_orders').where(tenantFilter).whereBetween('order_date', [start_date, end_date]).count('* as c')
    ])
    return {
      ledger: Number(ledger?.c || 0),
      deposits: Number(deps?.c || 0),
      expenses: Number(exps?.c || 0),
      purchases: Number(pos?.c || 0),
      sales: Number(sos?.c || 0)
    }
  }

  async hasTransactionsInRange(tenantId, start_date, end_date) {
    const counts = await this.getTransactionCountsInRange(tenantId, start_date, end_date)
    return counts.ledger + counts.deposits + counts.expenses + counts.purchases + counts.sales > 0
  }

  async delete(tenantId, year) {
    const deleted = await this.knex('fiscal_years')
      .where({ tenant_id: tenantId, fiscal_year: Number(year) })
      .delete()
    return deleted > 0
  }

  async create(tenantId, { fiscal_year, start_date, end_date }) {
    const [row] = await this.knex('fiscal_years')
      .insert({
        tenant_id: tenantId,
        fiscal_year: Number(fiscal_year),
        start_date,
        end_date,
        status: 'open'
      })
      .returning('*')
    return row
  }

  async closeFiscalYear(tenantId, year, userId) {
    const [updated] = await this.knex('fiscal_years')
      .where({ tenant_id: tenantId, fiscal_year: Number(year) })
      .update({
        status: 'closed',
        closed_at: this.knex.fn.now(),
        closed_by: userId,
        last_updated: this.knex.fn.now()
      })
      .returning('*')
    return updated
  }

  async getReport(tenantId, year) {
    const fy = await this.getByYear(tenantId, year)
    if (!fy) return null
    const start = fy.start_date
    const end = fy.end_date
    const tenantFilter = { tenant_id: tenantId }

    const [deposits] = await this.knex('deposits')
      .where(tenantFilter)
      .whereBetween('deposit_date', [start, end])
      .where((b) => b.where('is_reversed', false).orWhereNull('is_reversed'))
      .sum('amount as total')
    const [expenses] = await this.knex('expenses')
      .where(tenantFilter)
      .whereBetween('paid_on', [start, end])
      .sum('amount as total')
    const [purchases] = await this.knex('purchase_orders')
      .where(tenantFilter)
      .whereBetween('order_date', [start, end])
      .count('* as count')
      .sum('total_amount as total')
    const [sales] = await this.knex('sales_orders')
      .where(tenantFilter)
      .whereBetween('order_date', [start, end])
      .count('* as count')
      .sum('total_amount as total')
    const [ledgerRows] = await this.knex('account_ledger')
      .where(tenantFilter)
      .whereBetween('transaction_date', [start, end])
      .count('* as count')

    const closingBalances = await this.getClosingBalances(tenantId, end)

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

  async getClosingBalances(tenantId, asOfDate, trx = null) {
    const db = trx || this.knex
    const dateStr = typeof asOfDate === 'string' && asOfDate.length >= 10
      ? asOfDate.slice(0, 10)
      : asOfDate instanceof Date
        ? asOfDate.toISOString().slice(0, 10)
        : String(asOfDate || '').slice(0, 10)

    if (!dateStr || dateStr.length < 10) return []

    const rows = await db('account_ledger')
      .where({ tenant_id: tenantId })
      .where('transaction_date', '<=', dateStr)
      .select(
        'account_code',
        db.raw('MAX(account_name) as account_name'),
        db.raw('COALESCE(SUM(debit - credit), 0) as balance')
      )
      .groupBy('account_code')

    return rows.map((r) => ({
      account_code: r.account_code,
      account_name: r.account_name,
      balance: parseFloat(r.balance || 0)
    }))
  }
}
