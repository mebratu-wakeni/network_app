import path from 'path'
import fs from 'fs'
import knexConfig from '../../db/knexfile.js'

/** Resolved SQLite path (same as Knex uses). */
export function getSqliteFilePath () {
  return knexConfig.connection.filename
}

/**
 * Root directory for user-uploaded files, co-located with the DB file.
 * When DB_FILE points at userData (Electron), avatars survive updates and match the DB.
 */
export function getUploadsRoot () {
  if (process.env.UPLOADS_ROOT) {
    return path.resolve(process.env.UPLOADS_ROOT)
  }
  const dbPath = getSqliteFilePath()
  return path.join(path.dirname(dbPath), 'uploads')
}

export function getAvatarsDir () {
  return path.join(getUploadsRoot(), 'avatars')
}

/** Ensure upload dirs exist (idempotent). */
export function ensureUploadDirs () {
  fs.mkdirSync(getAvatarsDir(), { recursive: true })
}

/**
 * Copy avatar files from legacy dirs (cwd-relative uploads/) into the DB-adjacent folder
 * so existing installs keep images after moving storage next to SQLite.
 */
export function migrateLegacyAvatarFiles () {
  const dest = getAvatarsDir()
  if (!fs.existsSync(dest)) return
  const candidates = [
    path.join(process.cwd(), 'uploads', 'avatars'),
    path.resolve(process.cwd(), 'api', 'uploads', 'avatars')
  ]
  for (const src of candidates) {
    if (!fs.existsSync(src)) continue
    try {
      const names = fs.readdirSync(src)
      for (const name of names) {
        if (!name || name.startsWith('.')) continue
        const from = path.join(src, name)
        const to = path.join(dest, name)
        const st = fs.statSync(from)
        if (!st.isFile() || fs.existsSync(to)) continue
        fs.copyFileSync(from, to)
      }
    } catch (e) {
      console.warn('[storagePaths] legacy avatar migration skipped:', e.message)
    }
  }
}
