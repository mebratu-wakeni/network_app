import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InventoriesService } from '../../../../src/modules/inventory/inventories.service.js'
import {
  createFiscalYearsSchema,
  createTestDb,
  seedFiscalYears,
  seedTwoTenantsWithUsers
} from '../../../helpers/testDb.js'

function makeRepository(db, overrides = {}) {
  return {
    knex: db,
    bulkImport: vi.fn().mockResolvedValue({
      summary: { total: 1, successful: 1, failed: 0 },
      successful: [{ index: 0, inventory_id: 1, inventory_code: 'I001', product_id: 1, product_code: 'P1' }],
      failed: []
    }),
    adjustStockQuantity: vi.fn().mockResolvedValue({ id: 1, inventory_code: 'I001', quantity: 5 }),
    createBorrowFromInventory: vi.fn().mockResolvedValue({ id: 1, product_id: 1, quantity: 1 }),
    processBorrowToReturn: vi.fn().mockResolvedValue({ ok: true }),
    processBorrowFromReturn: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides
  }
}

describe('InventoriesService fiscal year guard', () => {
  let db
  let service
  let repository

  beforeEach(async () => {
    db = createTestDb()
    await createFiscalYearsSchema(db)
    await seedTwoTenantsWithUsers(db)
    await seedFiscalYears(db)
    repository = makeRepository(db)
    service = new InventoriesService(repository)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('bulkImport rejects when fiscal year is closed for purchase date', async () => {
    await expect(
      service.bulkImport(1, [{ product_name: 'A', quantity: 1 }], { purchase_date: '2025-06-15' })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('is closed')
    })
    expect(repository.bulkImport).not.toHaveBeenCalled()
  })

  it('bulkImport proceeds when fiscal year is open', async () => {
    const result = await service.bulkImport(
      1,
      [{ product_name: 'A', quantity: 1 }],
      { purchase_date: '2026-06-15' }
    )
    expect(result.successful).toBe(1)
    expect(repository.bulkImport).toHaveBeenCalled()
  })

  it('adjustStock rejects when fiscal year is closed', async () => {
    await expect(
      service.adjustStock(1, 1, { adjustmentType: 'add', amount: 1, adjustmentDate: '2025-06-15' })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.adjustStockQuantity).not.toHaveBeenCalled()
  })

  it('createBorrowFrom rejects when tenant has no open fiscal year for today', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-01-15T12:00:00Z'))

    await expect(
      service.createBorrowFrom(1, { partnerId: 1, productId: 1, purchasePrice: 10, quantity: 1 })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('No fiscal year covers')
    })
    expect(repository.createBorrowFromInventory).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('processBorrowToReturn rejects closed fiscal year for return date', async () => {
    await expect(
      service.processBorrowToReturn(1, {
        borrowToInventoryId: 1,
        returnedDate: '2025-06-15',
        quantityReturned: 1
      })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.processBorrowToReturn).not.toHaveBeenCalled()
  })

  it('processBorrowFromReturn rejects closed fiscal year for returnedOn', async () => {
    await expect(
      service.processBorrowFromReturn(1, {
        borrowedInventoryId: 1,
        returningInventoryId: 2,
        quantity: 1,
        returnedOn: '2025-06-15'
      })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.processBorrowFromReturn).not.toHaveBeenCalled()
  })

  it('does not use fiscal year from another tenant', async () => {
    await db('fiscal_years').where({ tenant_id: 2 }).delete()

    await expect(
      service.bulkImport(2, [{ product_name: 'A', quantity: 1 }], { purchase_date: '2026-06-15' })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('No fiscal year covers')
    })
  })
})
