import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate } from '../../middleware/auth.js'
import { LicensesRepository } from './licenses.repository.js'
import { LicensesService } from './licenses.service.js'

const repository = new LicensesRepository(knex)
const service = new LicensesService(repository)
const router = Router()

// ── Public endpoints (no auth) ──────────────────────────────────────────────

/**
 * GET /license/status?license_key=PHRM-XXXX-XXXX-XXXX&device_fingerprint=abc
 * Called by products to verify a license on startup or periodically.
 */
router.get('/status', async (req, res, next) => {
  try {
    const { license_key, device_fingerprint } = req.query
    const result = await service.checkStatus(license_key, device_fingerprint)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /license/activate
 * Body: { license_key, device_fingerprint, device_name?, company_name, company_phone }
 * Called once per installation to activate on a device.
 */
router.post('/activate', async (req, res, next) => {
  try {
    const result = await service.activate(req.body)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// ── Admin endpoints (require JWT) ───────────────────────────────────────────

/** GET /license/admin/list?search=&status= */
router.get('/admin/list', authenticate, async (req, res, next) => {
  try {
    const { search, status } = req.query
    const licenses = await service.list({ search, status })
    res.json({ success: true, licenses })
  } catch (err) {
    next(err)
  }
})

/** GET /license/admin/:id */
router.get('/admin/:id', authenticate, async (req, res, next) => {
  try {
    const license = await service.getById(Number(req.params.id))
    res.json({ success: true, license })
  } catch (err) {
    next(err)
  }
})

/** POST /license/admin — create new license */
router.post('/admin', authenticate, async (req, res, next) => {
  try {
    const { customer_name, email, subscription_type, start_date, notes } = req.body
    const license = await service.create({ customer_name, email, subscription_type, start_date, notes }, req.admin?.sub)
    res.status(201).json({ success: true, license })
  } catch (err) {
    next(err)
  }
})

/** PATCH /license/admin/:id/revoke */
router.patch('/admin/:id/revoke', authenticate, async (req, res, next) => {
  try {
    const license = await service.revoke(Number(req.params.id))
    res.json({ success: true, license })
  } catch (err) {
    next(err)
  }
})

/** PATCH /license/admin/:id/reactivate */
router.patch('/admin/:id/reactivate', authenticate, async (req, res, next) => {
  try {
    const license = await service.reactivate(Number(req.params.id))
    res.json({ success: true, license })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /license/admin/:id/reset-activation
 * Deactivates all device activations so the customer can activate on a new machine.
 */
router.patch('/admin/:id/reset-activation', authenticate, async (req, res, next) => {
  try {
    const result = await service.resetActivation(Number(req.params.id))
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

export default router
