/**
 * Routes: Sales module — orders, hold orders, pay, withhold confirm/rollback, reverse.
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate, requireRules, requireAnyRule } from '../../middleware/auth.js'
import { SalesRepository } from './sales.repository.js'
import { SalesService } from './sales.service.js'
import { SalesController } from './sales.controller.js'
import {
  validate,
  createSalesOrderSchema,
  paySalesOrderSchema,
  confirmWithholdSchema,
  reverseSalesOrderSchema,
  createHoldOrderSchema
} from './sales.schema.js'

const repository = new SalesRepository(knex)
const service = new SalesService(repository)
const controller = new SalesController(service)

const router = Router()
router.use(authenticate)

router.get('/settings/withhold-percentage', requireAnyRule(['CanCreateSale', 'CanSeeSale']), controller.getWithholdPercentage)

router.post('/orders', requireRules(['CanCreateSale']), validate(createSalesOrderSchema), controller.createOrder)
router.get('/orders', requireRules(['CanSeeSale']), controller.listOrders)
router.get('/orders/export', requireRules(['CanSeeSale']), controller.exportSalesOrder)
router.get('/orders/:id', requireRules(['CanSeeSale']), controller.getOrderDetails)
router.get('/orders/:id/receipt', requireRules(['CanSeeSale']), controller.getOrderReceipt)
router.post('/orders/:id/pay', requireRules(['CanSeeSale']), validate(paySalesOrderSchema), controller.payOrder)
router.patch('/orders/:id/withhold-confirmation', requireRules(['CanSeeSale']), validate(confirmWithholdSchema), controller.confirmWithhold)
router.patch('/orders/:id/withhold-rollback', requireRules(['CanSeeSale']), controller.rollbackWithhold)
router.post('/orders/:id/reverse', requireRules(['CanSeeSale']), validate(reverseSalesOrderSchema), controller.reverseOrder)

router.post('/hold-orders', requireRules(['CanCreateSale']), validate(createHoldOrderSchema), controller.createHoldOrder)
router.get('/hold-orders', requireRules(['CanSeeSale']), controller.listHoldOrders)
router.get('/hold-orders/:id', requireRules(['CanSeeSale']), controller.getHoldOrder)
router.delete('/hold-orders/:id', requireRules(['CanSeeSale']), controller.archiveHoldOrder)

export default router
