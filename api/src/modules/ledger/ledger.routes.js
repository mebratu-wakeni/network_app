/**
 * Routes: Ledger (current account balances for dashboard)
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { LedgerController } from './ledger.controller.js'
import { authenticate, requireTenant } from '../../middleware/auth.js'

const controller = new LedgerController(knex)
const router = Router()

router.use(authenticate, requireTenant)
router.get('/balances', controller.getBalances)

export default router
