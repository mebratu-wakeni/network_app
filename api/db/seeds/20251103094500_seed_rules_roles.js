import bcrypt from 'bcrypt'
export const seed = async (knex) => {
  // Clear existing
  await knex('role_rules').del()
  await knex('user_rules').del()
  await knex('user_roles').del()
  await knex('roles').del()
  await knex('rules').del()

  const rules = [
    { key: 'CanSeeUsers', description: 'Can see user details and access levels' },
    { key: 'CanEditUsers', description: 'Can edit user details and access levels' }
  ]

  // const rules = ruleKeys.map((key) => ({ key, description: key }))
  const insertedRules = await knex('rules').insert(rules).returning(['id', 'key'])

  const ruleIdByKey = new Map(insertedRules.map(r => [r.key, r.id]))

  const roles = [
    { name: 'Admin', description: 'Full access', color: '#f44336' },
    { name: 'Manager', description: 'Manage core elements', color: '#2196f3' },
  ]
  const insertedRoles = await knex('roles').insert(roles).returning(['id', 'name'])
  const roleIdByName = new Map(insertedRoles.map(r => [r.name, r.id]))

  const allRuleIds = insertedRules.map(r => r.id)
  const viewerRuleIds = insertedRules.filter(r => r.key === 'CanSeeUsers').map(r => r.id)   

  const roleRules = []
  // admin -> all
  for (const rid of allRuleIds) roleRules.push({ role_id: roleIdByName.get('Admin'), rule_id: rid })
  // manager -> read + write on domain rules (no special admin-only ones yet)
  for (const rid of viewerRuleIds) roleRules.push({ role_id: roleIdByName.get('Manager'), rule_id: rid })

  await knex('role_rules').insert(roleRules);

  

  async function hashPassword(password) {
    const saltRounds = 10
    return bcrypt.hash(password, saltRounds)
  }

  await knex('users').where({username: 'admin'}).del();

  // create admin user 
  const adminUser = {
    username: 'admin',
    display_name: 'Site Administrator',
    password_hash: await hashPassword('adminuser'),
    is_active: true
  }

  // Insert user
  const [insertedAdmin] = await knex('users')
    .insert(adminUser)
    .returning(['id'])

  // Assign the 'Admin' role
  await knex('user_roles').insert({
    user_id: insertedAdmin.id,
    role_id: roleIdByName.get('Admin')
  })
}

