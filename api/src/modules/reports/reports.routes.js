/**
 * Reports routes: financial statements
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate } from '../../middleware/auth.js'
import { ReportsRepository } from './reports.repository.js'
import { ReportsService } from './reports.service.js'
import { ReportsController } from './reports.controller.js'

const repository = new ReportsRepository(knex)
const service = new ReportsService(repository)
const controller = new ReportsController(service)

const router = Router()
router.use(authenticate)

router.get('/income-statement', controller.getIncomeStatement)
router.get('/balance-sheet', controller.getBalanceSheet)
router.get('/cash-flow', controller.getCashFlow)
router.get('/equity', controller.getStatementOfChangesInEquity)

export default router
