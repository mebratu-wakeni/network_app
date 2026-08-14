import { describe, expect, it, vi } from 'vitest'
import { UsersService } from '../../../../src/modules/users/users.service.js'

function makeRepository(overrides = {}) {
  return {
    findByIdForTenant: vi.fn(),
    findById: vi.fn(),
    findByUsername: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteUser: vi.fn(),
    getUserRoles: vi.fn().mockResolvedValue([]),
    getUserRules: vi.fn().mockResolvedValue([]),
    getAllRoles: vi.fn().mockResolvedValue([]),
    getAllRules: vi.fn().mockResolvedValue([]),
    getRoleRules: vi.fn().mockResolvedValue([]),
    getRuleRoles: vi.fn().mockResolvedValue([]),
    findRoleByName: vi.fn(),
    assignRoleToUser: vi.fn(),
    removeRoleFromUser: vi.fn(),
    findRuleByKey: vi.fn(),
    assignRuleToUser: vi.fn(),
    removeRuleFromUser: vi.fn(),
    getUsersList: vi.fn(),
    getUsersListCount: vi.fn(),
    updateProfile: vi.fn(),
    updateUserProfile: vi.fn(),
    updateAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    changePassword: vi.fn(),
    toggleUserStatus: vi.fn(),
    ...overrides
  }
}

describe('UsersService tenant isolation', () => {
  it('getById throws 404 when user is not in tenant', async () => {
    const repository = makeRepository({
      findByIdForTenant: vi.fn().mockResolvedValue(null)
    })
    const service = new UsersService(repository)

    await expect(service.getById(1, 99)).rejects.toMatchObject({ status: 404, message: 'User not found' })
    expect(repository.findByIdForTenant).toHaveBeenCalledWith(1, 99)
  })

  it('getById strips password_hash from response', async () => {
    const repository = makeRepository({
      findByIdForTenant: vi.fn().mockResolvedValue({
        id: 1,
        username: 'admin',
        password_hash: 'secret',
        tenant_id: 1
      })
    })
    const service = new UsersService(repository)

    const user = await service.getById(1, 1)
    expect(user.password_hash).toBeUndefined()
    expect(user.username).toBe('admin')
  })

  it('create checks username uniqueness within tenant only', async () => {
    const repository = makeRepository({
      findByUsername: vi.fn().mockResolvedValue({ id: 2 }),
      create: vi.fn()
    })
    const service = new UsersService(repository)

    await expect(
      service.create(1, { username: 'admin', password: 'password123', display_name: 'X' })
    ).rejects.toMatchObject({ status: 409, message: 'Username already taken' })
  })

  it('assignRoleToUser verifies tenant ownership before assigning', async () => {
    const repository = makeRepository({
      findByIdForTenant: vi.fn().mockResolvedValue(null)
    })
    const service = new UsersService(repository)

    await expect(
      service.assignRoleToUser(2, 1, { roleName: 'Admin' })
    ).rejects.toMatchObject({ status: 404 })

    expect(repository.findRoleByName).not.toHaveBeenCalled()
  })

  it('deleteUser delegates tenantId to repository', async () => {
    const repository = makeRepository({
      deleteUser: vi.fn().mockResolvedValue({ id: 3, username: 'staff' })
    })
    const service = new UsersService(repository)

    const result = await service.deleteUser(1, 3)
    expect(result.username).toBe('staff')
    expect(repository.deleteUser).toHaveBeenCalledWith(1, 3)
  })

  it('changePassword verifies current password only for tenant user', async () => {
    const repository = makeRepository({
      findByIdForTenant: vi.fn().mockResolvedValue({
        id: 1,
        password_hash: await new UsersService(makeRepository()).hashPassword('oldpass')
      }),
      changePassword: vi.fn().mockResolvedValue({ message: 'Password updated successfully' })
    })
    const service = new UsersService(repository)

    await expect(
      service.changePassword(1, 1, { currentPassword: 'wrong', newPassword: 'newpass123' })
    ).rejects.toMatchObject({ status: 401, message: 'Current password is incorrect' })

    const hash = await service.hashPassword('oldpass')
    repository.findByIdForTenant.mockResolvedValue({ id: 1, password_hash: hash })

    const result = await service.changePassword(1, 1, {
      currentPassword: 'oldpass',
      newPassword: 'newpass123'
    })
    expect(result.message).toBe('Password updated successfully')
    expect(repository.changePassword).toHaveBeenCalledWith(1, 1, expect.any(String))
  })

  it('updateProfile rejects duplicate username within same tenant', async () => {
    const repository = makeRepository({
      findByUsername: vi.fn().mockResolvedValue({ id: 99 }),
      updateProfile: vi.fn()
    })
    const service = new UsersService(repository)

    await expect(
      service.updateProfile(1, 1, { username: 'taken' })
    ).rejects.toMatchObject({ status: 409, message: 'Username already taken' })
  })
})
