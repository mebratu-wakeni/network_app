export const up = async (knex) => {
  // Rename the table
  await knex.raw(`
    ALTER TABLE borrow_returns 
    RENAME TO borrow_from_returns;
  `)
  
  // Rename indexes
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
}

export const down = async (knex) => {
  // Rename indexes back
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
  
  // Rename the table back
  await knex.raw(`
    ALTER TABLE borrow_from_returns 
    RENAME TO borrow_returns;
  `)
}
