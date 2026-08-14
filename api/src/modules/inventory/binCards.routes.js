/**
 * Routes: HTTP routing layer for bin_cards
 * Defines endpoints, applies middleware (auth, validation), and wires controllers
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate, requireRules, requireTenant } from '../../middleware/auth.js'
import { BinCardsRepository } from './binCards.repository.js'
import { BinCardsService } from './binCards.service.js'
import { BinCardsController } from './binCards.controller.js'

// Initialize dependencies (Dependency Injection pattern)
const repository = new BinCardsRepository(knex)
const service = new BinCardsService(repository)
const controller = new BinCardsController(service)

const router = Router()

// All routes require authentication and tenant context
router.use(authenticate, requireTenant)

// Get bin card transactions for a product - requires CanSeeProductDetails rule
router.get(
  '/product/:productId',
  requireRules(['CanSeeProductDetails']),
  controller.getByProductId
)

// Export bin card transactions to CSV - requires CanSeeProductDetails rule
router.get(
  '/product/:productId/export',
  requireRules(['CanSeeProductDetails']),
  controller.export
)

export default router
