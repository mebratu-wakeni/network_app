export const up = async (knex) => {
  const client = knex.client.config.client
  // 1) Add column as nullable to allow backfill
  const hasColumn = await knex.schema.hasColumn('users', 'username')
  if (!hasColumn) {
    await knex.schema.alterTable('users', (t) => {
      t.text('username') // will enforce NOT NULL + UNIQUE after backfill
    })
  }

  // 2) Backfill existing rows: prefer email prefix when available, otherwise fallback to 'user_<id>'
  // Use CASE to handle null emails
  if (client === 'sqlite3') {
    await knex.raw(`
      UPDATE users
      SET username = CASE
        WHEN email IS NOT NULL AND instr(email, '@') > 1 THEN substr(email, 1, instr(email, '@') - 1)
        ELSE 'user_' || id
      END
      WHERE username IS NULL;
    `)
  } else {
    await knex.raw(`
      UPDATE users
      SET username = CASE
        WHEN email IS NOT NULL AND position('@' in email) > 1 THEN split_part(email, '@', 1)
        ELSE 'user_' || id
      END
      WHERE username IS NULL;
    `)
  }

  // 3) Enforce NOT NULL, and create a per-tenant UNIQUE index (username only needs
  // to be unique within a tenant; different tenants may both have an 'admin' user).
  if (client === 'sqlite3') {
    await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_id_username_unique_idx ON users (tenant_id, username)`)
  } else {
    await knex.schema.alterTable('users', (t) => {
      t.text('username').notNullable().alter()
    })
    await knex.raw(`
      ALTER TABLE users
      ADD CONSTRAINT users_tenant_id_username_unique UNIQUE (tenant_id, username)
    `)
  }
}

export const down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('users', 'username')
  if (hasColumn) {
    await knex.schema.alterTable('users', (t) => {
      t.dropColumn('username')
    })
  }
}

