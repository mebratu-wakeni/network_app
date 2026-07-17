#!/usr/bin/env node
/**
 * Read-only audit: find transaction dates that fall outside any fiscal_years row,
 * or ledger rows with null/mismatched fiscal_year.
 *
 * Usage (from api/):
 *   node scripts/audit-fiscal-year-coverage.js
 *
 * Exit codes:
 *   0 — no gaps found
 *   1 — gaps found (or fatal error)
 *
 * Does not mutate data. Fix gaps by inserting/adjusting fiscal_years rows
 * so every historical date is covered (closed years are fine for history;
 * only new writes require an open FY covering the write date).
 */
import knexConfig from '../db/knexfile.js'
import knexFactory from 'knex'

const knex = knexFactory(knexConfig)

const TABLES = [
  { table: 'sales_orders', dateCol: 'order_date', label: 'sales' },
  { table: 'purchase_orders', dateCol: 'order_date', label: 'purchases' },
  { table: 'expenses', dateCol: 'paid_on', label: 'expenses' },
  { table: 'deposits', dateCol: 'deposit_date', label: 'deposits' },
  { table: 'account_ledger', dateCol: 'transaction_date', label: 'ledger' },
  { table: 'inventories', dateCol: 'purchase_date', label: 'inventories' }
]

async function tableExists(name) {
  return knex.schema.hasTable(name)
}

async function main() {
  const env = process.env.NODE_ENV || 'development'
  console.log(`Auditing fiscal year coverage (${env})...\n`)

  if (!(await tableExists('fiscal_years'))) {
    console.error('fiscal_years table missing')
    return 1
  }

  const years = await knex('fiscal_years').select('*').orderBy('fiscal_year')
  console.log(`Fiscal years (${years.length}):`)
  for (const y of years) {
    console.log(`  ${y.fiscal_year}  ${y.start_date} → ${y.end_date}  [${y.status}]`)
  }
  console.log('')

  let totalGaps = 0

  for (const { table, dateCol, label } of TABLES) {
    if (!(await tableExists(table))) {
      console.log(`skip ${label}: table not present`)
      continue
    }

    const hasDate = await knex.schema.hasColumn(table, dateCol)
    if (!hasDate) {
      console.log(`skip ${label}: no column ${dateCol}`)
      continue
    }

    // Rows whose date is not inside any fiscal year range
    const outside = await knex(table)
      .whereNotNull(dateCol)
      .whereNotExists(function () {
        this.select(knex.raw(1))
          .from('fiscal_years')
          .whereRaw(`date(fiscal_years.start_date) <= date(${table}.${dateCol})`)
          .whereRaw(`date(fiscal_years.end_date) >= date(${table}.${dateCol})`)
      })
      .count('* as c')
      .first()

    const count = Number(outside?.c || 0)
    if (count > 0) {
      totalGaps += count
      const samples = await knex(table)
        .whereNotNull(dateCol)
        .whereNotExists(function () {
          this.select(knex.raw(1))
            .from('fiscal_years')
            .whereRaw(`date(fiscal_years.start_date) <= date(${table}.${dateCol})`)
            .whereRaw(`date(fiscal_years.end_date) >= date(${table}.${dateCol})`)
        })
        .select('id', dateCol)
        .limit(5)
      console.log(`GAP ${label}: ${count} row(s) outside any FY (sample ids: ${samples.map((r) => r.id).join(', ')})`)
    } else {
      console.log(`ok   ${label}: all dated rows covered by a fiscal year`)
    }
  }

  // Ledger fiscal_year column consistency (if present)
  if (await tableExists('account_ledger') && (await knex.schema.hasColumn('account_ledger', 'fiscal_year'))) {
    const nullFy = await knex('account_ledger').whereNull('fiscal_year').count('* as c').first()
    const nullCount = Number(nullFy?.c || 0)
    if (nullCount > 0) {
      totalGaps += nullCount
      console.log(`GAP ledger: ${nullCount} row(s) with null fiscal_year`)
    } else {
      console.log('ok   ledger: no null fiscal_year')
    }
  }

  console.log('')
  if (totalGaps > 0) {
    console.log(`Found ${totalGaps} gap(s). Insert or extend fiscal_years so historical dates are covered.`)
    console.log('Closed years are OK for history; only new writes need an open FY.')
    return 1
  }

  console.log('No coverage gaps found.')
  return 0
}

try {
  const code = await main()
  await knex.destroy()
  process.exit(code)
} catch (err) {
  console.error(err)
  try { await knex.destroy() } catch { /* ignore */ }
  process.exit(1)
}
