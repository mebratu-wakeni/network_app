import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || 'db/license.db')
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const migrationsDir = path.resolve(__dirname, 'migrations')
const seedsDir      = path.resolve(__dirname, 'seeds')

/**
 * Filters out macOS resource-fork ghost files (._*) created when zipping on
 * macOS and extracted on a Linux server (e.g. cPanel). Knex would otherwise
 * try to execute their binary content as JavaScript and crash.
 */
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

class FilteredSeedSource {
  getSeedFiles(loadExtensions) {
    const files = fs.readdirSync(seedsDir)
      .filter(f => !f.startsWith('._') && loadExtensions.some(ext => f.endsWith(ext)))
      .sort()
    return Promise.resolve(files)
  }
  getSeedFile(file) {
    return import(path.join(seedsDir, file))
  }
}

const config = {
  client: 'sqlite3',
  connection: { filename: dbPath },
  useNullAsDefault: true,
  migrations: {
    migrationSource: new FilteredMigrationSource(),
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: seedsDir,
    seedSource: new FilteredSeedSource()
  }
}

export default config
