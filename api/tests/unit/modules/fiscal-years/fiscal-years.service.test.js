import { describe, expect, it, vi } from 'vitest'
import { FiscalYearsService } from '../../../../src/modules/fiscal-years/fiscal-years.service.js'

function makeRepository(overrides = {}) {
  return {
    listAll: vi.fn(),
    getByYear: vi.fn(),
    getCurrent: vi.fn(),
    getLatestOpen: vi.fn(),
    getAnyOpen: vi.fn(),
    hasOverlappingDates: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getTransactionCountsInRange: vi.fn(),
    getClosingBalances: vi.fn(),
    getReport: vi.fn(),
    ...overrides
  }
}

describe('FiscalYearsService tenant isolation', () => {
  it('listAll delegates tenantId to repository', async () => {
    const repository = makeRepository({
      listAll: vi.fn().mockResolvedValue([{ fiscal_year: 2025, tenant_id: 1 }])
    })
    const service = new FiscalYearsService(repository, {})

    const rows = await service.listAll(1)
    expect(rows).toHaveLength(1)
    expect(repository.listAll).toHaveBeenCalledWith(1)
  })

  it('createFiscalYear checks duplicates and open-year rules within tenant', async () => {
    const repository = makeRepository({
      getByYear: vi.fn().mockResolvedValue(null),
      getAnyOpen: vi.fn().mockResolvedValue({ fiscal_year: 2025 }),
      hasOverlappingDates: vi.fn()
    })
    const service = new FiscalYearsService(repository, {})

    await expect(
      service.createFiscalYear(1, { fiscal_year: 2026, start_date: '2026-01-01', end_date: '2026-12-31' })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('fiscal year 2025 is currently open')
    })

    expect(repository.getAnyOpen).toHaveBeenCalledWith(1)
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('createFiscalYear passes tenantId to repository on success', async () => {
    const repository = makeRepository({
      getByYear: vi.fn().mockResolvedValue(null),
      getAnyOpen: vi.fn().mockResolvedValue(null),
      hasOverlappingDates: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue({ id: 10, tenant_id: 2, fiscal_year: 2026 })
    })
    const service = new FiscalYearsService(repository, {})

    const row = await service.createFiscalYear(2, {
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    })

    expect(row.tenant_id).toBe(2)
    expect(repository.create).toHaveBeenCalledWith(2, {
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    })
  })

  it('deleteFiscalYear uses tenant-scoped transaction counts', async () => {
    const repository = makeRepository({
      getByYear: vi.fn().mockResolvedValue({
        fiscal_year: 2025,
        status: 'open',
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      }),
      getTransactionCountsInRange: vi.fn().mockResolvedValue({
        ledger: 0,
        deposits: 0,
        expenses: 1,
        purchases: 0,
        sales: 0
      })
    })
    const service = new FiscalYearsService(repository, {})

    await expect(service.deleteFiscalYear(1, 2025, false)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('has transactions')
    })

    expect(repository.getTransactionCountsInRange).toHaveBeenCalledWith(1, '2025-01-01', '2025-12-31')
  })

  it('getReport requires closed fiscal year for tenant', async () => {
    const repository = makeRepository({
      getByYear: vi.fn().mockResolvedValue({ fiscal_year: 2025, status: 'open' })
    })
    const service = new FiscalYearsService(repository, {})

    await expect(service.getReport(1, 2025)).rejects.toMatchObject({
      status: 400,
      message: 'Report available only for closed fiscal years'
    })
  })

  it('getCurrent falls back to latest open year for tenant', async () => {
    const repository = makeRepository({
      getCurrent: vi.fn().mockResolvedValue(null),
      getLatestOpen: vi.fn().mockResolvedValue({ fiscal_year: 2025, tenant_id: 1 })
    })
    const service = new FiscalYearsService(repository, {})

    const row = await service.getCurrent(1)
    expect(row.fiscal_year).toBe(2025)
    expect(repository.getCurrent).toHaveBeenCalledWith(1)
    expect(repository.getLatestOpen).toHaveBeenCalledWith(1)
  })
})
