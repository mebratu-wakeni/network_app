export const up = async (knex) => {
  await knex.schema.alterTable('roles', (table) => {
    table.string('color', 32).nullable();
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable('roles', (table) => {
    table.dropColumn('color');
  });
};
