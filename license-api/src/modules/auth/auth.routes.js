import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate } from '../../middleware/auth.js'
import { AuthRepository } from './auth.repository.js'
import { AuthService } from './auth.service.js'

const repository = new AuthRepository(knex)
const service = new AuthService(repository)
const router = Router()

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body
    const result = await service.login(username, password)
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
})

/** POST /auth/change-password — requires JWT, verifies current password */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body
    await service.changePassword(req.admin.sub, current_password, new_password)
    res.json({ success: true, message: 'Password changed successfully.' })
  } catch (err) {
    next(err)
  }
})

export default router
