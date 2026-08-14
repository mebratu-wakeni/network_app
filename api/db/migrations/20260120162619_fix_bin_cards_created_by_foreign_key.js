export const up = async (knex) => {
  const client = knex.client.config.client
  if (client === 'sqlite3') return
  // Drop the existing foreign key constraint
  await knex.raw(`
    ALTER TABLE bin_cards 
    DROP CONSTRAINT IF EXISTS bin_cards_created_by_foreign;
  `);

  // Recreate the foreign key with SET NULL on delete
  await knex.raw(`
    ALTER TABLE bin_cards 
    ADD CONSTRAINT bin_cards_created_by_foreign 
    FOREIGN KEY (created_by) 
    REFERENCES users(id) 
    ON DELETE SET NULL;
  `);
}

export const down = async (knex) => {
  const client = knex.client.config.client
  if (client === 'sqlite3') return
  // Drop the new constraint
  await knex.raw(`
    ALTER TABLE bin_cards 
    DROP CONSTRAINT IF EXISTS bin_cards_created_by_foreign;
  `);

  // Restore the original constraint (without ON DELETE action, defaults to RESTRICT)
  await knex.raw(`
    ALTER TABLE bin_cards 
    ADD CONSTRAINT bin_cards_created_by_foreign 
    FOREIGN KEY (created_by) 
    REFERENCES users(id);
  `);
}
