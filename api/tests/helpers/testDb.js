import knexModule from 'knex'
import bcrypt from 'bcrypt'
import { DEFAULT_CHART_OF_ACCOUNTS } from '../../src/modules/tenants/defaultChartOfAccounts.js'

export function createTestDb() {
  return knexModule({
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  })
}

export async function createInventorySchema(db) {
  await db.schema.createTable('categories', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable().defaultTo(1)
    table.string('name').notNullable()
  })

  await db.schema.createTable('units', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable().defaultTo(1)
    table.string('name').notNullable()
  })

  await db.schema.createTable('products', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable().defaultTo(1)
    table.string('product_code')
    table.string('name').notNullable()
    table.string('description')
    table.integer('category_id')
    table.integer('unit_id')
    table.integer('expiry_threshold')
    table.timestamp('created_at')
    table.timestamp('last_updated')
  })

  await db.schema.createTable('bin_cards', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable().defaultTo(1)
    table.integer('product_id').notNullable()
    table.integer('inventory_id')
    table.string('batch_no')
    table.date('expiry_date')
    table.date('transaction_date')
    table.string('transaction_type')
    table.integer('reference_id')
    table.string('reference_table')
    table.string('document_no')
    table.integer('opening_balance')
    table.integer('quantity_in').defaultTo(0)
    table.integer('quantity_out').defaultTo(0)
    table.integer('balance').notNullable().defaultTo(0)
    table.decimal('unit_cost', 15, 2)
    table.decimal('total_cost', 15, 2)
    table.string('reason')
    table.text('notes')
    table.integer('created_by')
    table.timestamp('created_at')
  })

  await db.schema.createTable('inventories', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable().defaultTo(1)
    table.integer('product_id').notNullable()
    table.string('inventory_code')
    table.string('batch_no')
    table.date('expiry_date')
    table.date('purchase_date')
    table.string('acquisition_type').defaultTo('cash')
    table.decimal('purchase_price', 15, 2)
    table.integer('quantity').notNullable().defaultTo(0)
    table.decimal('selling_price', 15, 2)
    table.string('location')
    table.timestamp('created_at')
    table.timestamp('last_updated')
  })

  await db.schema.createTable('users', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable().defaultTo(1)
    table.string('display_name')
  })
}

/** Seed default chart of accounts for a tenant (mirrors TenantsService.createTenant). */
export async function seedDefaultChartOfAccountsForTenant(db, tenantId) {
  const level1 = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.level === 1)
  const level2 = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.level === 2)

  const insertedLevel1 = await db('chart_of_accounts')
    .insert(level1.map(({ parent_account_code, ...acc }) => ({ ...acc, tenant_id: tenantId })))
    .returning(['id', 'account_code'])
  const codeToId = new Map(insertedLevel1.map((a) => [a.account_code, a.id]))

  await db('chart_of_accounts').insert(
    level2.map(({ parent_account_code, ...acc }) => ({
      ...acc,
      tenant_id: tenantId,
      parent_account_id: codeToId.get(parent_account_code)
    }))
  )
}

export async function createTenantsSchema(db) {
  await db.schema.createTable('tenants', (table) => {
    table.increments('id').primary()
    table.string('client_code', 32).notNullable().unique()
    table.string('business_name', 255).notNullable()
    table.string('status', 20).notNullable().defaultTo('active')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
}

export async function createPurchaseSchema(db) {
  await createUsersSchema(db)
  await db.schema.createTable('customers', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('customer_code')
    table.string('name').notNullable()
    table.string('contact_person')
    table.string('phone')
    table.string('email')
    table.string('customer_type').notNullable().defaultTo('supplier')
  })
  await db.schema.createTable('products', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('product_code')
    table.string('name').notNullable()
  })
  await db.schema.createTable('purchase_order_items', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('purchase_order_id').notNullable()
    table.integer('product_id').notNullable()
    table.integer('quantity').notNullable()
    table.decimal('unit_price', 15, 2).notNullable()
    table.decimal('total_price', 15, 2).notNullable()
  })
  await db.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('supplier_id')
    table.date('order_date').notNullable()
    table.string('receipt_no').notNullable()
    table.string('payment_mode').defaultTo('cash')
    table.string('payment_status').defaultTo('paid')
    table.decimal('total_amount', 15, 2).defaultTo(0)
    table.decimal('amount_paid', 15, 2).defaultTo(0)
    table.decimal('withhold_amount', 15, 2)
    table.string('status').defaultTo('completed')
    table.text('remark')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
  await db.schema.createTable('purchase_payments', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('purchase_order_id').notNullable()
    table.date('payment_date')
    table.decimal('amount', 15, 2)
    table.string('payment_method')
    table.timestamp('created_at').defaultTo(db.fn.now())
  })
  await db.schema.createTable('purchase_hold_orders', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('supplier_id')
    table.date('order_date').notNullable()
    table.decimal('total_amount', 15, 2).defaultTo(0)
    table.string('payment_mode').defaultTo('cash')
    table.text('items')
    table.string('invoice_no')
    table.text('remark')
    table.decimal('amount_paid', 15, 2)
    table.decimal('withhold_percentage', 5, 2)
    table.decimal('withhold_amount', 15, 2)
    table.decimal('first_payment', 15, 2)
    table.text('cheque_details')
    table.integer('encoder_id')
    table.string('encoder_fullname')
    table.boolean('is_archive').defaultTo(false)
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
}

export async function seedTwoTenantsWithPurchases(db) {
  await seedTwoTenantsWithUsers(db)
  await db('customers').insert([
    { id: 1, tenant_id: 1, customer_code: 'CUST0001', name: 'Supplier A', customer_type: 'supplier' },
    { id: 2, tenant_id: 2, customer_code: 'CUST0001', name: 'Supplier A', customer_type: 'supplier' }
  ])
  await db('purchase_orders').insert([
    {
      id: 1,
      tenant_id: 1,
      supplier_id: 1,
      order_date: '2026-06-01',
      receipt_no: 'PO000001',
      payment_mode: 'cash',
      payment_status: 'paid',
      total_amount: 100,
      amount_paid: 100,
      status: 'completed'
    },
    {
      id: 2,
      tenant_id: 2,
      supplier_id: 2,
      order_date: '2026-06-01',
      receipt_no: 'PO000001',
      payment_mode: 'cash',
      payment_status: 'paid',
      total_amount: 250,
      amount_paid: 250,
      status: 'completed'
    }
  ])
}

export async function createSalesSchema(db) {
  await createUsersSchema(db)
  await db.schema.createTable('customers', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('customer_code')
    table.string('name').notNullable()
    table.string('contact_person')
    table.string('phone')
    table.string('email')
    table.text('address')
    table.string('tin_no')
    table.string('customer_type').notNullable().defaultTo('retailer')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
  await db.schema.createTable('products', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('product_code')
    table.string('name').notNullable()
  })
  await db.schema.createTable('inventories', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('product_id').notNullable()
    table.string('inventory_code')
    table.integer('quantity').notNullable().defaultTo(0)
    table.decimal('purchase_price', 15, 2).defaultTo(0)
    table.string('batch_no')
    table.date('expiry_date')
  })
  await db.schema.createTable('sales_orders', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('customer_id')
    table.date('order_date').notNullable()
    table.string('receipt_no').notNullable()
    table.string('payment_type').defaultTo('cash')
    table.string('payment_status').defaultTo('paid')
    table.decimal('total_amount', 15, 2).defaultTo(0)
    table.decimal('amount_paid', 15, 2).defaultTo(0)
    table.decimal('withhold_amount', 15, 2)
    table.decimal('received_amount', 15, 2)
    table.boolean('withhold_settled').defaultTo(false)
    table.boolean('withhold_confirmation').defaultTo(false)
    table.string('withhold_ref')
    table.string('status').defaultTo('completed')
    table.boolean('is_reversed').defaultTo(false)
    table.integer('fiscal_year')
    table.text('remark')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
  await db.schema.createTable('sales_order_items', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('sales_order_id').notNullable()
    table.integer('product_id').notNullable()
    table.integer('inventory_id').notNullable()
    table.integer('quantity').notNullable()
    table.decimal('unit_price', 15, 2).notNullable()
    table.decimal('total_price', 15, 2).notNullable()
  })
  await db.schema.createTable('sales_hold_orders', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.text('snapshot').notNullable()
    table.integer('customer_id')
    table.date('order_date').notNullable()
    table.decimal('total_amount', 15, 2).defaultTo(0)
    table.string('payment_type').defaultTo('cash')
    table.boolean('is_archive').defaultTo(false)
    table.integer('encoder_id')
    table.string('encoder_fullname')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
}

export async function seedTwoTenantsWithSales(db) {
  await seedTwoTenantsWithUsers(db)
  await db('customers').insert([
    { id: 1, tenant_id: 1, customer_code: 'CUST0001', name: 'Customer A', customer_type: 'retailer' },
    { id: 2, tenant_id: 2, customer_code: 'CUST0001', name: 'Customer A', customer_type: 'retailer' }
  ])
  await db('sales_orders').insert([
    {
      id: 1,
      tenant_id: 1,
      customer_id: 1,
      order_date: '2026-06-01',
      receipt_no: 'SO000001',
      payment_type: 'cash',
      payment_status: 'paid',
      total_amount: 100,
      amount_paid: 100,
      received_amount: 100,
      status: 'completed'
    },
    {
      id: 2,
      tenant_id: 2,
      customer_id: 2,
      order_date: '2026-06-01',
      receipt_no: 'SO000001',
      payment_type: 'cash',
      payment_status: 'paid',
      total_amount: 200,
      amount_paid: 200,
      received_amount: 200,
      status: 'completed'
    }
  ])
}

export async function createCustomersSchema(db) {
  await createUsersSchema(db)
  await db.schema.createTable('customers', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('customer_code')
    table.string('name').notNullable()
    table.string('contact_person')
    table.string('phone')
    table.string('email')
    table.text('address')
    table.text('license_no')
    table.string('tin_no')
    table.string('website')
    table.string('fax')
    table.string('country')
    table.string('customer_type').notNullable().defaultTo('supplier')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
}

export async function seedTwoTenantsWithCustomers(db) {
  await seedTwoTenantsWithUsers(db)
  await db('customers').insert([
    {
      id: 1,
      tenant_id: 1,
      customer_code: 'CUST0001',
      name: 'Supplier One',
      contact_person: 'Alice',
      customer_type: 'supplier'
    },
    {
      id: 2,
      tenant_id: 2,
      customer_code: 'CUST0001',
      name: 'Supplier One',
      contact_person: 'Bob',
      customer_type: 'supplier'
    },
    {
      id: 3,
      tenant_id: 1,
      customer_code: 'CUST0002',
      name: 'Retailer Walk-in',
      contact_person: 'Walk-in Desk',
      customer_type: 'retailer'
    }
  ])
}

export async function createUsersSchema(db) {
  await createTenantsSchema(db)
  await db.schema.createTable('users', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.text('username').notNullable()
    table.text('email')
    table.text('password_hash').notNullable()
    table.text('display_name')
    table.boolean('is_active').notNullable().defaultTo(true)
    table.text('avatar_key')
    table.text('avatar_url')
    table.text('avatar_mime')
    table.integer('avatar_bytes')
    table.integer('avatar_width')
    table.integer('avatar_height')
    table.text('avatar_updated_at')
    table.text('phone')
    table.timestamp('last_login_at')
    table.timestamp('last_password_changed_at')
    table.timestamps(true, true)
    table.unique(['tenant_id', 'username'])
    table.unique(['tenant_id', 'email'])
  })

  await db.schema.createTable('roles', (table) => {
    table.increments('id').primary()
    table.string('name').notNullable().unique()
    table.string('description')
    table.string('color')
  })

  await db.schema.createTable('rules', (table) => {
    table.increments('id').primary()
    table.string('key').notNullable().unique()
    table.string('description')
  })

  await db.schema.createTable('user_roles', (table) => {
    table.increments('id').primary()
    table.integer('user_id').notNullable()
    table.integer('role_id').notNullable()
    table.unique(['user_id', 'role_id'])
  })

  await db.schema.createTable('user_rules', (table) => {
    table.increments('id').primary()
    table.integer('user_id').notNullable()
    table.integer('rule_id').notNullable()
    table.unique(['user_id', 'rule_id'])
  })

  await db.schema.createTable('role_rules', (table) => {
    table.increments('id').primary()
    table.integer('role_id').notNullable()
    table.integer('rule_id').notNullable()
    table.unique(['role_id', 'rule_id'])
  })
}

export async function createFiscalYearsSchema(db) {
  await createUsersSchema(db)
  await db.schema.createTable('fiscal_years', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('fiscal_year').notNullable()
    table.date('start_date').notNullable()
    table.date('end_date').notNullable()
    table.string('status', 20).notNullable().defaultTo('open')
    table.timestamp('closed_at')
    table.integer('closed_by')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
    table.unique(['tenant_id', 'fiscal_year'])
  })
}

export async function createFiscalTransactionSchema(db) {
  await createFiscalYearsSchema(db)

  await db.schema.createTable('account_ledger', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.date('transaction_date').notNullable()
    table.string('account_code')
    table.string('account_name')
    table.decimal('debit').defaultTo(0)
    table.decimal('credit').defaultTo(0)
  })

  await db.schema.createTable('deposits', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.date('deposit_date').notNullable()
    table.decimal('amount')
    table.boolean('is_reversed').defaultTo(false)
  })

  await db.schema.createTable('expenses', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.date('paid_on').notNullable()
    table.decimal('amount')
  })

  await db.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.date('order_date').notNullable()
    table.decimal('total_amount')
  })

  await db.schema.createTable('sales_orders', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.date('order_date').notNullable()
    table.decimal('total_amount')
  })
}

export async function seedTwoTenantsWithUsers(db) {
  await db('tenants').insert([
    { id: 1, client_code: 'TENANT1', business_name: 'Pharmacy One' },
    { id: 2, client_code: 'TENANT2', business_name: 'Pharmacy Two' }
  ])

  const passwordHash = await bcrypt.hash('password123', 4)

  await db('users').insert([
    {
      id: 1,
      tenant_id: 1,
      username: 'admin',
      email: 'admin@one.com',
      password_hash: passwordHash,
      display_name: 'Admin One',
      is_active: true
    },
    {
      id: 2,
      tenant_id: 2,
      username: 'admin',
      email: 'admin@two.com',
      password_hash: passwordHash,
      display_name: 'Admin Two',
      is_active: true
    },
    {
      id: 3,
      tenant_id: 1,
      username: 'staff',
      email: 'staff@one.com',
      password_hash: passwordHash,
      display_name: 'Staff One',
      is_active: true
    }
  ])

  return { passwordHash }
}

export async function seedFiscalYears(db) {
  await db('fiscal_years').insert([
    {
      id: 1,
      tenant_id: 1,
      fiscal_year: 2025,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      status: 'closed'
    },
    {
      id: 2,
      tenant_id: 1,
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'open'
    },
    {
      id: 3,
      tenant_id: 2,
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'open'
    }
  ])
}

export async function createFinancialSchema(db) {
  await createUsersSchema(db)
  await db.schema.createTable('customers', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('customer_code')
    table.string('name').notNullable()
    table.string('customer_type').defaultTo('retailer')
  })
  await db.schema.createTable('expenses', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('customer_id')
    table.text('category').notNullable()
    table.date('paid_on').notNullable()
    table.integer('fiscal_year')
    table.decimal('amount', 15, 2).notNullable()
    table.string('payment_method').defaultTo('cash')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
  await db.schema.createTable('deposits', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.date('deposit_date').notNullable()
    table.integer('fiscal_year')
    table.string('type').defaultTo('deposit')
    table.decimal('amount', 15, 2).notNullable()
    table.boolean('is_reversed').defaultTo(false)
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
  await db.schema.createTable('cash_loans_receivable', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('partner_id').notNullable()
    table.decimal('amount', 15, 2).notNullable()
    table.date('lent_date').notNullable()
    table.integer('fiscal_year')
    table.decimal('returned_amount', 15, 2).defaultTo(0)
    table.string('status').defaultTo('outstanding')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
  await db.schema.createTable('cash_loans_payable', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('partner_id').notNullable()
    table.decimal('amount', 15, 2).notNullable()
    table.date('borrowed_date').notNullable()
    table.integer('fiscal_year')
    table.decimal('repaid_amount', 15, 2).defaultTo(0)
    table.string('status').defaultTo('outstanding')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
  await db.schema.createTable('sales_orders', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('customer_id')
    table.date('order_date').notNullable()
    table.string('receipt_no').notNullable()
    table.string('payment_type').defaultTo('credit')
    table.decimal('total_amount', 15, 2).defaultTo(0)
    table.decimal('withhold_amount', 15, 2)
    table.boolean('withhold_settled').defaultTo(false)
    table.boolean('withhold_confirmation').defaultTo(false)
    table.string('withhold_ref')
    table.string('status').defaultTo('completed')
    table.boolean('is_reversed').defaultTo(false)
    table.text('remark')
  })
  await db.schema.createTable('sales_payments', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('sales_order_id').notNullable()
    table.decimal('amount', 15, 2).notNullable()
  })
  await db.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('supplier_id')
    table.date('order_date').notNullable()
    table.string('receipt_no').notNullable()
    table.decimal('total_amount', 15, 2).defaultTo(0)
    table.decimal('withhold_amount', 15, 2)
    table.boolean('withhold_settled').defaultTo(false)
    table.string('status').defaultTo('completed')
  })
  await db.schema.createTable('purchase_payments', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('purchase_order_id').notNullable()
    table.decimal('amount', 15, 2).notNullable()
  })
}

export async function seedTwoTenantsWithFinancial(db) {
  await seedTwoTenantsWithUsers(db)
  await db('customers').insert([
    { id: 1, tenant_id: 1, customer_code: 'CUST0001', name: 'Partner A', customer_type: 'retailer' },
    { id: 2, tenant_id: 2, customer_code: 'CUST0001', name: 'Partner B', customer_type: 'retailer' }
  ])
  await db('expenses').insert([
    { id: 1, tenant_id: 1, category: 'Utilities', paid_on: '2026-06-01', amount: 50, payment_method: 'cash' },
    { id: 2, tenant_id: 2, category: 'Rent', paid_on: '2026-06-01', amount: 120, payment_method: 'cash' }
  ])
  await db('deposits').insert([
    { id: 1, tenant_id: 1, deposit_date: '2026-06-01', type: 'deposit', amount: 1000 },
    { id: 2, tenant_id: 2, deposit_date: '2026-06-01', type: 'deposit', amount: 2000 }
  ])
  await db('cash_loans_receivable').insert([
    { id: 1, tenant_id: 1, partner_id: 1, amount: 500, lent_date: '2026-06-01' },
    { id: 2, tenant_id: 2, partner_id: 2, amount: 800, lent_date: '2026-06-01' }
  ])
  await db('sales_orders').insert([
    {
      id: 1,
      tenant_id: 1,
      customer_id: 1,
      order_date: '2026-06-01',
      receipt_no: 'SO000001',
      payment_type: 'credit',
      total_amount: 100,
      withhold_amount: 0,
      status: 'completed'
    },
    {
      id: 2,
      tenant_id: 2,
      customer_id: 2,
      order_date: '2026-06-01',
      receipt_no: 'SO000001',
      payment_type: 'credit',
      total_amount: 200,
      withhold_amount: 0,
      status: 'completed'
    }
  ])
  await db('purchase_orders').insert([
    {
      id: 1,
      tenant_id: 1,
      supplier_id: 1,
      order_date: '2026-06-01',
      receipt_no: 'PO000001',
      total_amount: 150,
      withhold_amount: 0,
      status: 'completed'
    },
    {
      id: 2,
      tenant_id: 2,
      supplier_id: 2,
      order_date: '2026-06-01',
      receipt_no: 'PO000001',
      total_amount: 300,
      withhold_amount: 0,
      status: 'completed'
    }
  ])
}

export async function createSettingsSchema(db) {
  await createUsersSchema(db)
  await db.schema.createTable('system_settings', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('setting_key').notNullable()
    table.text('setting_value')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('updated_at').defaultTo(db.fn.now())
    table.unique(['tenant_id', 'setting_key'])
  })
}

export async function seedTwoTenantsWithSettings(db) {
  await seedTwoTenantsWithUsers(db)
  await db('system_settings').insert([
    { tenant_id: 1, setting_key: 'withhold_percentage', setting_value: '2.5' },
    { tenant_id: 1, setting_key: 'company_name', setting_value: 'Pharmacy One' },
    { tenant_id: 2, setting_key: 'withhold_percentage', setting_value: '5' },
    { tenant_id: 2, setting_key: 'company_name', setting_value: 'Pharmacy Two' }
  ])
}

export async function createReportsSchema(db) {
  await createUsersSchema(db)
  await db.schema.createTable('chart_of_accounts', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('account_code').notNullable()
    table.string('account_name').notNullable()
    table.string('account_type').notNullable()
    table.integer('level').notNullable()
    table.integer('parent_account_id')
    table.boolean('is_active').defaultTo(true)
  })
  await db.schema.createTable('account_ledger', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.date('transaction_date').notNullable()
    table.string('account_code').notNullable()
    table.string('account_name')
    table.decimal('debit').defaultTo(0)
    table.decimal('credit').defaultTo(0)
  })
}

export async function seedTwoTenantsWithReports(db) {
  await seedTwoTenantsWithUsers(db)
  await db('chart_of_accounts').insert([
    { id: 1, tenant_id: 1, account_code: '1100', account_name: 'Cash', account_type: 'Asset', level: 2, is_active: true },
    { id: 2, tenant_id: 1, account_code: '5100', account_name: 'Sales', account_type: 'Revenue', level: 2, is_active: true },
    { id: 3, tenant_id: 2, account_code: '1100', account_name: 'Cash', account_type: 'Asset', level: 2, is_active: true },
    { id: 4, tenant_id: 2, account_code: '5100', account_name: 'Sales', account_type: 'Revenue', level: 2, is_active: true }
  ])
  await db('account_ledger').insert([
    { tenant_id: 1, transaction_date: '2026-06-01', account_code: '1100', account_name: 'Cash', debit: 100, credit: 0 },
    { tenant_id: 1, transaction_date: '2026-06-01', account_code: '5100', account_name: 'Sales', debit: 0, credit: 100 },
    { tenant_id: 2, transaction_date: '2026-06-01', account_code: '1100', account_name: 'Cash', debit: 500, credit: 0 },
    { tenant_id: 2, transaction_date: '2026-06-01', account_code: '5100', account_name: 'Sales', debit: 0, credit: 500 }
  ])
}
