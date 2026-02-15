export const up = async (knex) => {
  const client = knex.client.config.client
  // Rename the table
  await knex.raw(`
    ALTER TABLE borrow_returns 
    RENAME TO borrow_from_returns;
  `)
  
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER INDEX borrow_returns_borrowed_inventory_id_index 
      RENAME TO borrow_from_returns_borrowed_inventory_id_index;
    `)
    
    await knex.raw(`
      ALTER INDEX borrow_returns_returning_inventory_id_index 
      RENAME TO borrow_from_returns_returning_inventory_id_index;
    `)
    
    await knex.raw(`
      ALTER INDEX borrow_returns_returned_on_index 
      RENAME TO borrow_from_returns_returned_on_index;
    `)
  } else {
    await knex.raw(`DROP INDEX IF EXISTS borrow_returns_borrowed_inventory_id_index`)
    await knex.raw(`DROP INDEX IF EXISTS borrow_returns_returning_inventory_id_index`)
    await knex.raw(`DROP INDEX IF EXISTS borrow_returns_returned_on_index`)
    await knex.raw(`CREATE INDEX IF NOT EXISTS borrow_from_returns_borrowed_inventory_id_index ON borrow_from_returns (borrowed_inventory_id)`)
    await knex.raw(`CREATE INDEX IF NOT EXISTS borrow_from_returns_returning_inventory_id_index ON borrow_from_returns (returning_inventory_id)`)
    await knex.raw(`CREATE INDEX IF NOT EXISTS borrow_from_returns_returned_on_index ON borrow_from_returns (returned_on)`)
  }
}

export const down = async (knex) => {
  const client = knex.client.config.client
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER INDEX borrow_from_returns_borrowed_inventory_id_index 
      RENAME TO borrow_returns_borrowed_inventory_id_index;
    `)
    
    await knex.raw(`
      ALTER INDEX borrow_from_returns_returning_inventory_id_index 
      RENAME TO borrow_returns_returning_inventory_id_index;
    `)
    
    await knex.raw(`
      ALTER INDEX borrow_from_returns_returned_on_index 
      RENAME TO borrow_returns_returned_on_index;
    `)
  } else {
    await knex.raw(`DROP INDEX IF EXISTS borrow_from_returns_borrowed_inventory_id_index`)
    await knex.raw(`DROP INDEX IF EXISTS borrow_from_returns_returning_inventory_id_index`)
    await knex.raw(`DROP INDEX IF EXISTS borrow_from_returns_returned_on_index`)
  }
  
  // Rename the table back
  await knex.raw(`
    ALTER TABLE borrow_from_returns 
    RENAME TO borrow_returns;
  `)
}
