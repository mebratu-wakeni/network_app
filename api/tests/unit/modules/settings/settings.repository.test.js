import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SettingsRepository } from '../../../../src/modules/settings/settings.repository.js'
import {
  createSettingsSchema,
  createTestDb,
  seedTwoTenantsWithSettings
} from '../../../helpers/testDb.js'

describe('SettingsRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createSettingsSchema(db)
    await seedTwoTenantsWithSettings(db)
    repo = new SettingsRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('getAll only returns settings for the requested tenant', async () => {
    const t1 = await repo.getAll(1)
    const t2 = await repo.getAll(2)

    expect(t1.withhold_percentage).toBe('2.5')
    expect(t1.company_name).toBe('Pharmacy One')
    expect(t2.withhold_percentage).toBe('5')
    expect(t2.company_name).toBe('Pharmacy Two')
  })

  it('getByKey is scoped to tenant', async () => {
    expect(await repo.getByKey(1, 'withhold_percentage')).toBe('2.5')
    expect(await repo.getByKey(2, 'withhold_percentage')).toBe('5')
  })

  it('set updates only the tenant row without affecting other tenants', async () => {
    await repo.set(1, 'withhold_percentage', '3')

    expect(await repo.getByKey(1, 'withhold_percentage')).toBe('3')
    expect(await repo.getByKey(2, 'withhold_percentage')).toBe('5')
  })

  it('setMany is tenant-scoped', async () => {
    await repo.setMany(2, { company_name: 'Updated Two', company_phone: '555-0000' })

    const t1 = await repo.getAll(1, ['company_name', 'company_phone'])
    const t2 = await repo.getAll(2, ['company_name', 'company_phone'])

    expect(t1.company_name).toBe('Pharmacy One')
    expect(t1.company_phone).toBeUndefined()
    expect(t2.company_name).toBe('Updated Two')
    expect(t2.company_phone).toBe('555-0000')
  })
})
