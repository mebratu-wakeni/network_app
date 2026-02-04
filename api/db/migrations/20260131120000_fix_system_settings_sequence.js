/**
 * Fix system_settings id sequence so next INSERT gets max(id)+1.
 * Run this if you see "duplicate key value violates unique constraint system_settings_pkey".
 */
export const up = async (knex) => {
  const client = knex.client.config.client
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(
      "SELECT setval(pg_get_serial_sequence('system_settings', 'id'), COALESCE((SELECT MAX(id) FROM system_settings), 1))"
    )
  }
}

export const down = async () => {
  // No-op: sequence fix is not reversible in a meaningful way
}
