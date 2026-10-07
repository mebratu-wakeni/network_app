#!/usr/bin/env node
/**
 * Diagnose ledger inconsistencies, especially Cash (1100) balance.
 *
 * Compares:
 * - Computed balance: SUM(debit - credit) per account (source of truth)
 * - Stored balance: balance from the last row per account (may be wrong)
 * - Deposits table sum vs deposit ledger entries
 *
 * Usage (from project root or api/):
 *   cd api && node scripts/diagnose-ledger.js
 *
 * To use a specific DB file (e.g. from packaged app's user data):
 *   DB_FILE=/path/to/pharmasuit_lan.db node scripts/diagnose-ledger.js
 */
import knex from 'knex'
import { fileURLToPath } from 'url'
import path from 'path'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const knexfilePath = path.resolve(__dirname, '../db/knexfile.js')
const knexConfig = (await import(knexfilePath)).default
const db = knex(knexConfig)

async function main() {
  const dbPath = knexConfig.connection?.filename || 'unknown'
  console.log('DB file:', dbPath)
  console.log('(Set DB_FILE=/path/to/db to use a different database, e.g. packaged app data)')
  console.log('')

  try {
    const hasLedger = await db.schema.hasTable('account_ledger')
    if (!hasLedger) {
      console.log('account_ledger table does not exist.')
      return
    }

    // --- Cash (1100): computed vs stored ---
    console.log('=== Cash (1100) ===')
    const computed = await db('account_ledger')
      .where('account_code', '1100')
      .select(db.raw('COALESCE(SUM(debit - credit), 0) as balance'))
      .first()
    const computedBalance = parseFloat(computed?.balance || 0)
    console.log('Computed balance (SUM(debit-credit)):', computedBalance.toFixed(2))

    const lastRow = await db('account_ledger')
      .where('account_code', '1100')
      .orderBy('id', 'desc')
      .first()
    const storedBalance = lastRow ? parseFloat(lastRow.balance || 0) : null
    if (storedBalance !== null) {
      console.log('Stored balance (last row):', storedBalance.toFixed(2))
      if (Math.abs(computedBalance - storedBalance) > 0.01) {
        console.log('>>> INCONSISTENCY: stored != computed (diff:', (storedBalance - computedBalance).toFixed(2), ')')
      }
    }
    console.log('')

    // --- All cash (1100) ledger rows ---
    const cashRows = await db('account_ledger')
      .where('account_code', '1100')
      .orderBy('id', 'asc')
      .select('id', 'transaction_date', 'debit', 'credit', 'balance', 'transaction_type', 'reference_no', 'description')

    console.log(`=== Cash (1100) ledger rows (${cashRows.length} total) ===`)
    if (cashRows.length > 0) {
      let running = 0
      for (const r of cashRows) {
        const d = parseFloat(r.debit || 0)
        const c = parseFloat(r.credit || 0)
        running += d - c
        const stored = parseFloat(r.balance || 0)
        const ok = Math.abs(running - stored) < 0.01 ? '' : ' <-- WRONG stored'
        console.log(
          `  id=${r.id} date=${r.transaction_date} DR=${d} CR=${c} running=${running.toFixed(2)} stored=${stored.toFixed(2)} ${r.transaction_type} ${r.reference_no || ''}${ok}`
        )
      }
    }
    console.log('')

    // --- Deposits: table vs ledger ---
    const hasDeposits = await db.schema.hasTable('deposits')
    if (hasDeposits) {
      const depositSum = await db('deposits')
        .where('is_reversed', false)
        .select(db.raw('COALESCE(SUM(amount), 0) as total'))
        .first()
      const depositTotal = parseFloat(depositSum?.total || 0)

      const depositLedgerSum = await db('account_ledger')
        .where('account_code', '1100')
        .where('transaction_type', 'deposit')
        .select(db.raw('COALESCE(SUM(debit - credit), 0) as total'))
        .first()
      const depositLedgerTotal = parseFloat(depositLedgerSum?.total || 0)

      console.log('=== Deposits ===')
      console.log('Sum from deposits table (not reversed):', depositTotal.toFixed(2))
      console.log('Sum of deposit ledger entries (DR Cash):', depositLedgerTotal.toFixed(2))
      if (Math.abs(depositTotal - depositLedgerTotal) > 0.01) {
        console.log('>>> MISMATCH: deposits table vs ledger (diff:', (depositTotal - depositLedgerTotal).toFixed(2), ')')
      }
    }
    console.log('')

    // --- Key account balances (computed) ---
    const codes = ['1100', '1200', '1300', '3100', '3200', '3210', '4100', '4300']
    const rows = await db('account_ledger')
      .whereIn('account_code', codes)
      .select('account_code')
      .select(db.raw('COALESCE(SUM(debit - credit), 0) as balance'))
      .groupBy('account_code')
    console.log('=== Key accounts (computed SUM(debit-credit)) ===')
    for (const c of codes) {
      const r = rows.find((x) => x.account_code === c)
      const bal = r ? parseFloat(r.balance || 0) : 0
      const name =
        c === '1100'
          ? 'Cash'
          : c === '1200'
            ? 'AR'
            : c === '1300'
              ? 'Inventory'
              : c === '3100'
                ? 'AP'
                : c === '3200'
                  ? 'Withhold Payable (purchases)'
                  : c === '3210'
                    ? 'Withhold Payable (sales)'
                    : c === '4100'
                      ? "Owner's Capital"
                      : c === '4300'
                        ? 'Opening Balance'
                        : c
      console.log(`  ${c} ${name}: ${bal.toFixed(2)}`)
    }
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

main()
