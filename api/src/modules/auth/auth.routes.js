/**
 * Routes: Authentication endpoints
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { UsersRepository } from '../users/users.repository.js'
import { UsersService } from '../users/users.service.js'
import { AuthService } from './auth.service.js'
import { AuthController } from './auth.controller.js'
import { validate, registerSchema, loginSchema } from './auth.schema.js'
import { authenticate, requireRole} from '../../middleware/auth.js'

// Initialize dependencies
const usersRepository = new UsersRepository(knex)
const usersService = new UsersService(usersRepository)
const authService = new AuthService(usersService, usersRepository)
const authController = new AuthController(authService)

const router = Router()

// Public routes
router.post('/register', authenticate, requireRole(['Admin']), validate(registerSchema), authController.register)
router.post('/login', validate(loginSchema), authController.login)

// Protected route (requires valid JWT)
router.get('/me', authenticate, authController.me)

export default router

