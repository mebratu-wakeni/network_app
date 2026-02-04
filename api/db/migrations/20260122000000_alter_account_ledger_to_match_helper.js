export const up = async (knex) => {
  // Drop the old account_ledger table structure
  await knex.schema.dropTableIfExists('account_ledger')

  // Create new account_ledger table matching the helper function pattern
  await knex.schema.createTable('account_ledger', (t) => {
    t.bigIncrements('id').primary()
    t.date('transaction_date').notNullable()
    
    // Account Information (using account_code instead of account_id)
    t.string('account_code', 20).notNullable()
    t.string('account_name', 100).notNullable()
    
    // Double-Entry Accounting (separate debit and credit columns)
    t.decimal('debit', 15, 2).defaultTo(0)
    t.decimal('credit', 15, 2).defaultTo(0)
    t.decimal('balance', 15, 2).notNullable() // Running balance for this account
    
    // Reference Information
    t.string('reference_no', 255) // Changed from reference_number
    t.string('reference_table', 50) // Changed from reference_type
    t.bigInteger('reference_id')
    
    // Transaction Details
    t.text('description').notNullable()
    t.string('transaction_type', 50) // e.g., 'purchase', 'sale', 'adjustment', 'opening_balance'
    
    // Fiscal Period (for reporting)
    t.string('fiscal_year', 4) // YYYY
    t.string('fiscal_period', 2) // MM
    
    // Inventory Integration (optional)
    t.bigInteger('inventory_id')
    
    // Metadata
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    // Foreign Keys
    // Note: account_code foreign key not used as it's a string - validation happens in application layer
    t.foreign('inventory_id').references('id').inTable('inventories').onDelete('SET NULL')
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
    
    // Indexes
    t.index('transaction_date', 'account_ledger_transaction_date_index')
    t.index('account_code', 'account_ledger_account_code_index')
    t.index(['reference_table', 'reference_id'], 'account_ledger_reference_table_id_index')
    t.index('transaction_type', 'account_ledger_transaction_type_index')
    t.index(['fiscal_year', 'fiscal_period'], 'account_ledger_fiscal_period_index')
    t.index('inventory_id', 'account_ledger_inventory_id_index')
  })
}

export const down = async (knex) => {
  // Drop the new structure
  await knex.schema.dropTableIfExists('account_ledger')
  
  // Recreate the old structure
  await knex.schema.createTable('account_ledger', (t) => {
    t.bigIncrements('id').primary()
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
    t.foreign('debit_account_id').references('id').inTable('chart_of_accounts')
    t.foreign('credit_account_id').references('id').inTable('chart_of_accounts')
    t.foreign('inventory_id').references('id').inTable('inventories')
    t.foreign('created_by').references('id').inTable('users')
    
    // Indexes
    t.index('transaction_date', 'account_ledger_transaction_date_index')
    t.index('debit_account_id', 'account_ledger_debit_account_id_index')
    t.index('credit_account_id', 'account_ledger_credit_account_id_index')
    t.index(['reference_type', 'reference_id'], 'account_ledger_reference_type_id_index')
    t.index('inventory_id', 'account_ledger_inventory_id_index')
  })
}
