export const up = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.string('phone', 32).nullable().after('email');
    table
      .timestamp('last_password_changed_at', { useTz: true })
      .nullable()
      .after('password');
  });
};

export const down = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('phone');
    table.dropColumn('last_password_changed_at');
  });
};