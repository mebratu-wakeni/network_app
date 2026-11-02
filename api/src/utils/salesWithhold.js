/**
 * Sales withhold confirmation helpers (SQLite-friendly booleans, remark/ref parity).
 */

export function toBooleanFlag(v) {
  if (v === true || v === 1 || v === '1') return true
  if (v === false || v === 0 || v === '0') return false
  if (v == null) return false
  return Boolean(v)
}

/**
 * Withhold is confirmed only when the customer withholding receipt no. ({@code withhold_ref}) is stored
 * (and/or DB flag is set). Remark-only "promise" lines do not confirm.
 */
export function effectiveWithholdConfirmed(row) {
  const w = Number(row.withhold_amount ?? 0)
  if (w <= 0.009) return false
  const inv = row.withhold_ref != null && String(row.withhold_ref).trim() !== ''
  if (inv) return true
  return toBooleanFlag(row.withhold_confirmation)
}

/**
 * SQLite expression: row is effectively withhold-confirmed (matches {@link effectiveWithholdConfirmed}).
 * @param {import('knex').Knex} knex
 * @param {string} tableRef Qualified table or alias (e.g. 'so', 'sales_orders')
 */
export function rawWithholdEffectivelyConfirmed(knex, tableRef = 'so') {
  const t = tableRef
  return knex.raw(
    `(COALESCE(${t}.withhold_confirmation, 0) != 0
      OR (TRIM(COALESCE(${t}.withhold_ref, '')) != ''))`
  )
}
