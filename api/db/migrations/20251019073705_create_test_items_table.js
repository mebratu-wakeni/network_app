// filepath: /Users/mebratuwakeni/Documents/logistic-app/api/db/migrations/2025MMDDHHMMSS_create_test_items_table.js
export const up = async (knex) => {
  await knex.schema.createTable('test_items', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.integer('quantity').defaultTo(0);
    table.timestamps(true, true);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('test_items');
};