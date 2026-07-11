import { Router } from 'express'
import knex from '../../db/knex.js'
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

export default router
