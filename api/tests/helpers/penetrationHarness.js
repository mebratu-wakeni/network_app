import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import knexModule from 'knex'
import bcrypt from 'bcrypt'
import { errorHandler, notFound } from '../../src/middleware/error.js'
import { seedDefaultChartOfAccountsForTenant } from './testDb.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Distinct fingerprints so tests can detect cross-tenant leakage. */
export const FP = {
  t1: {
    tenantId: 1,
    userId: 1,
    clientCode: 'ALPHA',
    customerName: 'Alpha Supplier Co',
    productName: 'Alpha Product X',
    purchaseTotal: 100,
    salesTotal: 200,
    expenseCategory: 'Alpha Utilities',
    depositAmount: 1000,
    withholdPct: '2.5',
    companyName: 'Alpha Pharmacy Ltd',
    cashLedger: 1000,
    otherId: 2
  },
  t2: {
    tenantId: 2,
    userId: 2,
    clientCode: 'BETA',
    customerName: 'Beta Supplier Co',
    productName: 'Beta Product Y',
    purchaseTotal: 500,
    salesTotal: 800,
    expenseCategory: 'Beta Utilities',
    depositAmount: 2000,
    withholdPct: '5',
    companyName: 'Beta Pharmacy Ltd',
    cashLedger: 5000,
    otherId: 1
  }
}

export function makePenetrationDb() {
  return knexModule({
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
    migrations: { directory: path.resolve(__dirname, '../../db/migrations') },
    seeds: { directory: path.resolve(__dirname, '../../db/seeds') }
  })
}

export async function seedPenetrationFixtures(db) {
  await db('tenants').insert([
    { id: 1, client_code: FP.t1.clientCode, business_name: 'Tenant Alpha', status: 'active' },
    { id: 2, client_code: FP.t2.clientCode, business_name: 'Tenant Beta', status: 'active' }
  ])

  const passwordHash = await bcrypt.hash('password123', 4)
  await db('users').insert([
    {
      id: 1,
      tenant_id: 1,
      username: 'admin',
      email: 'admin@alpha.com',
      password_hash: passwordHash,
      display_name: 'Alpha Admin',
      is_active: true
    },
    {
      id: 2,
      tenant_id: 2,
      username: 'admin',
      email: 'admin@beta.com',
      password_hash: passwordHash,
      display_name: 'Beta Admin',
      is_active: true
    }
  ])

  const adminRole = await db('roles').where({ name: 'Admin' }).first()
  await db('user_roles').insert([
    { user_id: 1, role_id: adminRole.id },
    { user_id: 2, role_id: adminRole.id }
  ])

  await seedDefaultChartOfAccountsForTenant(db, 1)
  await seedDefaultChartOfAccountsForTenant(db, 2)

  await db('fiscal_years').insert([
    {
      tenant_id: 1,
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'open'
    },
    {
      tenant_id: 2,
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'open'
    }
  ])

  await db('customers').insert([
    {
      id: 1,
      tenant_id: 1,
      customer_code: 'CUST0001',
      name: FP.t1.customerName,
      customer_type: 'supplier',
      sync_status: 'pending'
    },
    {
      id: 2,
      tenant_id: 2,
      customer_code: 'CUST0001',
      name: FP.t2.customerName,
      customer_type: 'supplier',
      sync_status: 'pending'
    }
  ])

  await db('categories').insert([
    { id: 1, tenant_id: 1, name: 'Alpha Category', sync_status: 'pending' },
    { id: 2, tenant_id: 2, name: 'Beta Category', sync_status: 'pending' }
  ])

  await db('units').insert([
    { id: 1, tenant_id: 1, name: 'Alpha Unit', sync_status: 'pending' },
    { id: 2, tenant_id: 2, name: 'Beta Unit', sync_status: 'pending' }
  ])

  await db('products').insert([
    {
      id: 1,
      tenant_id: 1,
      name: FP.t1.productName,
      product_code: 'APX',
      category_id: 1,
      unit_id: 1,
      sync_status: 'pending'
    },
    {
      id: 2,
      tenant_id: 2,
      name: FP.t2.productName,
      product_code: 'BPY',
      category_id: 2,
      unit_id: 2,
      sync_status: 'pending'
    }
  ])

  await db('inventories').insert([
    {
      id: 1,
      tenant_id: 1,
      product_id: 1,
      inventory_code: 'INV-A1',
      quantity: 10,
      purchase_price: 4,
      purchase_date: '2026-06-01',
      batch_no: 'A-BATCH',
      sync_status: 'pending'
    },
    {
      id: 2,
      tenant_id: 2,
      product_id: 2,
      inventory_code: 'INV-B1',
      quantity: 20,
      purchase_price: 8,
      purchase_date: '2026-06-01',
      batch_no: 'B-BATCH',
      sync_status: 'pending'
    }
  ])

  await db('purchase_orders').insert([
    {
      id: 1,
      tenant_id: 1,
      supplier_id: 1,
      order_date: '2026-06-01',
      payment_mode: 'cash',
      payment_status: 'paid',
      total_amount: FP.t1.purchaseTotal,
      amount_paid: FP.t1.purchaseTotal,
      receipt_no: 'PO000001',
      status: 'completed',
      sync_status: 'pending'
    },
    {
      id: 2,
      tenant_id: 2,
      supplier_id: 2,
      order_date: '2026-06-01',
      payment_mode: 'cash',
      payment_status: 'paid',
      total_amount: FP.t2.purchaseTotal,
      amount_paid: FP.t2.purchaseTotal,
      receipt_no: 'PO000001',
      status: 'completed',
      sync_status: 'pending'
    }
  ])

  await db('sales_orders').insert([
    {
      id: 1,
      tenant_id: 1,
      customer_id: 1,
      order_date: '2026-06-01',
      payment_type: 'cash',
      payment_status: 'paid',
      total_amount: FP.t1.salesTotal,
      amount_paid: FP.t1.salesTotal,
      received_amount: FP.t1.salesTotal,
      receipt_no: 'SO000001',
      status: 'completed',
      is_reversed: false,
      sync_status: 'pending'
    },
    {
      id: 2,
      tenant_id: 2,
      customer_id: 2,
      order_date: '2026-06-01',
      payment_type: 'cash',
      payment_status: 'paid',
      total_amount: FP.t2.salesTotal,
      amount_paid: FP.t2.salesTotal,
      received_amount: FP.t2.salesTotal,
      receipt_no: 'SO000001',
      status: 'completed',
      is_reversed: false,
      sync_status: 'pending'
    }
  ])

  await db('expenses').insert([
    {
      id: 1,
      tenant_id: 1,
      category: FP.t1.expenseCategory,
      paid_on: '2026-06-01',
      amount: 50,
      payment_method: 'cash',
      fiscal_year: 2026
    },
    {
      id: 2,
      tenant_id: 2,
      category: FP.t2.expenseCategory,
      paid_on: '2026-06-01',
      amount: 120,
      payment_method: 'cash',
      fiscal_year: 2026
    }
  ])

  await db('deposits').insert([
    {
      id: 1,
      tenant_id: 1,
      deposit_date: '2026-06-01',
      type: 'deposit',
      amount: FP.t1.depositAmount,
      fiscal_year: 2026,
      is_reversed: false
    },
    {
      id: 2,
      tenant_id: 2,
      deposit_date: '2026-06-01',
      type: 'deposit',
      amount: FP.t2.depositAmount,
      fiscal_year: 2026,
      is_reversed: false
    }
  ])

  await db('system_settings').insert([
    { tenant_id: 1, setting_key: 'withhold_percentage', setting_value: FP.t1.withholdPct },
    { tenant_id: 1, setting_key: 'company_name', setting_value: FP.t1.companyName },
    { tenant_id: 2, setting_key: 'withhold_percentage', setting_value: FP.t2.withholdPct },
    { tenant_id: 2, setting_key: 'company_name', setting_value: FP.t2.companyName }
  ])

  const ledgerBase = {
    transaction_date: '2026-06-01',
    account_code: '1100',
    account_name: 'Cash',
    reference_table: 'deposits',
    reference_id: 1,
    description: 'Seed cash',
    transaction_type: 'deposit',
    balance: 0,
    sync_status: 'pending'
  }

  await db('account_ledger').insert([
    {
      ...ledgerBase,
      tenant_id: 1,
      debit: FP.t1.cashLedger,
      credit: 0,
      balance: FP.t1.cashLedger
    },
    {
      ...ledgerBase,
      tenant_id: 2,
      reference_id: 2,
      debit: FP.t2.cashLedger,
      credit: 0,
      balance: FP.t2.cashLedger
    }
  ])
}

export async function setupPenetrationDatabase() {
  const db = makePenetrationDb()
  await db.migrate.latest()
  await db.seed.run()
  await seedPenetrationFixtures(db)
  return db
}

/**
 * Build Express app with all tenant-scoped routers wired to the test knex proxy.
 * `authState` controls which tenant/user the mocked authenticate middleware injects.
 */
export async function createPenetrationApp(authState) {
  const app = express()
  app.use(express.json())

  const [
    { default: usersRouter },
    { default: customersRouter },
    { default: productsRouter },
    { default: inventoriesRouter },
    { default: binCardsRouter },
    { default: purchasesRouter },
    { default: salesRouter },
    { default: settingsRouter },
    { default: ledgerRouter },
    { default: financialRouter },
    { default: fiscalYearsRouter },
    { default: reportsRouter }
  ] = await Promise.all([
    import('../../src/modules/users/users.routes.js'),
    import('../../src/modules/customers/customers.routes.js'),
    import('../../src/modules/inventory/products.routes.js'),
    import('../../src/modules/inventory/inventories.routes.js'),
    import('../../src/modules/inventory/binCards.routes.js'),
    import('../../src/modules/purchase/purchase.routes.js'),
    import('../../src/modules/sales/sales.routes.js'),
    import('../../src/modules/settings/settings.routes.js'),
    import('../../src/modules/ledger/ledger.routes.js'),
    import('../../src/modules/financial/financial.routes.js'),
    import('../../src/modules/fiscal-years/fiscal-years.routes.js'),
    import('../../src/modules/reports/reports.routes.js')
  ])

  // Store on app for tests that read authState
  app.locals.authState = authState

  app.use('/api/users', usersRouter)
  app.use('/api/customers', customersRouter)
  app.use('/api/products', productsRouter)
  app.use('/api/inventories', inventoriesRouter)
  app.use('/api/bin-cards', binCardsRouter)
  app.use('/api/purchases', purchasesRouter)
  app.use('/api/sales', salesRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/ledger', ledgerRouter)
  app.use('/api/financial', financialRouter)
  app.use('/api/fiscal-years', fiscalYearsRouter)
  app.use('/api/reports', reportsRouter)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
