/**
 * Routes: User management endpoints
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { UsersRepository } from './users.repository.js'
import { UsersService } from './users.service.js'
import { UsersController } from './users.controller.js'
import { validate, validateParams, updateUserSchema, idParamSchema, assignRoleSchema, removeRoleSchema, assignRuleSchema, removeRuleSchema, searchUsersSchema } from './users.schema.js'
import { authenticate, requireRole } from '../../middleware/auth.js'

// Initialize dependencies
const usersRepository = new UsersRepository(knex)
const usersService = new UsersService(usersRepository)
const usersController = new UsersController(usersService)

const router = Router()

// All routes require authentication
router.use(authenticate)

// Get user profile
router.get(
  '/:id',
  validateParams(idParamSchema),
  usersController.getProfile
)

// Update user profile (requires users.write rule or own profile)
router.put(
  '/:id',
  validateParams(idParamSchema),
  validate(updateUserSchema),
  usersController.updateProfile
)

// Assign role to user (admin only)
router.post(
  '/:id/roles',
  requireRole(['admin']),
  validateParams(idParamSchema),
  validate(assignRoleSchema),
  usersController.assignRole
)

router.delete(
  '/:id/roles',
  requireRole(['admin']),
  validateParams(idParamSchema),
  validate(removeRoleSchema),
  usersController.removeRole
)

// Assign rule to user (admin only)
router.post(
  '/:id/rules',
  requireRole(['admin']),
  validateParams(idParamSchema),
  validate(assignRuleSchema),
  usersController.assignRule
)

// Remove rule from user (admin only)
router.delete(
  '/:id/rules',
  requireRole(['admin']),
  validateParams(idParamSchema),
  validate(removeRuleSchema),
  usersController.removeRule
)

router.post(
  '/search',
  validate(searchUsersSchema),
  usersController.getUsersList
)

export default router

