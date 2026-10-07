import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import knex from './db/knex.js'
import v1Routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.js'
import { getUploadsRoot, ensureUploadDirs, migrateLegacyAvatarFiles } from './config/storagePaths.js'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Resolve masatech-admin static files for /admin.
 * Priority:
 *   1. ADMIN_STATIC_DIR env (explicit override on host)
 *   2. api/admin-dist (tarball layout — built into the package by pack script)
 *   3. ../../masatech-admin/dist (local monorepo checkout)
 */
function resolveAdminDistPath() {
  if (process.env.ADMIN_STATIC_DIR) {
    return path.resolve(process.env.ADMIN_STATIC_DIR)
  }
  const tarballPath = path.resolve(__dirname, '../admin-dist')
  if (fs.existsSync(path.join(tarballPath, 'index.html'))) {
    return tarballPath
  }
  return path.resolve(__dirname, '../../masatech-admin/dist')
}

const ADMIN_DIST_PATH = resolveAdminDistPath()

/**
 * Resolve public desktop downloads tree for /downloads/*.
 * Priority:
 *   1. DOWNLOADS_STATIC_DIR env (explicit override on host)
 *   2. ../../downloads (sibling of api/ — cPanel domain root layout)
 */
function resolveDownloadsPath() {
  if (process.env.DOWNLOADS_STATIC_DIR) {
    return path.resolve(process.env.DOWNLOADS_STATIC_DIR)
  }
  return path.resolve(__dirname, '../../downloads')
}

const DOWNLOADS_PATH = resolveDownloadsPath()

export function createApp() {
  const app = express()

  // Strict production origins allowed to speak to your API
  const allowedOrigins = [
    'app://local',                         // Packaged Electron app
    'https://server.masatechplc.com',      // Multi-tenant API + /admin
    'https://pharmasuit.mltplc.com',       // Legacy / other products
    'https://mltplc.com'
  ]

  // Inject any additional cloud origins defined inside cPanel's env dashboard
  if (process.env.FRONTEND_ORIGIN) {
    const origins = process.env.FRONTEND_ORIGIN.split(',').map(o => o.trim())
    allowedOrigins.push(...origins)
  }

  // Protocol-agnostic hostname match: a host reachable over both http and https
  // (common on cPanel before/without a forced SSL redirect) shouldn't 500 with
  // "Not allowed by CORS" just because the configured origin used the other scheme.
  const allowedHosts = allowedOrigins
    .map((o) => { try { return new URL(o).hostname } catch { return '' } })
    .filter(Boolean)

  const isDev = process.env.NODE_ENV !== 'production'

  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no Origin header (IPC fetch from main process, curl, health checks)
      if (!origin) return callback(null, true)

      // In development allow any localhost/127.0.0.1 origin (Vite dev server, browser testing)
      if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true)
      }

      // Match incoming production clients securely
      if (allowedOrigins.includes(origin)) return callback(null, true)

      // Also allow the other protocol (http/https) for an already-configured host
      try {
        if (allowedHosts.includes(new URL(origin).hostname)) return callback(null, true)
      } catch (_) {}

      callback(new Error('Not allowed by CORS'))
    },
    credentials: true, // Safeguards authentication cookies / session transmission
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }

  app.use(cors(corsOptions))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Standardize cloud file routing structure
  ensureUploadDirs()
  migrateLegacyAvatarFiles()
  app.use('/uploads', express.static(getUploadsRoot()))

  // Link database execution pool queries
  app.use((req, _res, next) => { req.knex = knex; next() })

  // Live health indicators
  app.get('/health', (_req, res) => res.json({ ok: true }))
  app.get('/api/db-health', async (_req, res, next) => {
    try {
      await knex.raw('select 1 as ok')
      res.json({ ok: true, database: 'online' })
    } catch (err) { next(err) }
  })

  // Core API Routes
  app.use('/api', v1Routes)

  // masatech-admin static SPA (see ADMIN_DIST_PATH note above).
  // Express 5 no longer accepts a bare '/admin/*' route pattern, so the SPA
  // fallback is a path-prefixed middleware (matched by prefix, not pathToRegexp)
  // rather than a app.get('/admin/*', ...) route.
  if (fs.existsSync(ADMIN_DIST_PATH)) {
    app.use('/admin', express.static(ADMIN_DIST_PATH))
    app.use('/admin', (_req, res, next) => {
      // Explicit error callback: sendFile() failures (e.g. index.html missing/
      // deleted after boot) must not become an unhandled rejection that crashes
      // the whole api process for an unrelated route.
      res.sendFile(path.join(ADMIN_DIST_PATH, 'index.html'), (err) => { if (err) next(err) })
    })
  }

  // Desktop installers + update feed (same host as API). Files live on disk at
  // server.masatechplc.com/downloads/ — not in public_html (this vhost is Node).
  if (fs.existsSync(DOWNLOADS_PATH)) {
    app.use('/downloads', express.static(DOWNLOADS_PATH, {
      index: ['index.html'],
      fallthrough: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.yml') || filePath.endsWith('.json')) {
          res.setHeader('Cache-Control', 'no-cache')
        }
      }
    }))
  }

  // Fail-safes
  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp