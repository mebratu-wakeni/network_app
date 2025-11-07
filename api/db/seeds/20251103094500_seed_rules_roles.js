export const seed = async (knex) => {
  // Clear existing
  await knex('role_rules').del()
  await knex('user_rules').del()
  await knex('user_roles').del()
  await knex('roles').del()
  await knex('rules').del()

  const ruleKeys = [
    'products.read', 'products.write',
    'sales.read', 'sales.write',
    'purchase.read', 'purchase.write',
    'customers.read', 'customers.write',
    'financials.read', 'financials.write',
    'dashboard.view'
  ]

  const rules = ruleKeys.map((key) => ({ key, description: key }))
  const insertedRules = await knex('rules').insert(rules).returning(['id', 'key'])

  const ruleIdByKey = new Map(insertedRules.map(r => [r.key, r.id]))

  const roles = [
    { name: 'admin', description: 'Full access' },
    { name: 'manager', description: 'Manage core entities' },
    { name: 'viewer', description: 'Read-only' },
  ]
  const insertedRoles = await knex('roles').insert(roles).returning(['id', 'name'])
  const roleIdByName = new Map(insertedRoles.map(r => [r.name, r.id]))

  const allRuleIds = insertedRules.map(r => r.id)
  const viewerRuleIds = insertedRules.filter(r => r.key.endsWith('.read') || r.key === 'dashboard.view').map(r => r.id)
  const managerRuleIds = insertedRules.filter(r => r.key.endsWith('.read') || r.key.endsWith('.write')).map(r => r.id)

  const roleRules = []
  // admin -> all
  for (const rid of allRuleIds) roleRules.push({ role_id: roleIdByName.get('admin'), rule_id: rid })
  // manager -> read + write on domain rules (no special admin-only ones yet)
  for (const rid of managerRuleIds) roleRules.push({ role_id: roleIdByName.get('manager'), rule_id: rid })
  // viewer -> read-only + dashboard.view
  for (const rid of viewerRuleIds) roleRules.push({ role_id: roleIdByName.get('viewer'), rule_id: rid })

  await knex('role_rules').insert(roleRules)
}

