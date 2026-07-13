export const up = async (knex) => {
  await knex.schema.createTable('account_ledger', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.date('transaction_date').notNullable()
    t.string('reference_number', 255)
    t.string('reference_type', 50)
    t.bigInteger('reference_id')
    
    // Double-Entry Accounting
    t.bigInteger('debit_account_id').notNullable()
    t.bigInteger('credit_account_id').notNullable()
    t.decimal('amount', 15, 2).notNullable()
    
    // Transaction Details
    t.text('description').notNullable()
    t.text('memo')
    
    // Inventory Integration
    t.bigInteger('inventory_id')
    t.integer('quantity')
    
    // Metadata
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('debit_account_id').references('id').inTable('chart_of_accounts')
    t.foreign('credit_account_id').references('id').inTable('chart_of_accounts')
    t.foreign('inventory_id').references('id').inTable('inventories')
    t.foreign('created_by').references('id').inTable('users')
    
    // Indexes
    t.index('tenant_id', 'account_ledger_tenant_id_index')
    t.index('transaction_date', 'account_ledger_transaction_date_index')
    t.index('debit_account_id', 'account_ledger_debit_account_id_index')
    t.index('credit_account_id', 'account_ledger_credit_account_id_index')
    t.index(['reference_type', 'reference_id'], 'account_ledger_reference_type_id_index')
    t.index('inventory_id', 'account_ledger_inventory_id_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('account_ledger')
}
