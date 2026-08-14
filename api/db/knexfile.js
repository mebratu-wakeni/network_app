import path from 'path';
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// cPanel injects DB_* / DATABASE_URL via the Node.js App panel — loading dotenv
// there can OOM on CloudLinux (dotenv v17 + Wasm). Only read .env locally when unset.
if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
  const { default: dotenv } = await import('dotenv')
  dotenv.config({ path: path.resolve(__dirname, '../.env') })
}

const migrationsDir = path.resolve(__dirname, './migrations')
const seedsDir = path.resolve(__dirname, './seeds')

/**
 * Multi-tenant cloud deployment: always Postgres. Prefer a single DATABASE_URL
 * (matches most hosting providers incl. cPanel's Postgres), fall back to
 * discrete DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME vars for local dev.
 */
function resolveConnection() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    return process.env.DATABASE_URL.trim()
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'pharma_dev',
  }
}

/**
 * Filters out macOS resource-fork ghost files (._*) that get created when
 * zipping/uploading from macOS and extracted on a Linux server (e.g. cPanel).
 * Knex would otherwise try to execute them as JS and crash on their binary content.
 */
class FilteredMigrationSource {
  getMigrations(loadExtensions) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => !f.startsWith('._') && loadExtensions.some(ext => f.endsWith(ext)))
      .sort()
    return Promise.resolve(files)
  }

  getMigrationName(migration) {
    return migration
  }

  getMigration(migration) {
    return import(path.join(migrationsDir, migration))
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

const config = {
  client: 'pg',
  connection: resolveConnection(),
  pool: { min: 2, max: 10 },
  migrations: {
    migrationSource: new FilteredMigrationSource(),
    tableName: 'knex_migrations',
  },
  seeds: {
    seedSource: new FilteredSeedSource(),
  },
};

export default config;