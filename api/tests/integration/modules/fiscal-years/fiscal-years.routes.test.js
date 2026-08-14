import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler, notFound } from '../../../../src/middleware/error.js'

const mockService = vi.hoisted(() => ({
  listAll: vi.fn(),
  getCurrent: vi.fn(),
  createFiscalYear: vi.fn(),
  closeFiscalYear: vi.fn(),
  reopenFiscalYear: vi.fn(),
  deleteFiscalYear: vi.fn(),
  getReport: vi.fn()
}))

const authState = vi.hoisted(() => ({
  tenantId: 1,
  user: { id: 1 }
}))

vi.mock('../../../../src/middleware/auth.js', () => ({
  authenticate: (req, _res, next) => {
    req.user = authState.user
    req.tenantId = authState.tenantId
    next()
  },
  requireTenant: (req, res, next) => {
    if (!req.tenantId) {
      const error = new Error('Tenant context is required for this request')
      error.status = 401
      return next(error)
    }
    next()
  }
}))

vi.mock('../../../../src/modules/fiscal-years/fiscal-years.service.js', () => ({
  FiscalYearsService: class MockFiscalYearsService {
    listAll = (...args) => mockService.listAll(...args)
    getCurrent = (...args) => mockService.getCurrent(...args)
    createFiscalYear = (...args) => mockService.createFiscalYear(...args)
    closeFiscalYear = (...args) => mockService.closeFiscalYear(...args)
    reopenFiscalYear = (...args) => mockService.reopenFiscalYear(...args)
    deleteFiscalYear = (...args) => mockService.deleteFiscalYear(...args)
    getReport = (...args) => mockService.getReport(...args)
  }
}))

const { default: fiscalYearsRouter } = await import('../../../../src/modules/fiscal-years/fiscal-years.routes.js')

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/fiscal-years', fiscalYearsRouter)
  app.use(notFound)
  app.use(errorHandler)
  return app
}

describe('fiscal-years routes tenant isolation contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.tenantId = 1
    authState.user = { id: 1 }
  })

  it('rejects requests when tenant context is missing', async () => {
    authState.tenantId = null

    const res = await request(createTestApp()).get('/api/fiscal-years')
    expect(res.status).toBe(401)
    expect(mockService.listAll).not.toHaveBeenCalled()
  })

  it('GET / passes tenantId to listAll', async () => {
    mockService.listAll.mockResolvedValueOnce([{ fiscal_year: 2025 }])

    const res = await request(createTestApp()).get('/api/fiscal-years')
    expect(res.status).toBe(200)
    expect(mockService.listAll).toHaveBeenCalledWith(1)
  })

  it('GET /current passes tenantId to getCurrent', async () => {
    mockService.getCurrent.mockResolvedValueOnce({ fiscal_year: 2025 })

    const res = await request(createTestApp()).get('/api/fiscal-years/current')
    expect(res.status).toBe(200)
    expect(mockService.getCurrent).toHaveBeenCalledWith(1)
  })

  it('POST / passes tenantId to createFiscalYear', async () => {
    mockService.createFiscalYear.mockResolvedValueOnce({ fiscal_year: 2026 })

    const res = await request(createTestApp()).post('/api/fiscal-years').send({
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    })

    expect(res.status).toBe(201)
    expect(mockService.createFiscalYear).toHaveBeenCalledWith(1, {
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    })
  })

  it('POST /:year/close and reopen pass tenantId', async () => {
    mockService.closeFiscalYear.mockResolvedValueOnce({ fiscal_year: 2024, status: 'closed' })
    mockService.reopenFiscalYear.mockResolvedValueOnce({ fiscal_year: 2024, status: 'open' })

    const closeRes = await request(createTestApp()).post('/api/fiscal-years/2024/close')
    expect(closeRes.status).toBe(200)
    expect(mockService.closeFiscalYear).toHaveBeenCalledWith(1, '2024', 1)

    const reopenRes = await request(createTestApp()).post('/api/fiscal-years/2024/reopen')
    expect(reopenRes.status).toBe(200)
    expect(mockService.reopenFiscalYear).toHaveBeenCalledWith(1, '2024', 1)
  })

  it('DELETE /:year passes tenantId and force flag', async () => {
    mockService.deleteFiscalYear.mockResolvedValueOnce({ success: true })

    const res = await request(createTestApp()).delete('/api/fiscal-years/2025?force=true')
    expect(res.status).toBe(200)
    expect(mockService.deleteFiscalYear).toHaveBeenCalledWith(1, '2025', true)
  })

  it('GET /:year/report passes tenantId', async () => {
    mockService.getReport.mockResolvedValueOnce({ fiscal_year: { fiscal_year: 2024 } })

    const res = await request(createTestApp()).get('/api/fiscal-years/2024/report')
    expect(res.status).toBe(200)
    expect(mockService.getReport).toHaveBeenCalledWith(1, '2024')
  })
})
