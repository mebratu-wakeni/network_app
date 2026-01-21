import { Router } from 'express'
import testItems from '../modules/testItems/testItems.routes.js'
import auth from '../modules/auth/auth.routes.js'
import users from '../modules/users/users.routes.js'
import products from '../modules/inventory/products.routes.js'
import inventories from '../modules/inventory/inventories.routes.js'
import binCards from '../modules/inventory/binCards.routes.js'
import customers from '../modules/customers/customers.routes.js'

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
router.use('/products', products)
router.use('/inventories', inventories)
router.use('/bin-cards', binCards)
router.use('/customers', customers)

export default router

