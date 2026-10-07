/**
 * Withhold receivable and payable settlements - batch records for tax authority
 */
export const up = async (knex) => {
  await knex.schema.createTable('withhold_receivable_settlements', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.date('settlement_date').notNullable()
    t.decimal('total_amount', 15, 2).notNullable()
    t.string('reference_no', 255) // tax authority reference
    t.text('notes')
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.index('tenant_id')
    t.index('settlement_date')
  })

  await knex.schema.createTable('withhold_receivable_settlement_items', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.bigInteger('settlement_id').notNullable()
    t.bigInteger('sales_order_id').notNullable()
    t.decimal('withhold_amount', 15, 2).notNullable()

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('settlement_id').references('id').inTable('withhold_receivable_settlements').onDelete('CASCADE')
    t.foreign('sales_order_id').references('id').inTable('sales_orders').onDelete('CASCADE')
    t.index('tenant_id')
    t.index('settlement_id')
  })

  await knex.schema.createTable('withhold_payable_settlements', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.date('settlement_date').notNullable()
    t.decimal('total_amount', 15, 2).notNullable()
    t.string('reference_no', 255) // tax authority reference
    t.text('notes')
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.index('tenant_id')
    t.index('settlement_date')
  })

  await knex.schema.createTable('withhold_payable_settlement_items', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.bigInteger('settlement_id').notNullable()
    t.bigInteger('purchase_order_id').notNullable()
    t.decimal('withhold_amount', 15, 2).notNullable()

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('settlement_id').references('id').inTable('withhold_payable_settlements').onDelete('CASCADE')
    t.foreign('purchase_order_id').references('id').inTable('purchase_orders').onDelete('CASCADE')
    t.index('tenant_id')
    t.index('settlement_id')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('withhold_payable_settlement_items')
  await knex.schema.dropTableIfExists('withhold_payable_settlements')
  await knex.schema.dropTableIfExists('withhold_receivable_settlement_items')
  await knex.schema.dropTableIfExists('withhold_receivable_settlements')
}
