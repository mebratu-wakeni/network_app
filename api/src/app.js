import express from 'express'
import dotenv from 'dotenv'
import knex from './db/knex.js'
import v1Routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.js'

dotenv.config()

export function createApp() {
  const app = express()

  app.use(express.json())

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

