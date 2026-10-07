import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BinCardsRepository } from '../../../../src/modules/inventory/binCards.repository.js'
import { createInventorySchema, createTestDb } from '../../../helpers/testDb.js'

describe('BinCardsRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createInventorySchema(db)
    repo = new BinCardsRepository(db)

    await db('products').insert([
      { id: 1, tenant_id: 1, product_code: 'PRD0001', name: 'Product One' },
      { id: 2, tenant_id: 2, product_code: 'PRD0002', name: 'Product Two' }
    ])
    await db('bin_cards').insert([
      {
        id: 1,
        tenant_id: 1,
        product_id: 1,
        transaction_date: '2026-01-01',
        transaction_type: 'received',
        balance: 10,
        quantity_in: 10,
        quantity_out: 0
      },
      {
        id: 2,
        tenant_id: 2,
        product_id: 2,
        transaction_date: '2026-01-01',
        transaction_type: 'received',
        balance: 20,
        quantity_in: 20,
        quantity_out: 0
      }
    ])
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('findByProductId returns rows only for matching tenant and product', async () => {
    const rows = await repo.findByProductId(1, 1, {})
    expect(rows).toHaveLength(1)
    expect(rows[0].balance).toBe(10)

    const crossTenant = await repo.findByProductId(1, 2, {})
    expect(crossTenant).toHaveLength(0)
  })

  it('countByProductId is tenant-scoped', async () => {
    expect(await repo.countByProductId(1, 1, {})).toBe(1)
    expect(await repo.countByProductId(1, 2, {})).toBe(0)
    expect(await repo.countByProductId(2, 2, {})).toBe(1)
  })
})
