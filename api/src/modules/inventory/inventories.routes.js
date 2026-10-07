/**
 * Routes: HTTP routing layer for inventories/stock
 * Defines endpoints, applies middleware (auth, validation), and wires controllers
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate, requireRules, requireTenant } from '../../middleware/auth.js'
import { InventoriesRepository } from './inventories.repository.js'
import { InventoriesService } from './inventories.service.js'
import { InventoriesController } from './inventories.controller.js'
import { validate, bulkImportStockSchema, updateStockItemSchema, adjustStockItemSchema, borrowFromStockSchema, returnBorrowedToStockSchema, returnBorrowedFromStockSchema } from './inventories.schema.js'
import { uploadCsvFile } from '../../middleware/uploadCsv.js'

// Initialize dependencies (Dependency Injection pattern)
const repository = new InventoriesRepository(knex)
const service = new InventoriesService(repository)
const controller = new InventoriesController(service)

const router = Router()

// All routes require authentication and tenant context
router.use(authenticate, requireTenant)

// List stock/inventories - requires CanSeeStockItemDetails rule
router.post('/', controller.list)

router.post(
  '/bulk-import-upload',
  requireRules(['CanImportStock']),
  uploadCsvFile,
  controller.bulkImportUpload
)

// Bulk import stock - requires CanImportStock rule
router.post(
  '/bulk-import',
  requireRules(['CanImportStock']),
  validate(bulkImportStockSchema),
  controller.bulkImport
)

// Inventories by product (for return-borrowed drawer, etc.) — before /:id
router.get(
  '/by-product/:productId',
  requireRules(['CanSeeStockItemDetails']),
  controller.listByProduct
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

// Get return history for borrow to inventory - requires CanSeeStockItemDetails rule
router.get(
  '/borrow-to/:id/returns',
  requireRules(['CanSeeStockItemDetails']),
  controller.getBorrowToReturnHistory
)

// Process return of borrowed-to items - requires CanReturnBorrowedToStock rule
router.post(
  '/borrow-to/return',
  requireRules(['CanReturnBorrowedToStock']),
  validate(returnBorrowedToStockSchema),
  controller.processBorrowToReturn
)

// Get return status by inventory ID
router.get(
  '/borrow-from/:inventoryId/return-status',
  requireRules(['CanSeeStockItemDetails']),
  controller.getBorrowFromReturnStatus
)

// Get return status by borrow_from_inventories id (borrowed-from list rows)
router.get(
  '/borrow-from/by-borrow/:borrowFromId/return-status',
  requireRules(['CanSeeStockItemDetails']),
  controller.getBorrowFromReturnStatusByBorrowId
)

// Process return of borrowed-from items - requires CanReturnBorrowedFromStock rule
router.post(
  '/borrow-from/return',
  requireRules(['CanReturnBorrowedFromStock']),
  validate(returnBorrowedFromStockSchema),
  controller.processBorrowFromReturn
)

export default router
