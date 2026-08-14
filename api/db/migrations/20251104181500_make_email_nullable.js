export const up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('users', 'email')
  if (hasColumn) {
    await knex.schema.alterTable('users', (t) => {
      t.text('email').nullable().alter()
    })
  }
}

export const down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('users', 'email')
  if (hasColumn) {
    // Backfill NULL emails so we can set NOT NULL (rollback would otherwise fail)
    await knex('users')
      .whereNull('email')
      .update({
        email: knex.raw("'user_' || id || '@local'")
      })
    await knex.schema.alterTable('users', (t) => {
      t.text('email').notNullable().alter()
    })
  }
}

