/**
 * Routes: System settings (admin-only for update)
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { SettingsRepository } from './settings.repository.js'
import { SettingsService } from './settings.service.js'
import { SettingsController } from './settings.controller.js'
import { validate, updateSettingsSchema } from './settings.schema.js'
import { authenticate, requireRules, requireTenant } from '../../middleware/auth.js'

const repository = new SettingsRepository(knex)
const service = new SettingsService(repository)
const controller = new SettingsController(service)

const router = Router()

router.use(authenticate, requireTenant)

router.get('/', controller.getSettings)
router.patch('/', requireRules(['CanEditSettings']), validate(updateSettingsSchema), controller.updateSettings)

export default router
