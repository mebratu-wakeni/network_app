import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'
import fs from 'fs'
import { resolveDbFilePath } from './resolve-db-file.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cloud target: Just pull the production .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const dbFile = resolveDbFilePath()

// Automatically creates the /db directory if it doesn't exist yet on the server
fs.mkdirSync(path.dirname(dbFile), { recursive: true })

const migrationsDir = path.resolve(__dirname, './migrations')
const seedsDir = path.resolve(__dirname, './seeds')

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

const config = {
  client: 'sqlite3',
  connection: {
    filename: dbFile,
  },
  useNullAsDefault: true,
  migrations: {
    migrationSource: new FilteredMigrationSource(),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: seedsDir,
  },
};

export default config;