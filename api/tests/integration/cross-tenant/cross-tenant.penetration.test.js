/**
 * Cross-tenant penetration tests: full HTTP stack (routes → services → repositories → DB).
 *
 * Two tenants share overlapping receipt numbers and parallel entity ids (1 vs 2).
 * Acting as tenant Alpha, every read/mutation against tenant Beta resources must fail
 * or return only Alpha data — never Beta fingerprints.
 */
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FP,
  createPenetrationApp,
  setupPenetrationDatabase
} from '../../helpers/penetrationHarness.js'

const ctx = vi.hoisted(() => ({
  db: null,
  auth: { tenantId: 1, userId: 1 }
}))

vi.mock('../../../src/db/knex.js', () => {
  function knexCallable(...args) {
    const db = ctx.db
    if (!db) throw new Error('Penetration test DB not initialized')
    return db(...args)
  }

  return {
    default: new Proxy(knexCallable, {
      get(_target, prop) {
        const db = ctx.db
        if (!db) throw new Error('Penetration test DB not initialized')
        const val = db[prop]
        return typeof val === 'function' ? val.bind(db) : val
      }
    })
  }
})

vi.mock('../../../src/middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    authenticate: (req, _res, next) => {
      req.tenantId = ctx.auth.tenantId
      req.user = {
        id: ctx.auth.userId,
        email: 'penetration@test.com',
        display_name: 'Penetration Tester',
        is_active: true,
        rules: []
      }
      next()
    },
    requireTenant: actual.requireTenant,
    requireRules: () => (_req, _res, next) => next(),
    requireAnyRule: () => (_req, _res, next) => next(),
    requireRole: () => (_req, _res, next) => next()
  }
})

function asTenant(tenantKey) {
  const fp = FP[tenantKey]
  ctx.auth.tenantId = fp.tenantId
  ctx.auth.userId = fp.userId
  return fp
}

function expectNoBetaLeak(body, betaFingerprint) {
  const serialized = JSON.stringify(body)
  expect(serialized).not.toContain(betaFingerprint)
}

describe('Cross-tenant penetration (HTTP + real DB)', () => {
  let app
  let db

  beforeEach(async () => {
    db = await setupPenetrationDatabase()
    ctx.db = db
    asTenant('t1')
    app = await createPenetrationApp(ctx.auth)
  })

  afterEach(async () => {
    if (db) await db.destroy()
    ctx.db = null
  })

  describe('requireTenant gate', () => {
    it('rejects requests when tenant context is missing', async () => {
      ctx.auth.tenantId = null

      const res = await request(app).get('/api/customers')
      expect(res.status).toBe(401)
      expect(res.body.error).toMatch(/Tenant context is required/i)
    })
  })

  describe('customers', () => {
    it('GET /customers/:id returns own tenant row only', async () => {
      const own = await request(app).get('/api/customers/1')
      expect(own.status).toBe(200)
      expect(own.body.customer.name).toBe(FP.t1.customerName)

      const cross = await request(app).get(`/api/customers/${FP.t1.otherId}`)
      expect(cross.status).toBe(404)
    })

    it('GET /customers list excludes other tenant rows', async () => {
      const res = await request(app).get('/api/customers')
      expect(res.status).toBe(200)
      expect(res.body.customers).toHaveLength(1)
      expect(res.body.customers[0].name).toBe(FP.t1.customerName)
      expectNoBetaLeak(res.body, FP.t2.customerName)
    })

    it('PUT /customers/:id cannot mutate other tenant row', async () => {
      const before = await db('customers').where({ id: FP.t1.otherId, tenant_id: 2 }).first()

      const res = await request(app)
        .put(`/api/customers/${FP.t1.otherId}`)
        .send({ name: 'Hacked By Alpha' })

      expect(res.status).toBe(404)
      const after = await db('customers').where({ id: FP.t1.otherId, tenant_id: 2 }).first()
      expect(after.name).toBe(before.name)
    })

    it('DELETE /customers/:id cannot delete other tenant row', async () => {
      const res = await request(app).delete(`/api/customers/${FP.t1.otherId}`)
      expect(res.status).toBe(404)
      const row = await db('customers').where({ id: FP.t1.otherId, tenant_id: 2 }).first()
      expect(row).toBeTruthy()
    })
  })

  describe('users', () => {
    it('GET /users/:id cannot read other tenant user', async () => {
      const cross = await request(app).get(`/api/users/${FP.t2.userId}`)
      expect(cross.status).toBe(404)
    })

    it('POST /users/search returns only own tenant users', async () => {
      const res = await request(app).post('/api/users/search').send({ searchQuery: '' })
      expect(res.status).toBe(200)
      const ids = (res.body.users || []).map((u) => u.id)
      expect(ids).toContain(FP.t1.userId)
      expect(ids).not.toContain(FP.t2.userId)
    })
  })

  describe('products & inventory', () => {
    it('POST /products list is tenant-scoped', async () => {
      const res = await request(app).post('/api/products').send({ limit: 50, offset: 0 })
      expect(res.status).toBe(200)
      expect(res.body.products).toHaveLength(1)
      expect(res.body.products[0].name).toBe(FP.t1.productName)
      expectNoBetaLeak(res.body, FP.t2.productName)
    })

    it('GET /products/:id cannot read other tenant product', async () => {
      const cross = await request(app).get(`/api/products/${FP.t1.otherId}`)
      expect(cross.status).toBe(404)
    })

    it('POST /inventories list is tenant-scoped', async () => {
      const res = await request(app).post('/api/inventories').send({ limit: 50, offset: 0 })
      expect(res.status).toBe(200)
      const codes = (res.body.stock || []).map((i) => i.inventoryCode)
      expect(codes).toContain('INV-A1')
      expect(codes).not.toContain('INV-B1')
    })

    it('GET /bin-cards/product/:id cannot read other tenant bin cards', async () => {
      const cross = await request(app).get(`/api/bin-cards/product/${FP.t1.otherId}`)
      expect(cross.status).toBe(200)
      const rows = cross.body.binCards || cross.body.transactions || cross.body.data || []
      expect(rows).toHaveLength(0)
    })
  })

  describe('purchase orders', () => {
    it('GET /purchases/orders/:id cannot read other tenant order', async () => {
      const cross = await request(app).get(`/api/purchases/orders/${FP.t1.otherId}`)
      expect([404, 400]).toContain(cross.status)
    })

    it('GET /purchases/orders list excludes other tenant orders', async () => {
      const res = await request(app).get('/api/purchases/orders')
      expect(res.status).toBe(200)
      const orders = res.body.orders || []
      expect(orders).toHaveLength(1)
      expect(Number(orders[0].net_amount)).toBe(FP.t1.purchaseTotal)
      expectNoBetaLeak(res.body, String(FP.t2.purchaseTotal))
    })
  })

  describe('sales orders', () => {
    it('GET /sales/orders/:id cannot read other tenant order', async () => {
      const cross = await request(app).get(`/api/sales/orders/${FP.t1.otherId}`)
      expect([404, 400]).toContain(cross.status)
    })

    it('GET /sales/orders list excludes other tenant orders', async () => {
      const res = await request(app).get('/api/sales/orders')
      expect(res.status).toBe(200)
      const orders = res.body.orders || []
      expect(orders).toHaveLength(1)
      expect(Number(orders[0].total_amount)).toBe(FP.t1.salesTotal)
      expectNoBetaLeak(res.body, String(FP.t2.salesTotal))
    })
  })

  describe('financial', () => {
    it('GET /financial/expenses/:id cannot read other tenant expense', async () => {
      const cross = await request(app).get(`/api/financial/expenses/${FP.t1.otherId}`)
      expect(cross.status).toBe(404)
    })

    it('GET /financial/expenses list is tenant-scoped', async () => {
      const res = await request(app).get('/api/financial/expenses')
      expect(res.status).toBe(200)
      expect(res.body.expenses).toHaveLength(1)
      expect(res.body.expenses[0].category).toBe(FP.t1.expenseCategory)
      expectNoBetaLeak(res.body, FP.t2.expenseCategory)
    })

    it('GET /financial/deposits/:id cannot read other tenant deposit', async () => {
      const cross = await request(app).get(`/api/financial/deposits/${FP.t1.otherId}`)
      expect(cross.status).toBe(404)
    })

    it('trade receivables summary is tenant-scoped', async () => {
      const res = await request(app).get('/api/financial/receivables/trade')
      expect(res.status).toBe(200)
      expectNoBetaLeak(res.body, String(FP.t2.salesTotal))
    })
  })

  describe('settings', () => {
    it('GET /settings returns only own tenant values', async () => {
      const res = await request(app).get('/api/settings')
      expect(res.status).toBe(200)
      expect(res.body.settings.company_name).toBe(FP.t1.companyName)
      expect(Number(res.body.settings.withhold_percentage)).toBe(Number(FP.t1.withholdPct))
      expectNoBetaLeak(res.body, FP.t2.companyName)
    })

    it('PATCH /settings cannot overwrite other tenant settings via shared keys', async () => {
      await request(app)
        .patch('/api/settings')
        .send({ company_name: 'Alpha Override' })

      const t2Settings = await db('system_settings')
        .where({ tenant_id: 2, setting_key: 'company_name' })
        .first()
      expect(t2Settings.setting_value).toBe(FP.t2.companyName)
    })
  })

  describe('ledger & reports', () => {
    it('GET /ledger/balances returns only own tenant cash', async () => {
      const res = await request(app).get('/api/ledger/balances?codes=1100')
      expect(res.status).toBe(200)
      expect(Number(res.body.balances['1100'])).toBe(FP.t1.cashLedger)
      expect(Number(res.body.balances['1100'])).not.toBe(FP.t2.cashLedger)
    })

    it('GET /reports/balance-sheet uses only own tenant ledger', async () => {
      const res = await request(app).get('/api/reports/balance-sheet?as_of_date=2026-06-30')
      expect(res.status).toBe(200)
      const cashLine = res.body.report.assets.lines.find((l) => l.account_code === '1100')
      expect(cashLine).toBeDefined()
      expect(cashLine.balance).toBe(FP.t1.cashLedger)
      expect(cashLine.balance).not.toBe(FP.t2.cashLedger)
    })
  })

  describe('fiscal years', () => {
    it('GET /fiscal-years list is tenant-scoped', async () => {
      const res = await request(app).get('/api/fiscal-years')
      expect(res.status).toBe(200)
      const years = res.body.fiscal_years || res.body.years || []
      expect(years.length).toBeGreaterThan(0)
      expect(years.every((y) => y.tenant_id === 1 || y.tenant_id == null)).toBe(true)
    })
  })

  describe('bidirectional isolation (tenant Beta)', () => {
    beforeEach(() => {
      asTenant('t2')
    })

    it('tenant Beta cannot read tenant Alpha customer by id', async () => {
      const cross = await request(app).get(`/api/customers/${FP.t2.otherId}`)
      expect(cross.status).toBe(404)
    })

    it('tenant Beta settings differ from Alpha', async () => {
      const res = await request(app).get('/api/settings')
      expect(res.status).toBe(200)
      expect(res.body.settings.company_name).toBe(FP.t2.companyName)
      expectNoBetaLeak(res.body, FP.t1.companyName)
    })

    it('tenant Beta ledger cash differs from Alpha', async () => {
      const res = await request(app).get('/api/ledger/balances?codes=1100')
      expect(res.status).toBe(200)
      expect(Number(res.body.balances['1100'])).toBe(FP.t2.cashLedger)
    })
  })

  describe('mutation hardening', () => {
    it('PUT /users/:id cannot update other tenant user', async () => {
      const before = await db('users').where({ id: FP.t2.userId }).first()
      const res = await request(app)
        .put(`/api/users/${FP.t2.userId}`)
        .send({ display_name: 'Hacked Alpha' })
      expect(res.status).toBe(404)
      const after = await db('users').where({ id: FP.t2.userId }).first()
      expect(after.display_name).toBe(before.display_name)
    })

    it('PUT /products/:id cannot update other tenant product', async () => {
      const before = await db('products').where({ id: FP.t1.otherId, tenant_id: 2 }).first()
      const res = await request(app)
        .put(`/api/products/${FP.t1.otherId}`)
        .send({ name: 'Hacked Product' })
      expect(res.status).toBe(404)
      const after = await db('products').where({ id: FP.t1.otherId, tenant_id: 2 }).first()
      expect(after.name).toBe(before.name)
    })

    it('POST /sales/orders/:id/pay cannot pay other tenant order', async () => {
      const res = await request(app)
        .post(`/api/sales/orders/${FP.t1.otherId}/pay`)
        .send({ payment_amount: 10, payment_date: '2026-06-15', payment_mode: 'cash' })
      expect([404, 400]).toContain(res.status)
    })

    it('PATCH /financial/deposits/:id cannot update other tenant deposit', async () => {
      const before = await db('deposits').where({ id: FP.t1.otherId, tenant_id: 2 }).first()
      const res = await request(app)
        .patch(`/api/financial/deposits/${FP.t1.otherId}`)
        .send({ amount: 9999 })
      expect(res.status).toBe(404)
      const after = await db('deposits').where({ id: FP.t1.otherId, tenant_id: 2 }).first()
      expect(Number(after.amount)).toBe(Number(before.amount))
    })
  })

  describe('JWT tenant binding (real auth service)', () => {
    it('login token tenantId matches user tenant; wrong tenant login fails', async () => {
      const { AuthService } = await import('../../../src/modules/auth/auth.service.js')
      const { UsersService } = await import('../../../src/modules/users/users.service.js')
      const { UsersRepository } = await import('../../../src/modules/users/users.repository.js')
      const { TenantsRepository } = await import('../../../src/modules/tenants/tenants.repository.js')

      const usersRepository = new UsersRepository(db)
      const usersService = new UsersService(usersRepository)
      const tenantsRepository = new TenantsRepository(db)
      const authService = new AuthService(usersService, usersRepository, tenantsRepository)

      const alphaLogin = await authService.login(FP.t1.clientCode, 'admin', 'password123')
      const decodedAlpha = authService.verifyToken(alphaLogin.token)
      expect(decodedAlpha.tenantId).toBe(FP.t1.tenantId)
      expect(decodedAlpha.userId).toBe(FP.t1.userId)

      const betaLogin = await authService.login(FP.t2.clientCode, 'admin', 'password123')
      const decodedBeta = authService.verifyToken(betaLogin.token)
      expect(decodedBeta.tenantId).toBe(FP.t2.tenantId)
      expect(decodedBeta.userId).toBe(FP.t2.userId)

      await expect(
        authService.login('NONEXISTENT', 'admin', 'password123')
      ).rejects.toMatchObject({ status: 401 })
    })
  })
})

describe('Cross-tenant IDOR matrix (repository layer sanity)', () => {
  let db

  beforeEach(async () => {
    db = await setupPenetrationDatabase()
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('parallel id=1 vs id=2 rows never cross-read in repositories', async () => {
    const { CustomersRepository } = await import('../../../src/modules/customers/customers.repository.js')
    const { ProductsRepository } = await import('../../../src/modules/inventory/products.repository.js')
    const { PurchaseRepository } = await import('../../../src/modules/purchase/purchase.repository.js')
    const { SalesRepository } = await import('../../../src/modules/sales/sales.repository.js')
    const { FinancialRepository } = await import('../../../src/modules/financial/financial.repository.js')
    const { SettingsRepository } = await import('../../../src/modules/settings/settings.repository.js')
    const { ReportsRepository } = await import('../../../src/modules/reports/reports.repository.js')

    const customers = new CustomersRepository(db)
    const products = new ProductsRepository(db)
    const purchases = new PurchaseRepository(db)
    const sales = new SalesRepository(db)
    const financial = new FinancialRepository(db)
    const settings = new SettingsRepository(db)
    const reports = new ReportsRepository(db)

    expect((await customers.findById(1, 1)).name).toBe(FP.t1.customerName)
    expect(await customers.findById(1, 2)).toBeUndefined()

    expect((await products.findById(1, 1)).name).toBe(FP.t1.productName)
    expect(await products.findById(1, 2)).toBeUndefined()

    expect((await purchases.getOrderById(1, 1)).order.total_amount).toBe(FP.t1.purchaseTotal)
    expect(await purchases.getOrderById(1, 2)).toBeNull()

    expect((await sales.getOrderById(1, 1)).order.total_amount).toBe(FP.t1.salesTotal)
    expect(await sales.getOrderById(1, 2)).toBeNull()

    expect((await financial.getExpenseById(1, 1)).category).toBe(FP.t1.expenseCategory)
    expect(await financial.getExpenseById(1, 2)).toBeUndefined()

    expect((await settings.getByKey(1, 'company_name'))).toBe(FP.t1.companyName)
    expect((await settings.getByKey(2, 'company_name'))).toBe(FP.t2.companyName)

    const t1Cash = await reports.getClosingBalances(1, '2026-06-30')
    const t2Cash = await reports.getClosingBalances(2, '2026-06-30')
    expect(t1Cash.find((b) => b.account_code === '1100').balance).toBe(FP.t1.cashLedger)
    expect(t2Cash.find((b) => b.account_code === '1100').balance).toBe(FP.t2.cashLedger)
  })
})
