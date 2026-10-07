/**
 * Tenant management routes -- used by the masatech-admin panel.
 *
 * Auth: gated by requirePlatformAdminAuth (JWT issued by PlatformAdminsService.login),
 * not tenant-scoped. See src/middleware/platformAdminAuth.js and the
 * platformAdmins module for the login/change-password endpoints.
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { requirePlatformAdminAuth } from '../../middleware/platformAdminAuth.js'
import { TenantsRepository } from './tenants.repository.js'
import { TenantsService } from './tenants.service.js'
import { UsersRepository } from '../users/users.repository.js'

const tenantsRepository = new TenantsRepository(knex)
const usersRepository = new UsersRepository(knex)
const tenantsService = new TenantsService(knex, tenantsRepository, usersRepository)

const router = Router()
router.use(requirePlatformAdminAuth)

router.get('/', async (req, res, next) => {
  try {
    const tenants = await tenantsService.list()
    res.json({ ok: true, tenants })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const tenant = await tenantsService.getById(Number(req.params.id))
    res.json({ ok: true, tenant })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const tenant = await tenantsService.createTenant(req.body)
    res.status(201).json({ ok: true, tenant })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/suspend', async (req, res, next) => {
  try {
    const tenant = await tenantsService.suspend(Number(req.params.id))
    res.json({ ok: true, tenant })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id/reactivate', async (req, res, next) => {
  try {
    const tenant = await tenantsService.reactivate(Number(req.params.id))
    res.json({ ok: true, tenant })
  } catch (error) {
    next(error)
  }
})

router.get('/:id/users', async (req, res, next) => {
  try {
    const users = await tenantsService.listUsers(Number(req.params.id))
    res.json({ ok: true, users })
  } catch (error) {
    next(error)
  }
})

router.post('/:id/users/:userId/reset-password', async (req, res, next) => {
  try {
    const result = await tenantsService.resetUserPassword(Number(req.params.id), Number(req.params.userId))
    res.json({ ok: true, ...result })
  } catch (error) {
    next(error)
  }
})

export default router
