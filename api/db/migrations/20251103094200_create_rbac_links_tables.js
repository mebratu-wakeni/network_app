export const up = async (knex) => {
  await knex.schema.createTable('role_rules', (t) => {
    t.bigInteger('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE')
    t.bigInteger('rule_id').notNullable().references('id').inTable('rules').onDelete('CASCADE')
    t.primary(['role_id', 'rule_id'])
    t.index(['role_id'])
  })

  await knex.schema.createTable('user_roles', (t) => {
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.bigInteger('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE')
    t.primary(['user_id', 'role_id'])
    t.index(['user_id'])
  })

  await knex.schema.createTable('user_rules', (t) => {
    t.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    t.bigInteger('rule_id').notNullable().references('id').inTable('rules').onDelete('CASCADE')
    t.primary(['user_id', 'rule_id'])
    t.index(['user_id'])
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('user_rules')
  await knex.schema.dropTableIfExists('user_roles')
  await knex.schema.dropTableIfExists('role_rules')
}

