/**
 * Canonical SQLite path for PharmaSuitLAN (CLI, knex, scripts).
 * Matches app/electron/main.js: user / system app data, not the repo tree.
 *
 * Order:
 * 1. DB_FILE env (non-empty) — explicit override
 * 2. bootstrap.json → dataDirectory / pharmasuit_lan.db
 * 3. runtime-config.json (server.dbFile) under data/ or app config root
 * 4. <AppConfig>/data/pharmasuit_lan.db
 */
import path from 'path'
import fs from 'fs'
import os from 'os'

export const APP_CONFIG_NAME = 'PharmaSuitLAN'
export const DB_FILE_NAME = 'pharmasuit_lan.db'

/** Same basis as Electron app.getPath('appData'). */
export function getSystemAppDataBase () {
  const home = os.homedir()
  if (process.platform === 'darwin') {
    return path.join(home, 'Library/Application Support')
  }
  if (process.platform === 'win32') {
    return process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
  }
  return process.env.XDG_CONFIG_HOME || path.join(home, '.config')
}

/** e.g. ~/Library/Application Support/PharmaSuitLAN */
export function getAppConfigRoot () {
  return path.join(getSystemAppDataBase(), APP_CONFIG_NAME)
}

function readJsonSafe (filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function dbFileFromRuntimeConfig (cfg) {
  const dbFile = cfg?.server?.dbFile || cfg?.profiles?.server?.server?.dbFile
  if (typeof dbFile !== 'string' || !dbFile.trim()) return null
  const resolved = path.resolve(dbFile.trim())
  return resolved
}

/**
 * Resolved absolute path to pharmasuit_lan.db.
 * Uses process.env.DB_FILE when set and non-whitespace; otherwise system defaults above.
 */
export function resolveDbFilePath () {
  const raw = process.env.DB_FILE
  if (raw != null && String(raw).trim() !== '') {
    return path.resolve(String(raw).trim())
  }

  const appRoot = getAppConfigRoot()

  const boot = readJsonSafe(path.join(appRoot, 'bootstrap.json'))
  const dataDir = boot?.dataDirectory
  if (typeof dataDir === 'string' && dataDir.trim()) {
    return path.resolve(dataDir.trim(), DB_FILE_NAME)
  }

  const cfgCandidates = [
    path.join(appRoot, 'data', 'runtime-config.json'),
    path.join(appRoot, 'runtime-config.json')
  ]
  for (const p of cfgCandidates) {
    const cfg = readJsonSafe(p)
    const f = cfg && dbFileFromRuntimeConfig(cfg)
    if (f) return f
  }

  return path.join(appRoot, 'data', DB_FILE_NAME)
}
