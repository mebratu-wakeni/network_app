export const up = async (knex) => {
  await knex.schema.createTable('users', (t) => {
    t.bigIncrements('id').primary()
    t.text('email').notNullable().unique()
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
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('users')
}

