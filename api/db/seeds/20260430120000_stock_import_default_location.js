/**
 * Stock CSV import stores `inventories.location` as a string. Rows with an empty location
 * column are assigned {@link DEFAULT_STOCK_IMPORT_LOCATION} in importCsvHelpers and
 * inventories.repository (no separate `locations` table yet). This seed is a placeholder
 * so migrations/seeds history documents the convention: **Main Store**.
 */
export async function seed (_knex) {
  // Intentionally empty — default is applied during bulk import, not as FK data.
}
