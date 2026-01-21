export const up = async (knex) => {
  await knex.schema.alterTable('products', (t) => {
    t.integer('expiry_threshold').defaultTo(30).comment('Number of days before expiry to consider as "expiring soon"');
  });
}

export const down = async (knex) => {
  await knex.schema.alterTable('products', (t) => {
    t.dropColumn('expiry_threshold');
  });
}
