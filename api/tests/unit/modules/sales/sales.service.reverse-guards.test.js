import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SalesService } from '../../../../src/modules/sales/sales.service.js'
import {
  createFiscalYearsSchema,
  createTestDb,
  seedFiscalYears
} from '../../../helpers/testDb.js'

function makeRepository(db, overrides = {}) {
  return {
    knex: db,
    getOrderById: vi.fn(),
    reverseOrder: vi.fn().mockResolvedValue({ order_id: 1, status: 'reversed' }),
    ...overrides
  }
}

describe('SalesService.reverseOrder withhold guards', () => {
  let db
  let service
  let repository

  beforeEach(async () => {
    db = createTestDb()
    await createFiscalYearsSchema(db)
    await seedFiscalYears(db)
    repository = makeRepository(db)
    service = new SalesService(repository)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })

  afterEach(async () => {
    vi.useRealTimers()
    if (db) await db.destroy()
  })

  it('rejects reverse when withhold is settled', async () => {
    repository.getOrderById.mockResolvedValue({
      order: {
        id: 1,
        is_reversed: false,
        withhold_amount: 10,
        withhold_settled: true,
        withhold_confirmation: true,
        withhold_ref: 'WH-1'
      },
      items: []
    })

    await expect(service.reverseOrder(1, 1, { id: 1 })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/settled/i)
    })
    expect(repository.reverseOrder).not.toHaveBeenCalled()
  })

  it('rejects reverse when withhold is confirmed until rollback', async () => {
    repository.getOrderById.mockResolvedValue({
      order: {
        id: 1,
        is_reversed: false,
        withhold_amount: 10,
        withhold_settled: false,
        withhold_confirmation: true,
        withhold_ref: 'WH-2'
      },
      items: []
    })

    await expect(service.reverseOrder(1, 1, { id: 1 })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/roll back/i)
    })
    expect(repository.reverseOrder).not.toHaveBeenCalled()
  })

  it('allows reverse when withhold is present but not confirmed', async () => {
    repository.getOrderById.mockResolvedValue({
      order: {
        id: 1,
        is_reversed: false,
        withhold_amount: 10,
        withhold_settled: false,
        withhold_confirmation: false,
        withhold_ref: null
      },
      items: []
    })

    await service.reverseOrder(1, 1, { id: 1 })
    expect(repository.reverseOrder).toHaveBeenCalledWith(1, 1, 1)
  })
})
