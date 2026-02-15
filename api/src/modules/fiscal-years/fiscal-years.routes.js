/**
 * Fiscal years routes
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate } from '../../middleware/auth.js'
import { FiscalYearsRepository } from './fiscal-years.repository.js'
import { FiscalYearsService } from './fiscal-years.service.js'
import { FiscalYearsController } from './fiscal-years.controller.js'

const repository = new FiscalYearsRepository(knex)
const service = new FiscalYearsService(repository, knex)
const controller = new FiscalYearsController(service)

const router = Router()
router.use(authenticate)

router.get('/', controller.list)
router.get('/current', controller.getCurrent)
router.post('/', controller.create)
router.post('/:year/close', controller.close)
router.post('/:year/reopen', controller.reopen)
router.delete('/:year', controller.delete)
router.get('/:year/report', controller.getReport)

export default router
