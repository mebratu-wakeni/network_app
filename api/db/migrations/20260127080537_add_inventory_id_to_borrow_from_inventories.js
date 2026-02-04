export const up = async (knex) => {
  // Check if column already exists (from previous migration attempt)
  const columnExists = await knex.schema.hasColumn('borrow_from_inventories', 'inventory_id')
  
  if (!columnExists) {
    // Add the column as nullable to handle existing records
    await knex.schema.alterTable('borrow_from_inventories', (t) => {
      t.bigInteger('inventory_id').nullable()
    })
  } else {
    console.log('Column inventory_id already exists, skipping column creation')
  }
  
  // Check if column is currently nullable
  const columnInfo = await knex.raw(`
    SELECT is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'borrow_from_inventories' 
      AND column_name = 'inventory_id'
  `)
  
  const isNullable = columnInfo.rows[0]?.is_nullable === 'YES'
  
  // Update existing records to link them to their corresponding inventories
  // Match by product_id, batch_no, expiry_date, and unit_cost
  await knex.raw(`
    UPDATE borrow_from_inventories bfi
    SET inventory_id = (
      SELECT i.id
      FROM inventories i
      WHERE i.product_id = bfi.product_id
        AND COALESCE(i.batch_no, '') = COALESCE(bfi.batch_no, '')
        AND COALESCE(i.expiry_date::text, '') = COALESCE(bfi.expiry_date::text, '')
        AND i.purchase_price = bfi.unit_cost
        AND i.acquisition_type = 'borrow'
      ORDER BY i.id DESC
      LIMIT 1
    )
    WHERE inventory_id IS NULL
  `)
  
  // Check if there are any NULL values remaining
  const nullCheck = await knex.raw(`
    SELECT COUNT(*) as null_count
    FROM borrow_from_inventories
    WHERE inventory_id IS NULL
  `)
  
  const nullCount = parseInt(nullCheck.rows[0]?.null_count || 0, 10)
  
  if (nullCount > 0) {
    // Get details of records that couldn't be matched
    const unmatchedRecords = await knex.raw(`
      SELECT id, product_id, batch_no, expiry_date, unit_cost, borrowed_date
      FROM borrow_from_inventories
      WHERE inventory_id IS NULL
      LIMIT 10
    `)
    
    console.warn(`Warning: Found ${nullCount} borrow_from_inventories records without matching inventory.`)
    console.warn('Sample unmatched records:', unmatchedRecords.rows)
    
    // Try a more lenient match - just match by product_id and unit_cost (ignore batch_no and expiry_date)
    await knex.raw(`
      UPDATE borrow_from_inventories bfi
      SET inventory_id = (
        SELECT i.id
        FROM inventories i
        WHERE i.product_id = bfi.product_id
          AND i.purchase_price = bfi.unit_cost
          AND i.acquisition_type = 'borrow'
        ORDER BY i.id DESC
        LIMIT 1
      )
      WHERE inventory_id IS NULL
    `)
    
    // Check again after lenient match
    const nullCheckAfter = await knex.raw(`
      SELECT COUNT(*) as null_count
      FROM borrow_from_inventories
      WHERE inventory_id IS NULL
    `)
    
    const nullCountAfter = parseInt(nullCheckAfter.rows[0]?.null_count || 0, 10)
    
    if (nullCountAfter > 0) {
      // Get all orphaned records for logging
      const orphanedRecords = await knex.raw(`
        SELECT id, product_id, partner_id, batch_no, expiry_date, unit_cost, quantity, borrowed_date
        FROM borrow_from_inventories
        WHERE inventory_id IS NULL
      `)
      
      console.warn(`Found ${nullCountAfter} orphaned borrow_from_inventories records without matching inventory.`)
      console.warn('Orphaned records:', JSON.stringify(orphanedRecords.rows, null, 2))
      console.warn('These records will be deleted as they are invalid without matching inventory records.')
      
      // Delete orphaned records - they are invalid without matching inventory
      // According to business logic, inventory is always created before borrow_from_inventories
      const deletedCount = await knex('borrow_from_inventories')
        .whereNull('inventory_id')
        .del()
      
      console.log(`Deleted ${deletedCount} orphaned borrow_from_inventories records.`)
      
      // Verify no NULLs remain
      const finalNullCheck = await knex.raw(`
        SELECT COUNT(*) as null_count
        FROM borrow_from_inventories
        WHERE inventory_id IS NULL
      `)
      
      const finalNullCount = parseInt(finalNullCheck.rows[0]?.null_count || 0, 10)
      
      if (finalNullCount > 0) {
        throw new Error(
          `Unexpected: ${finalNullCount} records still have NULL inventory_id after cleanup. ` +
          `This should not happen.`
        )
      }
    }
  }
  
  // Make the column NOT NULL if it's currently nullable
  // Inventory is always created before borrow_from_inventories record
  // This is enforced by the createBorrowFromInventory method which creates inventory first
  if (isNullable) {
    await knex.raw(`
      ALTER TABLE borrow_from_inventories 
      ALTER COLUMN inventory_id SET NOT NULL
    `)
  }
  
  // Check if foreign key already exists and get its name
  const foreignKeyCheck = await knex.raw(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'borrow_from_inventories'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%inventory_id%'
  `)
  
  // Drop existing foreign key if it exists (to recreate with RESTRICT)
  if (foreignKeyCheck.rows.length > 0) {
    const constraintName = foreignKeyCheck.rows[0].constraint_name
    // Safe to use directly since it comes from database metadata
    // PostgreSQL identifiers are quoted to handle special characters
    await knex.raw(`
      ALTER TABLE borrow_from_inventories
      DROP CONSTRAINT IF EXISTS "${constraintName}"
    `)
  }
  
  // Add foreign key constraint with RESTRICT on delete
  // Prevents deletion of inventory if borrow_from_inventories record exists
  // This preserves data integrity - if you need to delete inventory, handle borrow records first
  await knex.schema.alterTable('borrow_from_inventories', (t) => {
    t.foreign('inventory_id').references('id').inTable('inventories').onDelete('RESTRICT')
  })
  
  // Check if index already exists
  const indexCheck = await knex.raw(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'borrow_from_inventories'
      AND indexname = 'borrow_from_inventories_inventory_id_index'
  `)
  
  if (!indexCheck.rows || indexCheck.rows.length === 0) {
    await knex.schema.alterTable('borrow_from_inventories', (t) => {
      t.index('inventory_id', 'borrow_from_inventories_inventory_id_index')
    })
  }
}

export const down = async (knex) => {
  await knex.schema.alterTable('borrow_from_inventories', (t) => {
    t.dropForeign(['inventory_id'])
    t.dropIndex('inventory_id', 'borrow_from_inventories_inventory_id_index')
    t.dropColumn('inventory_id')
  })
}
