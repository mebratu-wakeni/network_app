
export const up = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.timestamp('last_login_at', { useTz: true }).nullable();
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('last_login_at');
  });
};

