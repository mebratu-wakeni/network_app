import { Router } from 'express'
import knex from '../../db/knex.js'
import { requirePlatformAdminAuth } from '../../middleware/platformAdminAuth.js'
import { PlatformAdminsRepository } from './platformAdmins.repository.js'
import { PlatformAdminsService } from './platformAdmins.service.js'

const repository = new PlatformAdminsRepository(knex)
const service = new PlatformAdminsService(repository)
const router = Router()

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    const result = await service.login(username, password)
    res.json({ ok: true, ...result })
  } catch (err) {
    next(err)
  }
})

router.post('/change-password', requirePlatformAdminAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body
    await service.changePassword(req.platformAdmin.sub, current_password, new_password)
    res.json({ ok: true, message: 'Password changed successfully.' })
  } catch (err) {
    next(err)
  }
})

export default router
