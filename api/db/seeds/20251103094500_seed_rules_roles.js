import bcrypt from 'bcrypt'
export const seed = async (knex) => {
  // Clear existing
  await knex('role_rules').del()
  await knex('user_rules').del()
  await knex('user_roles').del()
  await knex('roles').del()
  await knex('rules').del()

  const rules = [
    // User management rules
    { key: 'CanSeeUsers', description: 'Can see user details and access levels' },
    { key: 'CanEditUsers', description: 'Can edit user details and access levels' },
    
    // Product management rules
    { key: 'CanAddProduct', description: 'Can add new products to the catalog' },
    { key: 'CanImportProducts', description: 'Can import products via bulk import' },
    { key: 'CanExportProducts', description: 'Can export product data' },
    { key: 'CanSeeProductDetails', description: 'Can view product details and information' },
    { key: 'CanEditProductDetails', description: 'Can edit product details and information' },
    
    // Stock/Inventory management rules
    { key: 'CanImportStock', description: 'Can import stock via bulk import' },
    { key: 'CanExportStock', description: 'Can export stock/inventory data' },
    { key: 'CanSeeStockDashboard', description: 'Can view the stock dashboard' },
    { key: 'CanSeeTotalStockStat', description: 'Can view total stock statistics' },
    { key: 'CanSeeExpiredStockStat', description: 'Can view expired stock statistics' },
    { key: 'CanSeeHighValueStockStat', description: 'Can view high value stock statistics' },
    { key: 'CanSeeStockItemDetails', description: 'Can view individual stock item details' },
    { key: 'CanEditStockItemDetails', description: 'Can edit stock item details (except selling price)' },
    { key: 'CanEditStockItemPrice', description: 'Can edit stock item selling price' },
    { key: 'CanReceiveBorrowedFromStock', description: 'Can receive stock items borrowed from partners (temporary receipt)' },
    { key: 'CanReturnBorrowedFromStock', description: 'Can return stock items that were borrowed from partners (settling borrowed items)' },
    { key: 'CanReceiveBorrowedToStock', description: 'Can receive back stock items that were borrowed to partners (getting items back)' },
    { key: 'CanAdjustStockItemQuantities', description: 'Can adjust stock item quantities (add, subtract, set)' },
    { key: 'CanTransferItemShelf', description: 'Can transfer stock items between locations/shelves' }
  ]

  // const rules = ruleKeys.map((key) => ({ key, description: key }))
  const insertedRules = await knex('rules').insert(rules).returning(['id', 'key'])

  const ruleIdByKey = new Map(insertedRules.map(r => [r.key, r.id]))

  const roles = [
    { name: 'Admin', description: 'Full access', color: '#f44336' },
    { name: 'Manager', description: 'Manage core elements', color: '#2196f3' },
    { name: 'Product Manager', description: 'Manage product catalog', color: '#4caf50' },
    { name: 'Stock Manager', description: 'Full stock management operations', color: '#ff9800' },
    { name: 'Stock Clerk', description: 'Day-to-day stock operations', color: '#9c27b0' },
    { name: 'Stock Viewer', description: 'Read-only access to stock information', color: '#607d8b' },
    { name: 'Borrow Coordinator', description: 'Manage borrowed stock operations', color: '#00bcd4' },
  ]
  const insertedRoles = await knex('roles').insert(roles).returning(['id', 'name'])
  const roleIdByName = new Map(insertedRoles.map(r => [r.name, r.id]))

  // Rule categories
  const allRuleIds = insertedRules.map(r => r.id)
  const userManagementRuleIds = insertedRules.filter(r => r.key.startsWith('CanSeeUsers') || r.key.startsWith('CanEditUsers')).map(r => r.id)
  const productRuleIds = insertedRules.filter(r => r.key.startsWith('CanAddProduct') || r.key.startsWith('CanImportProducts') || r.key.startsWith('CanExportProducts') || r.key.startsWith('CanSeeProductDetails') || r.key.startsWith('CanEditProductDetails')).map(r => r.id)
  const stockRuleIds = insertedRules.filter(r => r.key.startsWith('CanImportStock') || r.key.startsWith('CanExportStock') || r.key.startsWith('CanSeeStock') || r.key.startsWith('CanEditStock') || r.key.startsWith('CanAdjustStock') || r.key.startsWith('CanTransferItem') || r.key.startsWith('CanReceiveBorrowed') || r.key.startsWith('CanReturnBorrowed')).map(r => r.id)
  const stockViewRuleIds = insertedRules.filter(r => r.key === 'CanSeeStockDashboard' || r.key === 'CanSeeTotalStockStat' || r.key === 'CanSeeExpiredStockStat' || r.key === 'CanSeeHighValueStockStat' || r.key === 'CanSeeStockItemDetails').map(r => r.id)
  const stockOperationsRuleIds = [...stockViewRuleIds, ...insertedRules.filter(r => r.key === 'CanEditStockItemDetails' || r.key === 'CanAdjustStockItemQuantities' || r.key === 'CanTransferItemShelf').map(r => r.id)]
  const borrowRuleIds = [ruleIdByKey.get('CanSeeStockDashboard'), ruleIdByKey.get('CanSeeStockItemDetails'), ruleIdByKey.get('CanReceiveBorrowedFromStock'), ruleIdByKey.get('CanReturnBorrowedFromStock'), ruleIdByKey.get('CanReceiveBorrowedToStock')].filter(id => id !== undefined)

  const roleRules = []
  // Admin -> all rules
  for (const rid of allRuleIds) roleRules.push({ role_id: roleIdByName.get('Admin'), rule_id: rid })
  
  // Manager -> all inventory rules (products + stock), no user management
  for (const rid of [...productRuleIds, ...stockRuleIds]) roleRules.push({ role_id: roleIdByName.get('Manager'), rule_id: rid })
  
  // Product Manager -> all product rules
  for (const rid of productRuleIds) roleRules.push({ role_id: roleIdByName.get('Product Manager'), rule_id: rid })
  
  // Stock Manager -> all stock rules
  for (const rid of stockRuleIds) roleRules.push({ role_id: roleIdByName.get('Stock Manager'), rule_id: rid })
  
  // Stock Clerk -> stock viewing + operations (no pricing, no borrow)
  for (const rid of stockOperationsRuleIds) roleRules.push({ role_id: roleIdByName.get('Stock Clerk'), rule_id: rid })
  
  // Stock Viewer -> read-only stock rules
  for (const rid of stockViewRuleIds) roleRules.push({ role_id: roleIdByName.get('Stock Viewer'), rule_id: rid })
  
  // Borrow Coordinator -> borrow operations + viewing
  for (const rid of borrowRuleIds) roleRules.push({ role_id: roleIdByName.get('Borrow Coordinator'), rule_id: rid })

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

