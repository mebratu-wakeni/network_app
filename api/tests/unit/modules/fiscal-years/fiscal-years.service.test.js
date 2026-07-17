import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FiscalYearsRepository } from '../../../../src/modules/fiscal-years/fiscal-years.repository.js'
import { FiscalYearsService } from '../../../../src/modules/fiscal-years/fiscal-years.service.js'
import { createTestDb } from '../../../helpers/testDb.js'

async function createFiscalYearsSchema(db) {
  await db.schema.createTable('fiscal_years', (t) => {
    t.increments('id').primary()
    t.integer('fiscal_year').notNullable().unique()
    t.date('start_date').notNullable()
    t.date('end_date').notNullable()
    t.string('status').notNullable().defaultTo('open')
    t.timestamp('closed_at')
    t.integer('closed_by')
    t.timestamp('created_at')
    t.timestamp('updated_at')
  })
}

describe('FiscalYearsService single-open rule', () => {
  let db
  let service

  beforeEach(async () => {
    db = createTestDb()
    await createFiscalYearsSchema(db)
    service = new FiscalYearsService(new FiscalYearsRepository(db), db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('creates the first open fiscal year', async () => {
    const fy = await service.createFiscalYear({
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    })
    expect(fy).toMatchObject({ fiscal_year: 2026, status: 'open' })
  })

  it('blocks creating a second open fiscal year', async () => {
    await service.createFiscalYear({
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    })

    await expect(
      service.createFiscalYear({
        fiscal_year: 2027,
        start_date: '2027-01-01',
        end_date: '2027-12-31'
      })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('currently open. Close it first')
    })
  })

  it('allows creating another year after the open year is closed', async () => {
    await service.createFiscalYear({
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    })
    await db('fiscal_years').where({ fiscal_year: 2026 }).update({ status: 'closed' })

    const next = await service.createFiscalYear({
      fiscal_year: 2027,
      start_date: '2027-01-01',
      end_date: '2027-12-31'
    })
    expect(next).toMatchObject({ fiscal_year: 2027, status: 'open' })
  })
})
