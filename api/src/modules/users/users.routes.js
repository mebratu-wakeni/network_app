/**
 * Routes: User management endpoints
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { UsersRepository } from './users.repository.js'
import { UsersService } from './users.service.js'
import { UsersController } from './users.controller.js'
import { 
  validate, validateParams, updateUserSchema, idParamSchema, 
  assignRoleSchema, removeRoleSchema, assignRuleSchema, removeRuleSchema, 
  searchUsersSchema, updateUserProfileSchema, changePasswordSchema } from './users.schema.js'
import { authenticate, requireRole, requireRules } from '../../middleware/auth.js'

// Initialize dependencies
const usersRepository = new UsersRepository(knex)
const usersService = new UsersService(usersRepository)
const usersController = new UsersController(usersService)

const router = Router()

// All routes require authentication
router.use(authenticate)

// Search users (must come before /:id route)
router.post(
  '/search',
  requireRules(['CanSeeUsers']),
  validate(searchUsersSchema),
  usersController.getUsersList
)

// User profile management (must come before /:id route)
router.patch(
  '/profile',
  validate(updateUserProfileSchema),
  usersController.updateProfile
)

// User profile avatar management (after /:id routes to avoid conflicts)
router.post(
  '/:id/avatar',
  validateParams(idParamSchema),
  usersController.uploadAvatar
)

// Remove user avatar
router.delete(
  '/:id/avatar',
  validateParams(idParamSchema),
  usersController.removeAvatar
)

// Change user password (must come before /:id route)
router.post(
  '/change-password',
  validate(changePasswordSchema),
  usersController.changePassword
)

// Get user profile by ID
router.get(
  '/:id',
  validateParams(idParamSchema),
  usersController.getProfile
)

// Update user profile by ID (requires users.write rule or own profile)
router.put(
  '/:id',
  validateParams(idParamSchema),
  validate(updateUserSchema),
  usersController.updateProfile
)

router.put(
  '/:id/profile',
  validateParams(idParamSchema),
  validate(updateUserProfileSchema),
  usersController.updateUserProfile
)

// Assign role to user (admin only)
router.post(
  '/:id/roles',
  requireRules(['CanEditUsers']),
  validateParams(idParamSchema),
  validate(assignRoleSchema),
  usersController.assignRole
)

// Remove role from user (admin only)
router.delete(
  '/:id/roles',
  requireRules(['CanEditUsers']),
  validateParams(idParamSchema),
  validate(removeRoleSchema),
  usersController.removeRole
)

// Assign rule to user (admin only)
router.post(
  '/:id/rules',
  requireRules(['CanEditUsers']),
  validateParams(idParamSchema),
  validate(assignRuleSchema),
  usersController.assignRule
)

// Remove rule from user (admin only)
router.delete(
  '/:id/rules',
  requireRules(['CanEditUsers']),
  validateParams(idParamSchema),
  validate(removeRuleSchema),
  usersController.removeRule
)

// Remove user 

router.delete(
  '/:id',
  requireRules(['CanEditUsers']),
  validateParams(idParamSchema),
  usersController.deleteUser
)

// Get user's roles and rules
router.get(
  '/:id/permissions',
  requireRules(['CanSeeUsers']),
  validateParams(idParamSchema),
  usersController.getPermissions
)

router.patch(
  '/:id/toggle-status',
  requireRules(['CanEditUsers']),
  validateParams(idParamSchema),
  usersController.toggleUserStatus
)

export default router

