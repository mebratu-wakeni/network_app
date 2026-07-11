/**
 * Fiscal year enforcement guard.
 *
 * Call assertFiscalYearOpen() at the start of every transaction-creating
 * service method (sales order, purchase order, expense, deposit) to ensure:
 *
 *   1. A fiscal year exists whose date range covers the transaction date.
 *   2. That fiscal year is open (not closed).
 *
 * Returns the matching fiscal year row so callers can set `fiscal_year` on
 * the INSERT without a second DB round-trip.
 *
 * Uses a date-range lookup rather than year-number extraction so it works
 * correctly with any calendar (Gregorian, Ethiopian, custom fiscal periods).
 *
 * @param {import('knex').Knex | import('knex').Knex.Transaction} knex
 * @param {string} transactionDate - ISO date string (YYYY-MM-DD)
 * @returns {Promise<object>} the open fiscal year row
 * @throws {Error} HTTP 400 if no fiscal year covers the date or it is closed
 */
export async function assertFiscalYearOpen(knex, transactionDate) {
  if (!transactionDate) {
    const err = new Error('Transaction date is required.')
    err.status = 400
    throw err
  }

  const dateStr = String(transactionDate).substring(0, 10) // normalise to YYYY-MM-DD

  const fy = await knex('fiscal_years')
    .where('start_date', '<=', dateStr)
    .where('end_date', '>=', dateStr)
    .first()

  if (!fy) {
    const year = dateStr.substring(0, 4)
    const err = new Error(
      `No fiscal year covers ${dateStr}. ` +
      `Create and open fiscal year ${year} in Settings → Fiscal Year before recording this transaction.`
    )
    err.status = 400
    throw err
  }

  if (fy.status === 'closed') {
    const err = new Error(
      `Fiscal year ${fy.fiscal_year} (${fy.start_date} – ${fy.end_date}) is closed. ` +
      `Transactions in a closed fiscal year are not allowed.`
    )
    err.status = 400
    throw err
  }

  return fy
}
