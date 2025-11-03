import { Router } from 'express'
import testItems from './testItems.routes.js'

const router = Router()

router.get('/health', (_req, res) => res.json({ ok: true }))
router.get('/db-health', async (_req, res, next) => {
  try {
    // Defer to app-level handler that attached knex on req? For now, handled in app.
    res.status(501).json({ ok: false, error: 'Not Implemented' })
  } catch (err) { next(err) }
})

router.use('/test-items', testItems)

export default router

