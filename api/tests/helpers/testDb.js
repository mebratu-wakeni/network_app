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
