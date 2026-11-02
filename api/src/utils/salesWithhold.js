/**
 * Sales withhold confirmation helpers (SQLite-friendly booleans, remark/ref parity).
 */

export function toBooleanFlag(v) {
  if (v === true || v === 1 || v === '1') return true
  if (v === false || v === 0 || v === '0') return false
  if (v == null) return false
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true' || s === 't') return true
    if (s === 'false' || s === 'f' || s === '') return false
  }
  return Boolean(v)
}

/** True when the sale was reversed (ledger/inventory rolled back). */
export function isReversedSalesOrder(row) {
  return toBooleanFlag(row?.is_reversed)
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

/** SQLite/Postgres: treat null is_reversed as not reversed. */
export function rawSalesOrderNotReversed(knex, tableRef = 'so') {
  const t = tableRef
  return knex.raw(`COALESCE(${t}.is_reversed, false) = false`)
}

export function rawSalesOrderReversed(knex, tableRef = 'so') {
  const t = tableRef
  return knex.raw(`COALESCE(${t}.is_reversed, false) = true`)
}

export function rawWithholdNotSettled(knex, tableRef = 'so') {
  const t = tableRef
  return knex.raw(`COALESCE(${t}.withhold_settled, false) = false`)
}

export function rawWithholdSettled(knex, tableRef = 'so') {
  const t = tableRef
  return knex.raw(`COALESCE(${t}.withhold_settled, false) = true`)
}

/**
 * When non-null, the order must not be reversed (business rules for withhold).
 * @param {object} order sales_orders row (or list row with withhold fields)
 * @returns {string|null}
 */
export function getSalesReverseBlockReason(order) {
  if (!order) return 'Sales order not found'
  if (order.is_reversed) return 'Order is already reversed'

  // Settled in Finance — not reversible via sales (regardless of stored withhold_amount).
  if (toBooleanFlag(order.withhold_settled)) {
    return 'This sale cannot be reversed because withhold tax was already settled.'
  }

  const withhold = Number(order.withhold_amount ?? 0)
  if (withhold <= 0.009) return null

  if (effectiveWithholdConfirmed(order)) {
    return 'Cannot reverse while withhold is confirmed. Roll back withhold confirmation on this order, then reverse the sale.'
  }

  return null
}

/** Active sales / withhold KPIs: completed, not reversed (reversal sets archived + is_reversed). */
export function isActiveSalesOrderForStats(row) {
  return row?.status === 'completed' && !isReversedSalesOrder(row)
}
