/**
 * Routes: HTTP routing layer for inventories/stock
 * Defines endpoints, applies middleware (auth, validation), and wires controllers
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate, requireRules } from '../../middleware/auth.js'
import { InventoriesRepository } from './inventories.repository.js'
import { InventoriesService } from './inventories.service.js'
import { InventoriesController } from './inventories.controller.js'
import { validate, bulkImportStockSchema, updateStockItemSchema, adjustStockItemSchema, borrowFromStockSchema } from './inventories.schema.js'

// Initialize dependencies (Dependency Injection pattern)
const repository = new InventoriesRepository(knex)
const service = new InventoriesService(repository)
const controller = new InventoriesController(service)

const router = Router()

// All routes require authentication
router.use(authenticate)

// List stock/inventories - requires CanSeeStockItemDetails rule
router.post('/', controller.list)

// Bulk import stock - requires CanImportStock rule
router.post(
  '/bulk-import',
  requireRules(['CanImportStock']),
  validate(bulkImportStockSchema),
  controller.bulkImport
)

// Export stock to CSV - requires CanExportStock rule (or CanSeeStockItemDetails)
router.get(
  '/export',
  requireRules(['CanSeeStockItemDetails']),
  controller.export
)

// Update stock item - requires CanEditStockItemDetails or CanEditStockItemPrice (checked in controller)
router.put(
  '/:id',
  validate(updateStockItemSchema),
  controller.update
)

// Adjust stock quantity - requires CanAdjustStockItemQuantities rule
router.post(
  '/:id/adjust',
  requireRules(['CanAdjustStockItemQuantities']),
  validate(adjustStockItemSchema),
  controller.adjust
)

// Create borrow from inventory - requires CanReceiveBorrowedFromStock rule
router.post(
  '/borrow-from',
  requireRules(['CanReceiveBorrowedFromStock']),
  validate(borrowFromStockSchema),
  controller.borrowFrom
)

export default router
