export const up = async (knex) => {
  const client = knex.client.config.client
  const isPg = client === 'pg' || client === 'postgres'
  // DATE(...) already returns text on SQLite; on Postgres it returns a `date`, so
  // cast to text before COALESCE-ing with '' to avoid "invalid input syntax for type date".
  const dateAsText = (expr) => (isPg ? `DATE(${expr})::text` : `DATE(${expr})`)

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
  
  // Update existing records to link them to their corresponding inventories
  // Match by product_id, batch_no, expiry_date, and unit_cost
  await knex.raw(`
    UPDATE borrow_from_inventories
    SET inventory_id = (
      SELECT i.id
      FROM inventories i
      WHERE i.product_id = borrow_from_inventories.product_id
        AND COALESCE(i.batch_no, '') = COALESCE(borrow_from_inventories.batch_no, '')
        AND COALESCE(${dateAsText('i.expiry_date')}, '') = COALESCE(${dateAsText('borrow_from_inventories.expiry_date')}, '')
        AND i.purchase_price = borrow_from_inventories.unit_cost
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
  
  const nullRows = nullCheck.rows || nullCheck
  const nullCount = parseInt(nullRows[0]?.null_count || 0, 10)
  
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
      UPDATE borrow_from_inventories
      SET inventory_id = (
        SELECT i.id
        FROM inventories i
        WHERE i.product_id = borrow_from_inventories.product_id
          AND i.purchase_price = borrow_from_inventories.unit_cost
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
    
    const nullAfterRows = nullCheckAfter.rows || nullCheckAfter
    const nullCountAfter = parseInt(nullAfterRows[0]?.null_count || 0, 10)
    
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
      
      const finalRows = finalNullCheck.rows || finalNullCheck
      const finalNullCount = parseInt(finalRows[0]?.null_count || 0, 10)
      
      if (finalNullCount > 0) {
        throw new Error(
          `Unexpected: ${finalNullCount} records still have NULL inventory_id after cleanup. ` +
          `This should not happen.`
        )
      }
    }
  }
  
  // Add FK on PostgreSQL (SQLite would require table rebuild for alter-table FK changes).
  if (client === 'pg' || client === 'postgres') {
    await knex.schema.alterTable('borrow_from_inventories', (t) => {
      t.foreign('inventory_id').references('id').inTable('inventories').onDelete('RESTRICT')
    })
  }

  await knex.raw('CREATE INDEX IF NOT EXISTS borrow_from_inventories_inventory_id_index ON borrow_from_inventories (inventory_id)')
}

export const down = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.alterTable('borrow_from_inventories', (t) => {
    if (client === 'pg' || client === 'postgres') t.dropForeign(['inventory_id'])
    t.dropIndex('inventory_id', 'borrow_from_inventories_inventory_id_index')
    t.dropColumn('inventory_id')
  })
}
