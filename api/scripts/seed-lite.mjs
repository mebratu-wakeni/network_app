/**
 * Low-memory seed runner for cPanel / CloudLinux (same rationale as migrate-lite.mjs).
 *   node scripts/seed-lite.mjs
 */
import knex from 'knex'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const seedsDir = path.resolve(__dirname, '../db/seeds')

function resolveConnection() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim()
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  }
}

class FilteredSeedSource {
  getSeeds(config) {
    const loadExtensions = config.loadExtensions || ['.js']
    const files = fs.readdirSync(seedsDir)
      .filter(f => !f.startsWith('._') && loadExtensions.some(ext => f.endsWith(ext)))
      .sort()
      .map(f => path.join(seedsDir, f))
    return Promise.resolve(files)
  }
  getSeed(filepath) {
    return import(filepath)
  }
}

const db = knex({
  client: 'pg',
  connection: resolveConnection(),
  pool: { min: 0, max: 2 },
  seeds: { seedSource: new FilteredSeedSource() },
})

try {
  const names = await db.seed.run()
  console.log('Seeds completed:', names.flat())
} catch (err) {
  console.error('Seed failed:', err.message)
  process.exit(1)
} finally {
  await db.destroy()
}
