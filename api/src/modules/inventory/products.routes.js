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
import { validate, bulkImportProductsSchema, createCategorySchema, createUnitSchema, createProductSchema } from './products.schema.js'
import { z } from 'zod'

// Schema for updating a product (all fields optional except validation structure)
const updateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').trim().optional(),
  description: z.string().trim().optional().nullable(),
  category_id: z.number().int().positive('Category ID is required').optional(),
  unit_id: z.number().int().positive('Unit ID is required').optional(),
  remark: z.string().trim().optional().nullable(),
  expiry_threshold: z.number().int().positive('Expiry threshold must be a positive number').optional()
})

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

// Export products to CSV - requires CanExportProducts rule
router.get(
  '/export',
  requireRules(['CanExportProducts']),
  controller.export
)

// Create category - requires CanAddProduct rule (or can create separate rule)
router.post(
  '/categories',
  requireRules(['CanAddProduct']),
  validate(createCategorySchema),
  controller.createCategory
)

// Create unit - requires CanAddProduct rule (or can create separate rule)
router.post(
  '/units',
  requireRules(['CanAddProduct']),
  validate(createUnitSchema),
  controller.createUnit
)

// Get all categories - requires CanAddProduct rule
router.get(
  '/categories',
  requireRules(['CanAddProduct']),
  controller.getAllCategories
)

// Find category by name - requires CanAddProduct rule
router.get(
  '/categories/:name',
  requireRules(['CanAddProduct']),
  controller.findCategoryByName
)

// Get all units - requires CanAddProduct rule
router.get(
  '/units',
  requireRules(['CanAddProduct']),
  controller.getAllUnits
)

// Find unit by name - requires CanAddProduct rule
router.get(
  '/units/:name',
  requireRules(['CanAddProduct']),
  controller.findUnitByName
)

// Create product - requires CanAddProduct rule
router.post(
  '/create',
  requireRules(['CanAddProduct']),
  validate(createProductSchema),
  controller.createProduct
)

// Update product - requires CanEditProductDetails rule
router.put(
  '/:id',
  requireRules(['CanEditProductDetails']),
  validate(updateProductSchema),
  controller.updateProduct
)

// Delete product - requires CanEditProductDetails rule (or can create separate CanDeleteProduct rule)
router.delete(
  '/:id',
  requireRules(['CanEditProductDetails']),
  controller.deleteProduct
)

export default router
