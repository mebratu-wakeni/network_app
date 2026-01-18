/**
 * Routes: HTTP routing layer for products
 * Defines endpoints, applies middleware (auth, validation), and wires controllers
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate, requireRules } from '../../middleware/auth.js'
import { ProductsRepository } from './products.repository.js'
import { ProductsService } from './products.service.js'
import { ProductsController } from './products.controller.js'
import { validate, bulkImportProductsSchema } from './products.schema.js'

// Initialize dependencies (Dependency Injection pattern)
const repository = new ProductsRepository(knex)
const service = new ProductsService(repository)
const controller = new ProductsController(service)

const router = Router()

// All routes require authentication
router.use(authenticate)

// List products - requires CanSeeProductDetails rule (or can be adjusted based on your RBAC)
router.post('/', controller.list)

// Bulk import products - requires CanImportProducts rule
router.post(
  '/bulk-import',
  requireRules(['CanImportProducts']),
  validate(bulkImportProductsSchema),
  controller.bulkImport
)

export default router
