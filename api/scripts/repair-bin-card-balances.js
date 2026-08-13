#!/usr/bin/env node
/**
 * Rebuild bin_cards.opening_balance / balance in posting order (id ASC).
 *
 * Does NOT change quantity_in, quantity_out, dates, or any other tables.
 * Safe for live Dedicated Cloud SQLite after deploying the getLastProductBalance fix.
 *
 * Usage (from api/ on the server):
 *   node scripts/repair-bin-card-balances.js          # dry-run
 *   node scripts/repair-bin-card-balances.js --yes    # apply (backs up DB first)
 *   node scripts/repair-bin-card-balances.js --yes --no-backup
 *
 * DB path: same as the running API (../db/pharmasuit_lan.db or DB_FILE in .env).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import knex from 'knex'
import dotenv from 'dotenv'
import { resolveDbFilePath } from '../db/resolve-db-file.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const args = process.argv.slice(2)
const apply = args.includes('--yes')
const noBackup = args.includes('--no-backup')

function int(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

async function run() {
  const knexConfig = (await import(path.resolve(__dirname, '../db/knexfile.js'))).default
  const dbFile = resolveDbFilePath()

  console.log(`DB: ${dbFile}`)
  console.log(apply ? 'Mode: APPLY' : 'Mode: DRY-RUN')

  if (!fs.existsSync(dbFile)) {
    console.error('Database file not found. Aborting.')
    process.exit(1)
  }

  if (apply && !noBackup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `${dbFile}.bak-bin-balances-${stamp}`
    fs.copyFileSync(dbFile, backupPath)
    console.log(`Backup written: ${backupPath}`)
  }

  const db = knex(knexConfig)

  try {
    const productIds = await db('bin_cards').distinct('product_id').orderBy('product_id', 'asc')
    let productsTouched = 0
    let rowsChanged = 0
    const samples = []

    const work = async (trx) => {
      for (const { product_id: productId } of productIds) {
        const rows = await trx('bin_cards')
          .where({ product_id: productId })
          .orderBy('id', 'asc')
          .select('id', 'opening_balance', 'quantity_in', 'quantity_out', 'balance', 'document_no')

        if (rows.length === 0) continue

        let running = null
        let productChanged = false

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const qtyIn = int(row.quantity_in)
          const qtyOut = int(row.quantity_out)
          const opening = i === 0 ? int(row.opening_balance) : running
          const balance = opening + qtyIn - qtyOut

          const oldOpening = int(row.opening_balance)
          const oldBalance = int(row.balance)

          if (oldOpening !== opening || oldBalance !== balance) {
            productChanged = true
            rowsChanged += 1
            if (samples.length < 15) {
              samples.push({
                product_id: productId,
                id: row.id,
                document_no: row.document_no,
                opening: `${oldOpening} → ${opening}`,
                balance: `${oldBalance} → ${balance}`,
              })
            }
            if (apply) {
              await trx('bin_cards').where({ id: row.id }).update({
                opening_balance: opening,
                balance,
              })
            }
          }

          running = balance
        }

        if (productChanged) productsTouched += 1
      }
    }

    if (apply) {
      await db.transaction(work)
    } else {
      await work(db)
    }

    console.log(`Products with corrections: ${productsTouched}`)
    console.log(`Rows ${apply ? 'updated' : 'that would change'}: ${rowsChanged}`)
    if (samples.length) {
      console.log('Sample corrections:')
      for (const s of samples) {
        console.log(
          `  product=${s.product_id} id=${s.id} doc=${s.document_no || '-'} opening ${s.opening} balance ${s.balance}`
        )
      }
    }

    if (!apply) {
      console.log('\nDry-run complete. Re-run with --yes to apply.')
    } else {
      console.log('\nApply complete. Spot-check a previously stuck bin card in the app.')
    }
  } finally {
    await db.destroy()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
