import express from 'express'
import dotenv from 'dotenv'
import cors from  'cors'
import knex from './db/knex.js'
import v1Routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.js'
import { serverIP } from './detectIp.js'
import { getUploadsRoot, ensureUploadDirs, migrateLegacyAvatarFiles } from './config/storagePaths.js'

dotenv.config()

export function createApp() {
  const app = express()

  // CORS configuration for LAN network access
  // Allow requests from localhost, LAN IP, and configured frontend origin
  const allowedOrigins = []
  
  // Add localhost origins
  allowedOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173')
  // Electron packaged app uses app:// protocol (custom scheme)
  allowedOrigins.push('app://local')
  
  // Add LAN IP origins (common Electron/desktop app ports)
  if (serverIP && serverIP !== '127.0.0.1') {
    allowedOrigins.push(
      `http://${serverIP}:5173`,
      `http://${serverIP}:3000`,
      `http://${serverIP}:5174`
    )
  }
  
  // Add configured frontend origin from environment
  if (process.env.FRONTEND_ORIGIN) {
    const origins = process.env.FRONTEND_ORIGIN.split(',').map(o => o.trim())
    allowedOrigins.push(...origins)
  }

  // In development, be more permissive (allow all LAN access)
  // In production, you should restrict to specific origins
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) return callback(null, true)
      
      // In development, allow all LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      if (process.env.NODE_ENV !== 'production') {
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1')
        const isLAN = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin)
        
        if (isLocalhost || isLAN || allowedOrigins.includes(origin)) {
          return callback(null, true)
        }
      }
      
      // In production, only allow specific origins
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true, // Allow cookies/auth headers
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }

  app.use(cors(corsOptions))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Serve static files (avatars) from writable dir next to SQLite DB (see storagePaths.js)
  ensureUploadDirs()
  migrateLegacyAvatarFiles()
  app.use('/uploads', express.static(getUploadsRoot()))

  // Attach knex instance to req if needed by middlewares/controllers
  app.use((req, _res, next) => { req.knex = knex; next() })

  // Health checks
  app.get('/health', (_req, res) => res.json({ ok: true }))
  app.get('/api/db-health', async (_req, res, next) => {
    try {
      await knex.raw('select 1 as ok')
      res.json({ ok: true, database: 'online' })
    } catch (err) { next(err) }
  })

  // API v1
  app.use('/api', v1Routes)

  // 404 + error handling
  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp

