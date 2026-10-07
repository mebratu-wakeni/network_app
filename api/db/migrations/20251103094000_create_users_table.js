export const up = async (knex) => {
  await knex.schema.createTable('users', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.text('email').notNullable()
    t.text('password_hash').notNullable()
    t.text('display_name')
    t.boolean('is_active').notNullable().defaultTo(true)

    t.text('avatar_key')
    t.text('avatar_url')
    t.text('avatar_mime')
    t.integer('avatar_bytes')
    t.integer('avatar_width')
    t.integer('avatar_height')
    t.timestamp('avatar_updated_at', { useTz: true })

    t.timestamps(true, true)

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.unique(['tenant_id', 'email'], 'users_tenant_id_email_unique')
    t.index('tenant_id', 'users_tenant_id_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('users')
}

