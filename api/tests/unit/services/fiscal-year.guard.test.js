import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertFiscalYearOpen } from '../../../src/services/fiscal-year.guard.js'
import { createTestDb } from '../../helpers/testDb.js'

async function createFiscalYearsSchema(db) {
  await db.schema.createTable('fiscal_years', (t) => {
    t.increments('id').primary()
    t.integer('fiscal_year').notNullable().unique()
    t.date('start_date').notNullable()
    t.date('end_date').notNullable()
    t.string('status').notNullable().defaultTo('open')
    t.timestamp('created_at')
    t.timestamp('updated_at')
  })
}

describe('assertFiscalYearOpen (single-tenant, 2-arg)', () => {
  let db

  beforeEach(async () => {
    db = createTestDb()
    await createFiscalYearsSchema(db)
    await db('fiscal_years').insert([
      {
        fiscal_year: 2025,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        status: 'closed'
      },
      {
        fiscal_year: 2026,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'open'
      }
    ])
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('uses 2-argument signature (knex, date) — not tenantId', () => {
    expect(assertFiscalYearOpen.length).toBe(2)
  })

  it('returns open fiscal year covering the transaction date', async () => {
    const fy = await assertFiscalYearOpen(db, '2026-06-15')
    expect(fy).toMatchObject({ fiscal_year: 2026, status: 'open' })
  })

  it('tells the user to create a FY when none covers the date', async () => {
    await expect(assertFiscalYearOpen(db, '2023-01-01')).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/No fiscal year covers 2023-01-01.*Create and open fiscal year 2023/s)
    })
  })

  it('rejects closed fiscal years with a clear message', async () => {
    await expect(assertFiscalYearOpen(db, '2025-06-15')).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('is closed')
    })
  })

  it('requires a transaction date', async () => {
    await expect(assertFiscalYearOpen(db, null)).rejects.toMatchObject({
      status: 400,
      message: 'Transaction date is required.'
    })
  })
})
