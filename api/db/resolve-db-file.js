/**
 * Canonical SQLite path for PharmaSuit Cloud Deployment.
 * Places data in a dedicated directory in the server profile space.
 */
import path from 'path'
import fs from 'fs'

export const DB_FILE_NAME = 'pharmasuit_lan.db'

/**
 * Resolved absolute path to pharmasuit_lan.db on the cloud.
 */
export function resolveDbFilePath() {
  // Priority 1: Check if an environment variable override is explicitly provided by cPanel
  const raw = process.env.DB_FILE
  if (raw != null && String(raw).trim() !== '') {
    return path.resolve(String(raw).trim())
  }

  // Priority 2: Standard cloud profile path
  // Resolves to: /home/mltplcpi/network-desktop-app/db/pharmasuit_lan.db
  // This lives completely outside the 'api' repository folder but stays grouped nicely!
  const defaultCloudDbPath = path.resolve(process.cwd(), '../db', DB_FILE_NAME)

  return defaultCloudDbPath
}

// Keep simple placeholders so imports in other files do not crash the compiler
export const APP_CONFIG_NAME = 'PharmaSuitLAN'
export function getSystemAppDataBase() { return process.cwd() }
export function getAppConfigRoot() { return process.cwd() }