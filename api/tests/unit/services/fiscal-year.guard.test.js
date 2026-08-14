import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertFiscalYearOpen } from '../../../src/services/fiscal-year.guard.js'
import {
  createFiscalYearsSchema,
  createTestDb,
  seedFiscalYears,
  seedTwoTenantsWithUsers
} from '../../helpers/testDb.js'

describe('assertFiscalYearOpen', () => {
  let db

  beforeEach(async () => {
    db = createTestDb()
    await createFiscalYearsSchema(db)
    await seedTwoTenantsWithUsers(db)
    await seedFiscalYears(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('returns open fiscal year for matching tenant and date', async () => {
    const fy = await assertFiscalYearOpen(db, 1, '2026-06-15')
    expect(fy).toMatchObject({ tenant_id: 1, fiscal_year: 2026, status: 'open' })
  })

  it('does not return fiscal year from another tenant', async () => {
    await db('fiscal_years').where({ tenant_id: 2 }).delete()

    await expect(assertFiscalYearOpen(db, 2, '2026-06-15')).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('No fiscal year covers')
    })
  })

  it('rejects when fiscal year is closed', async () => {
    await expect(assertFiscalYearOpen(db, 1, '2025-06-15')).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('is closed')
    })
  })

  it('rejects when date is outside all fiscal year ranges', async () => {
    await expect(assertFiscalYearOpen(db, 1, '2023-01-01')).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('No fiscal year covers')
    })
  })

  it('requires tenantId', async () => {
    await expect(assertFiscalYearOpen(db, null, '2025-06-15')).rejects.toMatchObject({
      status: 401,
      message: 'Tenant context is required.'
    })
  })

  it('requires transaction date', async () => {
    await expect(assertFiscalYearOpen(db, 1, null)).rejects.toMatchObject({
      status: 400,
      message: 'Transaction date is required.'
    })
  })
})
