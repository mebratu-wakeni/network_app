import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { UsersRepository } from '../../../../src/modules/users/users.repository.js'
import {
  createTestDb,
  createUsersSchema,
  seedTwoTenantsWithUsers
} from '../../../helpers/testDb.js'

describe('UsersRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createUsersSchema(db)
    await seedTwoTenantsWithUsers(db)
    repo = new UsersRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('findByIdForTenant returns user only when tenant matches', async () => {
    const user = await repo.findByIdForTenant(1, 1)
    expect(user).toMatchObject({ id: 1, username: 'admin', tenant_id: 1 })

    const crossTenant = await repo.findByIdForTenant(2, 1)
    expect(crossTenant).toBeUndefined()
  })

  it('findByUsername and findByEmail are scoped to tenant', async () => {
    const t1 = await repo.findByUsername(1, 'admin')
    const t2 = await repo.findByUsername(2, 'admin')
    expect(t1.id).toBe(1)
    expect(t2.id).toBe(2)

    expect(await repo.findByUsername(1, 'missing')).toBeUndefined()
    expect(await repo.findByEmail(1, 'admin@one.com')).toMatchObject({ id: 1 })
    expect(await repo.findByEmail(2, 'admin@one.com')).toBeUndefined()
  })

  it('getUsersList and count only return users from the requested tenant', async () => {
    const list = await repo.getUsersList(1, '', { limit: 10, offset: 0, sortBy: 'id', orderBy: 'asc' })
    expect(list).toHaveLength(2)
    expect(list.every((u) => [1, 3].includes(u.id))).toBe(true)

    const count = await repo.getUsersListCount(2, '')
    expect(count).toBe(1)
  })

  it('update does not affect users in another tenant', async () => {
    const [updated] = await repo.update(1, 1, { display_name: 'Updated One' })
    expect(updated.display_name).toBe('Updated One')

    const [blocked] = await repo.update(2, 1, { display_name: 'Hacked' })
    expect(blocked).toBeUndefined()

    const untouched = await repo.findById(1)
    expect(untouched.display_name).toBe('Updated One')
  })

  it('deleteUser only removes users from the correct tenant', async () => {
    await repo.deleteUser(1, 3)
    expect(await repo.findById(3)).toBeUndefined()

    await expect(repo.deleteUser(2, 3)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
    expect(await repo.findById(1)).toBeTruthy()
  })

  it('updateProfile, updateUserProfile, and toggleUserStatus respect tenant scope', async () => {
    const profile = await repo.updateProfile(1, 1, { display_name: 'Profile One' })
    expect(profile.display_name).toBe('Profile One')

    const blockedProfile = await repo.updateProfile(2, 1, { display_name: 'Nope' })
    expect(blockedProfile).toBeNull()

    await repo.updateUserProfile(1, 3, { phone: '0911000000' })
    const userWithPhone = await repo.findByIdForTenant(1, 3)
    expect(userWithPhone.phone).toBe('0911000000')

    const toggled = await repo.toggleUserStatus(1, 3)
    expect(Boolean(toggled.is_active)).toBe(false)

    await expect(repo.toggleUserStatus(2, 3)).rejects.toMatchObject({ status: 404 })
  })

  it('changePassword only updates password for users in the correct tenant', async () => {
    await repo.changePassword(1, 1, 'new-hash')

    const user = await repo.findById(1)
    expect(user.password_hash).toBe('new-hash')

    await expect(repo.changePassword(2, 1, 'other-hash')).rejects.toMatchObject({ status: 404 })
  })

  it('updateAvatar and removeAvatar respect tenant scope', async () => {
    const avatarData = {
      avatar_key: 'a.png',
      avatar_url: '/uploads/a.png',
      avatar_mime: 'image/png',
      avatar_bytes: 100,
      avatar_width: 10,
      avatar_height: 10
    }

    const updated = await repo.updateAvatar(1, 1, avatarData)
    expect(updated.avatar_key).toBe('a.png')

    const blocked = await repo.updateAvatar(2, 1, avatarData)
    expect(blocked).toBeUndefined()

    const removed = await repo.removeAvatar(1, 1)
    expect(removed.avatar_key).toBeNull()

    const blockedRemove = await repo.removeAvatar(2, 1)
    expect(blockedRemove).toBeUndefined()
  })

  it('create requires tenant_id in payload', async () => {
    const [created] = await repo.create({
      tenant_id: 2,
      username: 'newuser',
      email: 'new@two.com',
      password_hash: 'hash',
      display_name: 'New',
      is_active: true
    })
    expect(created.tenant_id).toBe(2)
    expect(await repo.findByIdForTenant(1, created.id)).toBeUndefined()
  })
})
