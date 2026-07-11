import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import knex from './db/knex.js'
import v1Routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.js'
import { getUploadsRoot, ensureUploadDirs, migrateLegacyAvatarFiles } from './config/storagePaths.js'

dotenv.config()

export function createApp() {
  const app = express()

  // Strict production origins allowed to speak to your API
  const allowedOrigins = [
    'app://local',                    // Packaged Electron app
    'https://pharmasuit.mltplc.com',  // API subdomain
    'https://mltplc.com'              // Main domain (kept for compatibility)
  ]

  // Inject any additional cloud origins defined inside cPanel's env dashboard
  if (process.env.FRONTEND_ORIGIN) {
    const origins = process.env.FRONTEND_ORIGIN.split(',').map(o => o.trim())
    allowedOrigins.push(...origins)
  }

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
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
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

  // Fail-safes
  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp