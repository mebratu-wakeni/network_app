/**
 * Canonical SQLite path for PharmaSuit Cloud (single-tenant).
 *
 * Deploy (default): <repo>/db/pharmasuit_lan.db
 *   Same as the historical `path.resolve(process.cwd(), '../db', …)` when the
 *   server runs with cwd = api/. Resolved from this file so knex migrate/seed
 *   (which change cwd to api/db/) hit the same path as the running server.
 *
 * Local override: set DB_FILE in api/.env, e.g.
 *   DB_FILE=/absolute/path/to/api/db/pharmasuit_lan.db
 */
import path from 'path'
import { fileURLToPath } from 'url'

export const DB_FILE_NAME = 'pharmasuit_lan.db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/** api/ package root (parent of db/) */
const apiRoot = path.resolve(__dirname, '..')

/**
 * Resolved absolute path to pharmasuit_lan.db.
 */
export function resolveDbFilePath() {
  const raw = process.env.DB_FILE
  if (raw != null && String(raw).trim() !== '') {
    return path.resolve(String(raw).trim())
  }

  // Deploy / default: sibling of api/ → …/network-desktop-app/db/pharmasuit_lan.db
  return path.resolve(apiRoot, '..', 'db', DB_FILE_NAME)
}

// Keep simple placeholders so imports in other files do not crash the compiler
export const APP_CONFIG_NAME = 'PharmaSuitLAN'
export function getSystemAppDataBase() { return process.cwd() }
export function getAppConfigRoot() { return process.cwd() }
