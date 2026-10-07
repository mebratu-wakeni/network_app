import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './modules/auth/auth.routes.js'
import licenseRoutes from './modules/licenses/licenses.routes.js'
import compatRoutes from './routes/compat.routes.js'
import { notFound, errorHandler } from './middleware/error.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config()

export function createApp() {
  const app = express()

  // CORS
  const rawOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const isDev = process.env.NODE_ENV !== 'production'

  // Collect allowed hostnames (protocol-agnostic) from ALLOWED_ORIGINS
  const allowedHosts = rawOrigins.map(o => { try { return new URL(o).hostname } catch { return '' } }).filter(Boolean)

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)                         // server-to-server / curl
      if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true)
      if (rawOrigins.includes(origin)) return callback(null, true)
      // Also allow http:// variant of any configured origin (same host, different protocol)
      try { if (allowedHosts.includes(new URL(origin).hostname)) return callback(null, true) } catch (_) {}
      callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }))

  app.use(express.json())

  // Health
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'license-api' }))

  // Google Apps Script drop-in: POST / (same URL the PharmaSuit LAN API calls)
  app.use('/', compatRoutes)

  // Admin API routes
  app.use('/auth', authRoutes)
  app.use('/license', licenseRoutes)

  // Serve the license-admin React SPA for all GET requests not matched above.
  // In production the built files live one level up in ../license-admin/dist.
  // Override with ADMIN_STATIC_DIR env var if your deploy puts them elsewhere.
  const staticDir = process.env.ADMIN_STATIC_DIR
    || path.resolve(__dirname, '../../license-admin/dist')
  app.use(express.static(staticDir))
  // SPA fallback — serve index.html for any unmatched GET (React Router handles routing)
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(path.join(staticDir, 'index.html'), (err) => {
      if (err) next() // fall through to notFound / errorHandler
    })
  })

  // Fallbacks
  app.use(notFound)
  app.use(errorHandler)

  return app
}
