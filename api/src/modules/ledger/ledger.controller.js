/**
 * Ledger controller: expose current account balances for dashboard/reporting.
 * Uses account_ledger latest row per account (balance can be positive or negative).
 */
import { LedgerHelper } from '../../services/ledger.helper.js'

const DASHBOARD_ACCOUNT_CODES = [
  '5100', '1300', '6100', '3100', '1200', // Revenue, Inventory, COGS, AP, AR
  '1100', '1250', '1400', // Current assets: Cash, Withhold Receivable, Prepaid
  '3200', '3210', '3300'  // Current liabilities: Accrued, Withholding Payable, Loans
]

export class LedgerController {
  constructor(knex) {
    this.knex = knex
    this.ledgerHelper = new LedgerHelper(knex)
  }

  /**
   * GET /ledger/balances
   * Query: codes (optional) - comma-separated account codes; defaults to Revenue, Inventory, COGS, AP, AR.
   * Returns { balances: { '5100': number, ... } }
   */
  getBalances = async (req, res, next) => {
    try {
      const codesParam = req.query.codes
      const accountCodes = codesParam
        ? codesParam.split(',').map((c) => String(c).trim()).filter(Boolean)
        : DASHBOARD_ACCOUNT_CODES

      const hasTable = await this.knex.schema.hasTable('account_ledger')
      if (!hasTable) {
        return res.json({ ok: true, balances: Object.fromEntries(accountCodes.map((c) => [c, 0])) })
      }

      const balances = await this.ledgerHelper.getCurrentBalances(accountCodes)
      res.json({ ok: true, balances })
    } catch (err) {
      next(err)
    }
  }
}
