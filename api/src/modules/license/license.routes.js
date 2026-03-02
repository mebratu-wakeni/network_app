import { Router } from 'express'
import knex from '../../db/knex.js'
import { LicenseRepository } from './license.repository.js'
import { LicenseService } from './license.service.js'
import { LicenseController } from './license.controller.js'
import { activateLicenseSchema, validate } from './license.schema.js'
import { SettingsRepository } from '../settings/settings.repository.js'

const licenseRepository = new LicenseRepository(knex)
const settingsRepository = new SettingsRepository(knex)
const service = new LicenseService(licenseRepository, settingsRepository)
const controller = new LicenseController(service)

const router = Router()

// Public endpoints: required before auth/setup is completed.
router.get('/status', controller.status)
router.post('/status', controller.status)
router.post('/activate', validate(activateLicenseSchema), controller.activate)

export default router

