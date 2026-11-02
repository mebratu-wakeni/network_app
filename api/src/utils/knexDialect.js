/** @param {import('knex').Knex} knex */
export function isPostgresKnex(knex) {
  const client = String(knex?.client?.config?.client ?? '')
  return client === 'pg' || client === 'postgresql' || client === 'postgres'
}

/**
 * Expiring-soon upper bound: expiry on or before today + product expiry_threshold (days).
 * SQLite uses DATE(..., '+N days'); Postgres uses date + integer days.
 *
 * @param {import('knex').Knex} knex
 * @param {string} todayStr ISO date YYYY-MM-DD
 * @param {number} defaultThresholdDays
 */
export function rawExpiringSoonUpperBound(knex, todayStr, defaultThresholdDays) {
  if (isPostgresKnex(knex)) {
    return knex.raw(
      `inventories.expiry_date::date <= (?::date + COALESCE(products.expiry_threshold, ?)::integer)`,
      [todayStr, defaultThresholdDays]
    )
  }
  return knex.raw(
    `DATE(inventories.expiry_date) <= DATE(?, '+' || COALESCE(products.expiry_threshold, ?) || ' days')`,
    [todayStr, defaultThresholdDays]
  )
}
