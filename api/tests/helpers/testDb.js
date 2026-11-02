import knexModule from 'knex'

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
    table.string('name').notNullable()
  })

  await db.schema.createTable('units', (table) => {
    table.increments('id').primary()
    table.string('name').notNullable()
  })

  await db.schema.createTable('products', (table) => {
    table.increments('id').primary()
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
    table.integer('product_id').notNullable()
    table.integer('balance').notNullable().defaultTo(0)
    table.timestamp('transaction_date').defaultTo(db.fn.now())
  })
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
    table.timestamps(true, true)
  })
}

export async function createSalesSchema(db) {
  await createUsersSchema(db)
  await db.schema.createTable('customers', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.string('customer_code')
    table.string('name').notNullable()
    table.string('customer_type').notNullable().defaultTo('retailer')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
  await db.schema.createTable('sales_orders', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('customer_id')
    table.date('order_date').notNullable()
    table.string('receipt_no').notNullable()
    table.string('payment_type').defaultTo('cash')
    table.decimal('total_amount', 15, 2).defaultTo(0)
    table.decimal('amount_paid', 15, 2).defaultTo(0)
    table.decimal('withhold_amount', 15, 2)
    table.boolean('withhold_settled').defaultTo(false)
    table.boolean('withhold_confirmation').defaultTo(false)
    table.string('withhold_ref')
    table.string('status').defaultTo('completed')
    table.boolean('is_reversed').defaultTo(false)
    table.text('remark')
    table.timestamp('created_at').defaultTo(db.fn.now())
    table.timestamp('last_updated').defaultTo(db.fn.now())
  })
}
