/**
 * Google Apps Script compatibility endpoint.
 *
 * The PharmaSuit LAN API (api/src/modules/license/license.service.js) sends:
 *
 *   POST <LICENSE_SCRIPT_URL>
 *   Content-Type: text/plain;charset=utf-8          ← NOT application/json
 *   Body (JSON-stringified):
 *     { action, licenseKey, machineFingerprint, companyName, companyPhone,
 *       companyEmail, companyTin, installationKey }
 *
 * And expects back:
 *   { status: 'success',
 *     data: { licenseKey, licenseType, status, startDate, endDate,
 *             companyName, companyPhone, companyEmail, companyTin,
 *             machineFingerprint, activatedAt },
 *     code: 'ACTIVATED_OR_REVALIDATED' }
 *
 *   OR on error:
 *   { status: 'error', message: '...', code: '...' }
 *
 * Setting LICENSE_SCRIPT_URL=https://admin.mltplc.com in the PharmaSuit API's
 * .env is all that is needed — no code changes required.
 */

import { Router } from 'express'
import express from 'express'
import knex from '../db/knex.js'
import { LicensesRepository } from '../modules/licenses/licenses.repository.js'
import { LicensesService } from '../modules/licenses/licenses.service.js'

const repository = new LicensesRepository(knex)
const service = new LicensesService(repository)
const router = Router()

/**
 * Parse the body regardless of whether it arrived as application/json
 * or text/plain (the Google Script workaround used by Electron to avoid
 * CORS preflight).  Route-level text parser runs after the global
 * express.json() has already skipped text/plain bodies.
 */
const textParser = express.text({ type: 'text/plain' })

router.post('/', textParser, async (req, res) => {
  // Parse body — may already be an object (application/json) or a string (text/plain)
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch {
      return res.status(400).json({
        status: 'error', message: 'Invalid JSON body.', code: 'INVALID_REQUEST'
      })
    }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      status: 'error', message: 'Request body is required.', code: 'INVALID_REQUEST'
    })
  }

  const {
    action,
    licenseKey,
    machineFingerprint,
    companyName = '',
    companyPhone = '',
    companyEmail = '',
    companyTin = ''
  } = body

  if (action !== 'activate') {
    return res.status(400).json({
      status: 'error',
      message: `Unknown action: "${action}". Only "activate" is supported.`,
      code: 'UNKNOWN_ACTION'
    })
  }

  try {
    const result = await service.activate({
      license_key: licenseKey,
      device_fingerprint: machineFingerprint,
      device_name: null,
      company_name: companyName,
      company_phone: companyPhone
    })

    const lic = result.license

    return res.json({
      status: 'success',
      data: {
        licenseKey: lic.license_key,
        licenseType: lic.subscription_type,   // 'monthly' | 'yearly' | 'lifetime'
        status: 'active',
        startDate: lic.start_date || null,
        endDate: lic.expires_at || null,       // null for lifetime
        companyName,
        companyPhone,
        companyEmail,
        companyTin,
        machineFingerprint,
        activatedAt: new Date().toISOString()
      },
      code: 'ACTIVATED_OR_REVALIDATED'
    })
  } catch (err) {
    // Map to Google Script error format so parseScriptResponse() can read it
    return res.status(err.status || 500).json({
      status: 'error',
      message: err.message || 'License activation failed.',
      code: (err.code || 'ACTIVATION_FAILED').toUpperCase()
    })
  }
})

export default router
