import { describe, expect, it, vi } from 'vitest'
import { ProductsService } from '../../../../src/modules/inventory/products.service.js'

function makeRepository(overrides = {}) {
  return {
    findAll: vi.fn(),
    getAllCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'supplies' }]),
    getAllUnits: vi.fn().mockResolvedValue([{ id: 1, name: 'bottle' }]),
    getMaxProductCodeNumber: vi.fn().mockResolvedValue(7),
    getProductNamesLowerSet: vi.fn().mockResolvedValue(new Set()),
    bulkInsertCategories: vi.fn(async (_tenantId, rows) => rows.map((r, idx) => ({ id: 50 + idx, name: r.name }))),
    bulkInsertUnits: vi.fn(async (_tenantId, rows) => rows.map((r, idx) => ({ id: 80 + idx, name: r.name }))),
    createCategory: vi.fn().mockResolvedValue({ id: 5, name: 'new-cat' }),
    createUnit: vi.fn().mockResolvedValue({ id: 8, name: 'new-unit' }),
    findByName: vi.fn().mockResolvedValue(null),
    bulkCreate: vi.fn(async (items) => items.map((item, idx) => ({ id: idx + 100, ...item }))),
    ...overrides
  }
}

describe('ProductsService', () => {
  it('throws when bulkImport receives an empty list', async () => {
    const service = new ProductsService(makeRepository())
    await expect(service.bulkImport(1, [])).rejects.toThrow('Products array is required and must not be empty')
  })

  it('creates missing category/unit once and generates sequential product codes', async () => {
    const repository = makeRepository({
      getAllCategories: vi.fn().mockResolvedValue([]),
      getAllUnits: vi.fn().mockResolvedValue([])
    })
    const service = new ProductsService(repository)

    const result = await service.bulkImport(1, [
      { name: 'Amoxicillin', category: 'Medicine', unit: 'Box' },
      { name: 'Vitamin C', category: 'Medicine', unit: 'Box' }
    ])

    expect(result.successful).toBe(2)
    expect(result.failed).toBe(0)
    expect(repository.bulkInsertCategories).toHaveBeenCalledTimes(1)
    expect(repository.bulkInsertUnits).toHaveBeenCalledTimes(1)
    expect(repository.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ product_code: 'PRD0008', tenant_id: 1 }),
        expect.objectContaining({ product_code: 'PRD0009', tenant_id: 1 })
      ])
    )
  })

  it('returns partial failure summary for duplicates', async () => {
    const repository = makeRepository({
      getProductNamesLowerSet: vi.fn().mockResolvedValue(new Set(['paracetamol']))
    })
    const service = new ProductsService(repository)

    const result = await service.bulkImport(1, [
      { name: 'Paracetamol', category: 'Medicine', unit: 'Bottle' },
      { name: 'Ibuprofen', category: 'Medicine', unit: 'Bottle' }
    ])

    expect(result.total).toBe(2)
    expect(result.successful).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.errors).toBe(0)
    expect(result.warnings).toBe(1)
    expect(result.results[0].success).toBe(false)
    expect(result.results[0].issueKind).toBe('warning')
    expect(result.results[0].error).toContain('already exists')
  })

  it('exports CSV with escaped fields', async () => {
    const repository = makeRepository({
      findAll: vi.fn().mockResolvedValue({
        products: [
          {
            product_code: 'PRD0001',
            name: 'Cough, Syrup',
            description: 'He said "hello"',
            category: 'Medicine',
            unit: 'Bottle',
            balance: 10,
            created_at: '2026-01-01',
            last_updated: '2026-01-02'
          }
        ]
      })
    })
    const service = new ProductsService(repository)

    const csv = await service.exportToCSV(1, {})

    expect(csv).toContain('"Cough, Syrup"')
    expect(csv).toContain('"He said ""hello"""')
    expect(csv.split('\n').length).toBe(2)
  })
})
