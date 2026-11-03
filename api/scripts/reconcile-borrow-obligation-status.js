#!/usr/bin/env node
/**
 * Fix stale borrow_from_inventories / borrow_to_inventories.status from return sums.
 *
 * Usage (from api/):
 *   node scripts/reconcile-borrow-obligation-status.js --tenant-id=1
 *   node scripts/reconcile-borrow-obligation-status.js --tenant-id=1 --yes
 *
 * Default is dry-run (reports rows that would change). Pass --yes to apply updates.
 */
import knex from 'knex'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { InventoriesRepository } from '../src/modules/inventory/inventories.repository.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

function parseArgs(argv) {
  let tenantId = null
  let apply = false
  for (const arg of argv) {
    if (arg === '--yes') apply = true
    else if (arg.startsWith('--tenant-id=')) tenantId = parseInt(arg.slice('--tenant-id='.length), 10)
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/reconcile-borrow-obligation-status.js --tenant-id=<id> [--yes]`)
      process.exit(0)
    }
  }
  return { tenantId, dryRun: !apply }
}

const { tenantId, dryRun } = parseArgs(process.argv.slice(2))
if (!tenantId || Number.isNaN(tenantId)) {
  console.error('Missing or invalid --tenant-id=<number>')
  process.exit(1)
}

const knexfilePath = path.resolve(__dirname, '../db/knexfile.js')
const knexConfig = (await import(knexfilePath)).default
const db = knex(knexConfig)
const repo = new InventoriesRepository(db)

try {
  console.log(`Tenant ${tenantId} — ${dryRun ? 'DRY RUN' : 'APPLY'}`)
  const fromResult = await repo.reconcileBorrowFromInventoryStatuses(tenantId, { dryRun })
  const toResult = await repo.reconcileBorrowToInventoryStatuses(tenantId, { dryRun })

  console.log('\n=== borrow_from_inventories ===')
  console.log(`Would update / updated: ${fromResult.count}`)
  fromResult.updated.forEach((row) => {
    console.log(
      `  id=${row.id} ${row.from} → ${row.to} (borrowed=${row.totalBorrowed}, returned=${row.totalReturned}, remaining=${row.remaining})`
    )
  })

  console.log('\n=== borrow_to_inventories ===')
  console.log(`Would update / updated: ${toResult.count}`)
  toResult.updated.forEach((row) => {
    console.log(
      `  id=${row.id} ${row.from} → ${row.to} (borrowed=${row.totalBorrowed}, returned=${row.totalReturned}, remaining=${row.remaining})`
    )
  })

  if (dryRun && (fromResult.count > 0 || toResult.count > 0)) {
    console.log('\nRe-run with --yes to persist status fixes.')
  }
} finally {
  await db.destroy()
}
