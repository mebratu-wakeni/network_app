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
    await knex.schema.alterTable('users', (t) => {
      t.text('email').notNullable().alter()
    })
  }
}

