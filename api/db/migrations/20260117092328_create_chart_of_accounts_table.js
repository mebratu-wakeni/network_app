export const up = async (knex) => {
  await knex.schema.createTable('chart_of_accounts', (t) => {
    t.bigIncrements('id').primary()
    t.string('account_code', 20).notNullable()
    t.string('account_name', 100).notNullable()
    t.string('account_type', 50).notNullable()
    t.string('account_category', 50).notNullable()
    t.bigInteger('parent_account_id')
    t.integer('level').defaultTo(1)
    t.boolean('is_active').defaultTo(true)
    t.text('description')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 20).defaultTo('pending')
    
    t.foreign('parent_account_id').references('id').inTable('chart_of_accounts')
    
    t.unique('account_code', 'chart_of_accounts_account_code_unique')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('chart_of_accounts')
}
