/**
 * Seed: ensure a single "Walk-in" customer exists for expenses/sales.
 * Idempotent: only inserts if no customer with name 'Walk-in' exists (case-insensitive).
 */
export const seed = async (knex) => {
  const existing = await knex('customers')
    .whereRaw('LOWER(TRIM(name)) = ?', ['walk-in'])
    .first()

  if (existing) return

  await knex('customers').insert({
    name: 'Walk-in',
    customer_type: 'other',
    contact_person: null,
    phone: null,
    email: null,
    address: null,
  })
}
