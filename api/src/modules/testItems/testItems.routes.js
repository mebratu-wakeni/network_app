/**
 * Routes: HTTP routing layer
 * Defines endpoints, applies middleware (auth, validation), and wires controllers
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate, requireRole } from '../../middleware/auth.js'
import { TestItemsRepository } from './testItems.repository.js'
import { TestItemsService } from './testItems.service.js'
import { TestItemsController } from './testItems.controller.js'
import {
  validate,
  validateParams,
  createTestItemSchema,
  updateTestItemSchema,
  idParamSchema
} from './testItems.schema.js'

// Initialize dependencies (Dependency Injection pattern)
const repository = new TestItemsRepository(knex)
const service = new TestItemsService(repository)
const controller = new TestItemsController(service)

const router = Router()

// All routes require authentication (JWT or x-role header for backward compatibility)
// Note: authenticate middleware is optional - requireRole handles backward compatibility
// For production, uncomment the line below to require JWT for all routes
// router.use(authenticate)

// Routes with RBAC and validation
router.get(
  '/',
  requireRole(['admin', 'viewer']),
  controller.list
)

router.get(
  '/:id',
  requireRole(['admin', 'viewer']),
  validateParams(idParamSchema),
  controller.getOne
)

router.post(
  '/',
  requireRole(['admin']),
  validate(createTestItemSchema),
  controller.create
)

router.put(
  '/:id',
  requireRole(['admin']),
  validateParams(idParamSchema),
  validate(updateTestItemSchema),
  controller.update
)

router.delete(
  '/:id',
  requireRole(['admin']),
  validateParams(idParamSchema),
  controller.delete
)

export default router

