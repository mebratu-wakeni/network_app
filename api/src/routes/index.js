import { Router } from 'express'
import testItems from '../modules/testItems/testItems.routes.js'
import auth from '../modules/auth/auth.routes.js'
import users from '../modules/users/users.routes.js'
import products from '../modules/inventory/products.routes.js'
import inventories from '../modules/inventory/inventories.routes.js'
import binCards from '../modules/inventory/binCards.routes.js'
import customers from '../modules/customers/customers.routes.js'
import purchases from '../modules/purchase/purchase.routes.js'
import sales from '../modules/sales/sales.routes.js'
import settings from '../modules/settings/settings.routes.js'
import ledger from '../modules/ledger/ledger.routes.js'
import financial from '../modules/financial/financial.routes.js'
import fiscalYears from '../modules/fiscal-years/fiscal-years.routes.js'
import reports from '../modules/reports/reports.routes.js'
import license from '../modules/license/license.routes.js'
import tenants from '../modules/tenants/tenants.routes.js'
import platformAdmin from '../modules/platformAdmins/platformAdmins.routes.js'

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
router.use('/license', license)

// Platform admin (super-admin) auth -- login/change-password for the masatech-admin panel
router.use('/platform-admin', platformAdmin)

// Platform admin routes (gated by requirePlatformAdminAuth JWT, not tenant-scoped -- see tenants.routes.js)
router.use('/tenants', tenants)

// Protected routes
router.use('/test-items', testItems)
router.use('/users', users)
router.use('/products', products)
router.use('/inventories', inventories)
router.use('/bin-cards', binCards)
router.use('/customers', customers)
router.use('/purchases', purchases)
router.use('/sales', sales)
router.use('/settings', settings)
router.use('/ledger', ledger)
router.use('/financial', financial)
router.use('/fiscal-years', fiscalYears)
router.use('/reports', reports)

export default router

