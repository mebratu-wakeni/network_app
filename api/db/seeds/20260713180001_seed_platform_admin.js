import bcrypt from 'bcrypt'

export const seed = async (knex) => {
  const existing = await knex('platform_admins').where({ username: 'masaadmin' }).first()
  if (existing) return // don't re-seed if already exists

  const password_hash = await bcrypt.hash('changeme123', 10)
  await knex('platform_admins').insert({
    username: 'masaadmin',
    password_hash,
    display_name: 'Platform Administrator',
    is_active: true
  })
  console.log('Seeded platform admin: masaadmin / changeme123 — change this password immediately.')
}
