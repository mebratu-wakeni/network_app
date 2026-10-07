/**
 * Routes: HTTP routing layer for purchases
 * Defines endpoints, applies middleware (auth, validation), and wires controllers.
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate, requireRules, requireTenant } from '../../middleware/auth.js'
import { PurchaseRepository } from './purchase.repository.js'
import { PurchaseService } from './purchase.service.js'
import { PurchaseController } from './purchase.controller.js'
import { validate, createPurchaseOrderSchema, payPurchaseOrderSchema, reversePurchaseOrderSchema, createHoldOrderSchema, importPurchasesSchema, importFromSpreadsheetSchema } from './purchase.schema.js'
import { CustomersRepository } from '../customers/customers.repository.js'
import { ProductsRepository } from '../inventory/products.repository.js'

// Initialize dependencies
const repository = new PurchaseRepository(knex)
const customersRepository = new CustomersRepository(knex)
const productsRepository = new ProductsRepository(knex)
const service = new PurchaseService(repository, {
  customersRepository,
  productsRepository
})
const controller = new PurchaseController(service)

const router = Router()

// All purchase routes require authentication and tenant context
router.use(authenticate, requireTenant)

/**
 * Section 1: Lookup / settings
 */
router.get(
  '/products',
  requireRules(['CanCreatePurchase']),
  controller.getProducts
)

router.get(
  '/suppliers',
  requireRules(['CanCreatePurchase']),
  controller.getSuppliers
)

router.get(
  '/settings/withhold-percentage',
  requireRules(['CanCreatePurchase']),
  controller.getWithholdPercentage
)

router.get(
  '/export',
  requireRules(['CanSeePurchase']),
  controller.exportPurchaseOrder
)

/**
 * Section 2: Purchase orders
 */
router.post(
  '/orders',
  requireRules(['CanCreatePurchase']),
  validate(createPurchaseOrderSchema),
  controller.createOrder
)

router.get(
  '/orders',
  requireRules(['CanSeePurchase']),
  controller.listOrders
)

router.get(
  '/orders/:id',
  requireRules(['CanSeePurchase']),
  controller.getOrderDetails
)

router.get(
  '/orders/:id/receipt',
  requireRules(['CanSeePurchase']),
  controller.getOrderReceipt
)

// Placeholder for editing purchase order – implementation can be extended later
router.put(
  '/orders/:id',
  requireRules(['CanEditPurchase']),
  controller.getOrderDetails // TODO: replace with real edit implementation
)

router.post(
  '/orders/:id/reverse',
  requireRules(['CanReversePurchase']),
  validate(reversePurchaseOrderSchema),
  controller.reverseOrder
)

router.post(
  '/orders/:id/pay',
  requireRules(['CanPayPurchase']),
  validate(payPurchaseOrderSchema),
  controller.payOrder
)

/**
 * Section 3: Hold orders
 */
router.post(
  '/hold-orders',
  requireRules(['CanHoldPurchase']),
  validate(createHoldOrderSchema),
  controller.createHoldOrder
)

router.get(
  '/hold-orders',
  requireRules(['CanHoldPurchase']),
  controller.listHoldOrders
)

router.get(
  '/hold-orders/:id',
  requireRules(['CanHoldPurchase']),
  controller.getHoldOrder
)

router.delete(
  '/hold-orders/:id',
  requireRules(['CanHoldPurchase']),
  controller.archiveHoldOrder
)

/**
 * Section 4: Bulk import purchases
 */
router.post(
  '/import',
  requireRules(['CanImportPurchase']),
  validate(importPurchasesSchema),
  controller.bulkImport
)

router.post(
  '/import-from-spreadsheet',
  requireRules(['CanImportPurchase']),
  validate(importFromSpreadsheetSchema),
  controller.importFromSpreadsheet
)

/**
 * Section 5: Receipt management
 */
router.get(
  '/receipts',
  requireRules(['CanSeePurchase']),
  controller.listReceipts
)

router.get(
  '/receipts/:receipt_no',
  requireRules(['CanSeePurchase']),
  controller.getReceiptByNo
)

router.post(
  '/receipts/:id/void',
  requireRules(['CanReversePurchase']),
  controller.voidReceipt
)

/**
 * Section 6: Stats & payment history
 */
router.get(
  '/stats',
  requireRules(['CanSeePurchase']),
  controller.getStats
)

router.get(
  '/orders/:id/payments',
  requireRules(['CanSeePurchase']),
  controller.getPaymentHistory
)

export default router

