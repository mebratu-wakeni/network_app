export const up = async (knex) => {
  await knex.schema.createTable('customers', (t) => {
    t.bigIncrements('id').primary()
    t.string('name', 255).notNullable()
    t.string('contact_person', 255)
    t.string('phone', 255)
    t.string('email', 255)
    t.text('address')
    t.text('license_no')
    t.string('tin_no', 255)
    t.string('website', 255)
    t.string('fax', 255)
    t.string('country', 255)
    t.text('customer_type').notNullable().defaultTo('supplier')
    t.string('original_table', 255).nullable()
    t.bigInteger('original_id').nullable()
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
  })

  // Add CHECK constraint for customer_type
  await knex.raw(`
    ALTER TABLE customers 
    ADD CONSTRAINT customers_customer_type_check 
    CHECK (customer_type IN ('supplier', 'retailer', 'both', 'other'))
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('customers')
}
