/**
 * Add is_reversed to deposits for reversed entries
 */
export const up = async (knex) => {
  await knex.schema.alterTable('deposits', (t) => {
    t.boolean('is_reversed').defaultTo(false)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('deposits', (t) => {
    t.dropColumn('is_reversed')
  })
}
