import bcrypt from 'bcrypt'

export const seed = async (knex) => {
  const existing = await knex('admin_users').where({ username: 'admin' }).first()
  if (existing) return // don't re-seed if already exists

  const password_hash = await bcrypt.hash('adminuser', 10)
  await knex('admin_users').insert({
    username: 'admin',
    password_hash,
    display_name: 'License Administrator',
    is_active: true
  })
  console.log('Seeded admin user: admin / adminuser  — change this password immediately.')
}
