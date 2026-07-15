import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler, notFound } from '../../../../src/middleware/error.js'

const mockService = vi.hoisted(() => ({
  getById: vi.fn(),
  getUsersList: vi.fn(),
  updateProfile: vi.fn(),
  updateUserProfile: vi.fn(),
  deleteUser: vi.fn(),
  assignRoleToUser: vi.fn(),
  removeRoleFromUser: vi.fn(),
  assignRuleToUser: vi.fn(),
  removeRuleFromUser: vi.fn(),
  getUserRolesAndRules: vi.fn(),
  toggleUserStatus: vi.fn(),
  changePassword: vi.fn(),
  updateAvatar: vi.fn(),
  removeAvatar: vi.fn()
}))

const authState = vi.hoisted(() => ({
  tenantId: 1,
  user: { id: 1, email: 'admin@test.com', display_name: 'Admin', is_active: true, rules: ['CanEditUsers'] }
}))

vi.mock('../../../../src/middleware/auth.js', () => ({
  authenticate: (req, _res, next) => {
    req.user = authState.user
    req.tenantId = authState.tenantId
    next()
  },
  requireTenant: (req, res, next) => {
    if (!req.tenantId) {
      const error = new Error('Tenant context is required for this request')
      error.status = 401
      return next(error)
    }
    next()
  },
  requireRules: () => (_req, _res, next) => next()
}))

vi.mock('../../../../src/modules/users/users.service.js', () => ({
  UsersService: class MockUsersService {
    getById = (...args) => mockService.getById(...args)
    getUsersList = (...args) => mockService.getUsersList(...args)
    updateProfile = (...args) => mockService.updateProfile(...args)
    updateUserProfile = (...args) => mockService.updateUserProfile(...args)
    deleteUser = (...args) => mockService.deleteUser(...args)
    assignRoleToUser = (...args) => mockService.assignRoleToUser(...args)
    removeRoleFromUser = (...args) => mockService.removeRoleFromUser(...args)
    assignRuleToUser = (...args) => mockService.assignRuleToUser(...args)
    removeRuleFromUser = (...args) => mockService.removeRuleFromUser(...args)
    getUserRolesAndRules = (...args) => mockService.getUserRolesAndRules(...args)
    toggleUserStatus = (...args) => mockService.toggleUserStatus(...args)
    changePassword = (...args) => mockService.changePassword(...args)
    updateAvatar = (...args) => mockService.updateAvatar(...args)
    removeAvatar = (...args) => mockService.removeAvatar(...args)
  }
}))

const { default: usersRouter } = await import('../../../../src/modules/users/users.routes.js')

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/users', usersRouter)
  app.use(notFound)
  app.use(errorHandler)
  return app
}

describe('users routes tenant isolation contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.tenantId = 1
    authState.user = { id: 1, email: 'admin@test.com', display_name: 'Admin', is_active: true, rules: ['CanEditUsers'] }
  })

  it('rejects requests when tenant context is missing', async () => {
    authState.tenantId = null

    const res = await request(createTestApp()).get('/api/users/1')
    expect(res.status).toBe(401)
    expect(res.body.error).toContain('Tenant context is required')
    expect(mockService.getById).not.toHaveBeenCalled()
  })

  it('GET /api/users/:id passes tenantId to service', async () => {
    mockService.getById.mockResolvedValueOnce({ id: 2, username: 'staff' })

    const res = await request(createTestApp()).get('/api/users/2')

    expect(res.status).toBe(200)
    expect(mockService.getById).toHaveBeenCalledWith(1, 2)
  })

  it('POST /api/users/search passes tenantId to service', async () => {
    mockService.getUsersList.mockResolvedValueOnce({ users: [], total: 0, hasMore: false })

    const res = await request(createTestApp()).post('/api/users/search').send({ searchQuery: 'admin' })

    expect(res.status).toBe(200)
    expect(mockService.getUsersList).toHaveBeenCalledWith(1, 'admin', expect.any(Object))
  })

  it('PUT /api/users/:id passes tenantId to updateProfile', async () => {
    mockService.updateProfile.mockResolvedValueOnce({ id: 2, display_name: 'New' })

    const res = await request(createTestApp()).put('/api/users/2').send({ display_name: 'New' })

    expect(res.status).toBe(200)
    expect(mockService.updateProfile).toHaveBeenCalledWith(1, 2, expect.objectContaining({ display_name: 'New' }))
  })

  it('PATCH /api/users/profile uses self-service update with tenantId', async () => {
    mockService.updateUserProfile.mockResolvedValueOnce({ id: 1, display_name: 'Me' })

    const res = await request(createTestApp()).patch('/api/users/profile').send({ display_name: 'Me' })

    expect(res.status).toBe(200)
    expect(mockService.updateUserProfile).toHaveBeenCalledWith(1, 1, expect.objectContaining({ display_name: 'Me' }))
  })

  it('DELETE /api/users/:id passes tenantId and blocks self-delete', async () => {
    const selfDelete = await request(createTestApp()).delete('/api/users/1')
    expect(selfDelete.status).toBe(403)
    expect(mockService.deleteUser).not.toHaveBeenCalled()

    mockService.deleteUser.mockResolvedValueOnce({ id: 2, username: 'staff' })
    const res = await request(createTestApp()).delete('/api/users/2')
    expect(res.status).toBe(200)
    expect(mockService.deleteUser).toHaveBeenCalledWith(1, 2)
  })

  it('role and rule endpoints pass tenantId to service', async () => {
    mockService.assignRoleToUser.mockResolvedValueOnce({ assigned: true })
    mockService.removeRoleFromUser.mockResolvedValueOnce({ removed: true })
    mockService.assignRuleToUser.mockResolvedValueOnce({ assigned: true })
    mockService.removeRuleFromUser.mockResolvedValueOnce({ removed: true })

    await request(createTestApp()).post('/api/users/2/roles').send({ roleName: 'Admin' })
    await request(createTestApp()).delete('/api/users/2/roles').send({ roleName: 'Admin' })
    await request(createTestApp()).post('/api/users/2/rules').send({ ruleKey: 'CanSeeUsers' })
    await request(createTestApp()).delete('/api/users/2/rules').send({ ruleKey: 'CanSeeUsers' })

    expect(mockService.assignRoleToUser).toHaveBeenCalledWith(1, 2, expect.any(Object))
    expect(mockService.removeRoleFromUser).toHaveBeenCalledWith(1, 2, expect.any(Object))
    expect(mockService.assignRuleToUser).toHaveBeenCalledWith(1, 2, expect.any(Object))
    expect(mockService.removeRuleFromUser).toHaveBeenCalledWith(1, 2, expect.any(Object))
  })

  it('POST /api/users/change-password passes tenantId', async () => {
    mockService.changePassword.mockResolvedValueOnce({ message: 'Password updated successfully' })

    const res = await request(createTestApp()).post('/api/users/change-password').send({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123'
    })

    expect(res.status).toBe(200)
    expect(mockService.changePassword).toHaveBeenCalledWith(1, 1, expect.any(Object))
  })

  it('propagates 404 from service through error middleware', async () => {
    const err = new Error('User not found')
    err.status = 404
    mockService.getById.mockRejectedValueOnce(err)

    const res = await request(createTestApp()).get('/api/users/999')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('User not found')
  })
})
