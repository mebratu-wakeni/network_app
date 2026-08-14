/**
 * Low-memory migration runner for cPanel / CloudLinux hosts where
 * `npm run migrate` OOMs (dotenv v17 + Wasm). Uses only process.env —
 * set DB_* vars in the Node.js App panel before running:
 *   node scripts/migrate-lite.mjs
 */
import knex from 'knex'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(__dirname, '../db/migrations')

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

class FilteredMigrationSource {
  getMigrations(loadExtensions) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => !f.startsWith('._') && loadExtensions.some(ext => f.endsWith(ext)))
      .sort()
    return Promise.resolve(files)
  }
  getMigrationName(migration) { return migration }
  getMigration(migration) {
    return import(path.join(migrationsDir, migration))
  }
}

const db = knex({
  client: 'pg',
  connection: resolveConnection(),
  pool: { min: 0, max: 2 },
  migrations: {
    migrationSource: new FilteredMigrationSource(),
    tableName: 'knex_migrations',
  },
})

try {
  const [batch, log] = await db.migrate.latest()
  if (!log.length) {
    console.log('Already up to date.')
  } else {
    console.log(`Batch ${batch} ran ${log.length} migration(s):`)
    for (const name of log) console.log('  -', name)
  }
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
} finally {
  await db.destroy()
}
