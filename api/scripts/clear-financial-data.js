#!/usr/bin/env node
/**
 * Delete financial / operational data so reports and stock stay consistent.
 *
 * Requires --yes (safety).
 *
 * Complete database recreate (drops all tables + migrations from scratch, optional seeds):
 *   npm run db:reset        # schema only, empty
 *   npm run db:reset:seed   # schema + knex seeds (roles, rules, walk-in customer, COA, etc.)
 * Use when you want zero legacy rows and a guaranteed clean slate (best for debugging reports).
 *
 * In-place clears (schema kept; users / products / categories typically kept):
 *   npm run db:reset-operational-full
 *   npm run db:clear-financial -- --yes --scope=ledger
 *   npm run db:clear-financial -- --yes --scope=transactions [--seed-coa]
 *
 * Scopes:
 *   ledger        — account_ledger only
 *   transactions  — withhold → sales/purchase → GL → expenses, deposits, loans, fiscal_years
 *   full          — transactions + bin_cards + borrow_* + inventories (empty warehouse; catalog intact)
 *
 * --seed-coa  — Replace chart_of_accounts with seed_chart_of_accounts.js (custom COA is wiped).
 */
import knex from 'knex'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { seed as seedChartOfAccounts } from '../db/seeds/seed_chart_of_accounts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const knexfilePath = path.resolve(__dirname, '../db/knexfile.js')
const knexConfig = (await import(knexfilePath)).default
const db = knex(knexConfig)

/** Child / dependent tables first (SQLite FK-safe order when foreign_keys=OFF). */
const TRANSACTION_DELETE_ORDER = [
  'withhold_receivable_settlement_items',
  'withhold_receivable_settlements',
  'withhold_payable_settlement_items',
  'withhold_payable_settlements',
  'sales_payments',
  'sales_order_items',
  'sales_orders',
  'sales_hold_orders',
  'purchase_payments',
  'purchase_receipts',
  'purchase_order_items',
  'purchase_orders',
  'purchase_hold_orders',
  'account_ledger',
  'expenses',
  'deposits',
  'cash_loans_receivable',
  'cash_loans_payable',
  'fiscal_years'
]

/** After transaction wipe: stock movement, borrows, then inventory lots (FK-safe). */
const FULL_DELETE_ORDER = [
  ...TRANSACTION_DELETE_ORDER,
  'bin_cards',
  'borrow_to_returns',
  'borrow_to_inventories',
  'borrow_from_returns',
  'borrow_from_inventories',
  'inventories'
]

function parseArgs(argv) {
  let yes = false
  let scope = null
  let seedCoa = false
  for (const a of argv) {
    if (a === '--yes') yes = true
    else if (a === '--seed-coa') seedCoa = true
    else if (a.startsWith('--scope=')) scope = a.slice('--scope='.length)
  }
  return { yes, scope, seedCoa }
}

async function deleteFromTable(trx, tableName) {
  const exists = await trx.schema.hasTable(tableName)
  if (!exists) return null
  const n = await trx(tableName).del()
  return n
}

async function main() {
  const { yes, scope: rawScope, seedCoa } = parseArgs(process.argv.slice(2))

  if (!yes) {
    console.error(
      'Refusing to clear data without --yes. See file header in scripts/clear-financial-data.js for usage.'
    )
    process.exit(1)
  }

  const scope = rawScope || 'ledger'
  if (scope !== 'ledger' && scope !== 'transactions' && scope !== 'full') {
    console.error('Invalid --scope. Use ledger, transactions, or full.')
    process.exit(1)
  }

  const client = db.client.config.client
  const isSqlite = client === 'sqlite3' || client === 'sqlite'

  try {
    console.log(`Clearing financial data (scope=${scope})...`)

    await db.transaction(async (trx) => {
      if (isSqlite) {
        await trx.raw('PRAGMA foreign_keys = OFF')
      }

      const tables =
        scope === 'full'
          ? FULL_DELETE_ORDER
          : scope === 'transactions'
            ? TRANSACTION_DELETE_ORDER
            : null

      if (tables) {
        for (const t of tables) {
          const n = await deleteFromTable(trx, t)
          if (n !== null) console.log(`  ${t}: deleted ${n} row(s)`)
        }
      } else {
        const n = await deleteFromTable(trx, 'account_ledger')
        if (n !== null) console.log(`  account_ledger: deleted ${n} row(s)`)
      }

      if (isSqlite) {
        await trx.raw('PRAGMA foreign_keys = ON')
      }
    })

    if (seedCoa) {
      console.log('Reseeding chart_of_accounts from seed_chart_of_accounts.js …')
      await seedChartOfAccounts(db)
      console.log('  COA reseed done.')
    }

    console.log('Done.')
  } catch (err) {
    console.error('Clear failed:', err.message)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

main()
