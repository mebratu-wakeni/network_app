export const up = async (knex) => {
  // 1) Add column as nullable to allow backfill
  const hasColumn = await knex.schema.hasColumn('users', 'username')
  if (!hasColumn) {
    await knex.schema.alterTable('users', (t) => {
      t.text('username') // will enforce NOT NULL + UNIQUE after backfill
    })
  }

  // 2) Backfill existing rows: prefer email prefix when available, otherwise fallback to 'user_<id>'
  // Use CASE to handle null emails
  await knex.raw(`
    UPDATE users
    SET username = CASE
      WHEN email IS NOT NULL AND position('@' in email) > 1 THEN split_part(email, '@', 1)
      ELSE 'user_' || id
    END
    WHERE username IS NULL;
  `)

  // 3) Enforce NOT NULL and UNIQUE, and create an index
  await knex.schema.alterTable('users', (t) => {
    t.text('username').notNullable().unique().alter()
  })
}

export const down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('users', 'username')
  if (hasColumn) {
    await knex.schema.alterTable('users', (t) => {
      t.dropColumn('username')
    })
  }
}

