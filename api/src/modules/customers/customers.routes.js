/**
 * Routes: HTTP routing layer for customers
 * Defines endpoints, applies middleware (auth, validation), and wires controllers
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate, requireRules } from '../../middleware/auth.js'
import { uploadCsvFile } from '../../middleware/uploadCsv.js'
import { CustomersRepository } from './customers.repository.js'
import { CustomersService } from './customers.service.js'
import { CustomersController } from './customers.controller.js'
import {
  validate,
  validateParams,
  createCustomerSchema,
  updateCustomerSchema,
  bulkImportCustomersSchema,
  idParamSchema
} from './customers.schema.js'

// Initialize dependencies (Dependency Injection pattern)
const repository = new CustomersRepository(knex)
const service = new CustomersService(repository)
const controller = new CustomersController(service)

const router = Router()

// All routes require authentication
router.use(authenticate)

// Get all customers - requires CanSeeCustomers rule
router.get(
  '/',
  requireRules(['CanSeeCustomers']),
  controller.list
)

// Export customers to CSV - requires CanExportCustomers rule
router.get(
  '/export',
  requireRules(['CanExportCustomers']),
  controller.export
)

// Get a single customer - requires CanSeeCustomers rule
router.get(
  '/:id',
  requireRules(['CanSeeCustomers']),
  validateParams(idParamSchema),
  controller.getOne
)

// Create a new customer - requires CanAddCustomer rule
router.post(
  '/',
  requireRules(['CanAddCustomer']),
  validate(createCustomerSchema),
  controller.create
)

// Bulk import customers (JSON body) - requires CanImportCustomers rule
router.post(
  '/bulk-import',
  requireRules(['CanImportCustomers']),
  validate(bulkImportCustomersSchema),
  controller.bulkImport
)

// Bulk import customers (multipart CSV) — same rules; server parses file
router.post(
  '/bulk-import-upload',
  requireRules(['CanImportCustomers']),
  uploadCsvFile,
  controller.bulkImportUpload
)

// Update a customer - requires CanEditCustomer rule
router.put(
  '/:id',
  requireRules(['CanEditCustomer']),
  validateParams(idParamSchema),
  validate(updateCustomerSchema),
  controller.update
)

// Delete a customer - requires CanDeleteCustomer rule
router.delete(
  '/:id',
  requireRules(['CanDeleteCustomer']),
  validateParams(idParamSchema),
  controller.delete
)

export default router
