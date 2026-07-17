import { describe, expect, it, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { AuthService } from '../../../../src/modules/auth/auth.service.js'

describe('AuthService.login (single-tenant)', () => {
  let usersRepository
  let usersService
  let service

  beforeEach(() => {
    usersRepository = {
      findByUsername: vi.fn(),
      updateLoginTime: vi.fn().mockResolvedValue(undefined)
    }
    usersService = {
      verifyPassword: vi.fn(),
      create: vi.fn()
    }
    service = new AuthService(usersService, usersRepository)
  })

  it('logs in with username and password only (2-arg signature)', async () => {
    usersRepository.findByUsername.mockResolvedValue({
      id: 1,
      username: 'admin',
      is_active: true,
      password_hash: 'hash',
      display_name: 'Admin'
    })
    usersService.verifyPassword.mockResolvedValue(true)

    // Multi-tenant would be login(clientCode, username, password) — must stay 2-arg here
    expect(service.login.length).toBe(2)

    const result = await service.login('admin', 'secret')

    expect(usersRepository.findByUsername).toHaveBeenCalledWith('admin')
    expect(usersService.verifyPassword).toHaveBeenCalledWith('secret', 'hash')
    expect(result.user.id).toBe(1)
    expect(result.token).toEqual(expect.any(String))
    expect(result.user).not.toHaveProperty('password_hash')
  })

  it('does not depend on a tenantsRepository', () => {
    expect(service).not.toHaveProperty('tenantsRepository')
    expect(service.usersRepository).toBeTruthy()
  })

  it('rejects invalid credentials', async () => {
    usersRepository.findByUsername.mockResolvedValue(null)
    await expect(service.login('nobody', 'x')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid username or password'
    })
  })

  it('rejects deactivated accounts', async () => {
    usersRepository.findByUsername.mockResolvedValue({
      id: 2,
      username: 'old',
      is_active: false,
      password_hash: 'hash'
    })
    await expect(service.login('old', 'secret')).rejects.toMatchObject({
      status: 403,
      message: 'Account is deactivated'
    })
  })

  it('JWT payload is userId only (no tenantId)', async () => {
    usersRepository.findByUsername.mockResolvedValue({
      id: 9,
      username: 'admin',
      is_active: true,
      password_hash: 'hash'
    })
    usersService.verifyPassword.mockResolvedValue(true)

    const { token } = await service.login('admin', 'secret')
    const payload = jwt.decode(token)
    expect(payload.userId).toBe(9)
    expect(payload.tenantId).toBeUndefined()
  })
})
