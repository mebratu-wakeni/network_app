import { Router } from 'express'
import testItems from '../modules/testItems/testItems.routes.js'
import auth from '../modules/auth/auth.routes.js'
import users from '../modules/users/users.routes.js'

const router = Router()

router.get('/health', (_req, res) => res.json({ ok: true }))
router.get('/db-health', async (_req, res, next) => {
  try {
    // Defer to app-level handler that attached knex on req? For now, handled in app.
    res.status(501).json({ ok: false, error: 'Not Implemented' })
  } catch (err) { next(err) }
})

// Public auth routes
router.use('/auth', auth)

// Protected routes
router.use('/test-items', testItems)
router.use('/users', users)

export default router

