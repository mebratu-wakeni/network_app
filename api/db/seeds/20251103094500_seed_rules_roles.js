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
    
    // Customer management rules
    { key: 'CanSeeCustomers', description: 'Can view customer details and information' },
    { key: 'CanAddCustomer', description: 'Can add new customers' },
    { key: 'CanEditCustomer', description: 'Can edit customer details and information' },
    { key: 'CanDeleteCustomer', description: 'Can delete customers' },
    { key: 'CanImportCustomers', description: 'Can import customers via bulk import' },
    { key: 'CanExportCustomers', description: 'Can export customer data' },
    
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
    { key: 'CanReturnBorrowedToStock', description: 'Can return stock items that were borrowed to partners (processing returns from partners)' },
    { key: 'CanAdjustStockItemQuantities', description: 'Can adjust stock item quantities (add, subtract, set)' },
    { key: 'CanTransferItemShelf', description: 'Can transfer stock items between locations/shelves' },
    
    // Purchase management rules
    { key: 'CanCreatePurchase', description: 'Can create new purchase orders' },
    { key: 'CanSeePurchase', description: 'Can view purchase orders and purchase information' },
    { key: 'CanEditPurchase', description: 'Can edit purchase orders (before full payment)' },
    { key: 'CanReversePurchase', description: 'Can reverse purchase orders and void receipts' },
    { key: 'CanPayPurchase', description: 'Can record payments against purchase orders' },
    { key: 'CanHoldPurchase', description: 'Can create and manage hold orders' },
    { key: 'CanImportPurchase', description: 'Can import purchases via bulk import' },

    // Sales management rules (API: sales.routes.js)
    // CanCreateSale -> POST /orders, POST /hold-orders
    // CanSeeSale -> GET withhold-percentage (any), GET/POST/PATCH/DELETE orders & hold-orders (list, details, pay, withhold confirm/rollback, reverse, archive)
    // CanEditSalesPrice -> frontend only: edit unit price on sale line (no API route)
    { key: 'CanCreateSale', description: 'Can create sales orders and hold orders' },
    { key: 'CanSeeSale', description: 'Can view sales orders, list/hold orders, pay, confirm/rollback withhold, reverse' },
    { key: 'CanEditSalesPrice', description: 'Can edit selling price on sale line items (otherwise view-only)' },
    { key: 'CanExportSales', description: 'Can export sales orders and hold orders' },

    { key: 'CanEditSettings', description: 'Can edit system-wide settings (withhold, company info)' }
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
    { name: 'Purchase Manager', description: 'Full purchase management operations', color: '#795548' },
    { name: 'Purchase Clerk', description: 'Day-to-day purchase operations', color: '#e91e63' },
    { name: 'Sales Manager', description: 'Full sales operations; can override selling price', color: '#2e7d32' },
    { name: 'Sales Cashier', description: 'Process sales at default selling price only', color: '#00838f' },
  ]
  const insertedRoles = await knex('roles').insert(roles).returning(['id', 'name'])
  const roleIdByName = new Map(insertedRoles.map(r => [r.name, r.id]))

  // Rule categories
  const allRuleIds = insertedRules.map(r => r.id)
  const userManagementRuleIds = insertedRules.filter(r => r.key.startsWith('CanSeeUsers') || r.key.startsWith('CanEditUsers')).map(r => r.id)
  const productRuleIds = insertedRules.filter(r => r.key.startsWith('CanAddProduct') || r.key.startsWith('CanImportProducts') || r.key.startsWith('CanExportProducts') || r.key.startsWith('CanSeeProductDetails') || r.key.startsWith('CanEditProductDetails')).map(r => r.id)
  const customerRuleIds = insertedRules.filter(r => r.key.startsWith('CanSeeCustomers') || r.key.startsWith('CanAddCustomer') || r.key.startsWith('CanEditCustomer') || r.key.startsWith('CanDeleteCustomer') || r.key.startsWith('CanImportCustomers') || r.key.startsWith('CanExportCustomers')).map(r => r.id)
  const stockRuleIds = insertedRules.filter(r => r.key.startsWith('CanImportStock') || r.key.startsWith('CanExportStock') || r.key.startsWith('CanSeeStock') || r.key.startsWith('CanEditStock') || r.key.startsWith('CanAdjustStock') || r.key.startsWith('CanTransferItem') || r.key.startsWith('CanReceiveBorrowed') || r.key.startsWith('CanReturnBorrowed')).map(r => r.id)
  const stockViewRuleIds = insertedRules.filter(r => r.key === 'CanSeeStockDashboard' || r.key === 'CanSeeTotalStockStat' || r.key === 'CanSeeExpiredStockStat' || r.key === 'CanSeeHighValueStockStat' || r.key === 'CanSeeStockItemDetails').map(r => r.id)
  const stockOperationsRuleIds = [...stockViewRuleIds, ...insertedRules.filter(r => r.key === 'CanEditStockItemDetails' || r.key === 'CanAdjustStockItemQuantities' || r.key === 'CanTransferItemShelf').map(r => r.id)]
  const borrowRuleIds = [ruleIdByKey.get('CanSeeStockDashboard'), ruleIdByKey.get('CanSeeStockItemDetails'), ruleIdByKey.get('CanReceiveBorrowedFromStock'), ruleIdByKey.get('CanReturnBorrowedFromStock'), ruleIdByKey.get('CanReceiveBorrowedToStock'), ruleIdByKey.get('CanReturnBorrowedToStock')].filter(id => id !== undefined)
  const purchaseRuleIds = insertedRules.filter(r => r.key.startsWith('CanCreatePurchase') || r.key.startsWith('CanSeePurchase') || r.key.startsWith('CanEditPurchase') || r.key.startsWith('CanReversePurchase') || r.key.startsWith('CanPayPurchase') || r.key.startsWith('CanHoldPurchase') || r.key.startsWith('CanImportPurchase')).map(r => r.id)
  const purchaseViewRuleIds = insertedRules.filter(r => r.key === 'CanSeePurchase').map(r => r.id)
  const purchaseOperationsRuleIds = [...purchaseViewRuleIds, ...insertedRules.filter(r => r.key === 'CanCreatePurchase' || r.key === 'CanPayPurchase' || r.key === 'CanHoldPurchase').map(r => r.id)]

  const salesRuleIds = insertedRules.filter(r => r.key.startsWith('CanEditSalesPrice') || r.key.startsWith('CanCreateSale') || r.key.startsWith('CanSeeSale')).map(r => r.id)
  const salesApiRuleIds = insertedRules.filter(r => r.key === 'CanCreateSale' || r.key === 'CanSeeSale').map(r => r.id)

  const roleRules = []
  // Admin -> all rules (every permission across all modules)
  for (const rid of allRuleIds) roleRules.push({ role_id: roleIdByName.get('Admin'), rule_id: rid })

  // Manager -> all inventory rules (products + customers + stock + purchases + sales), no user management
  for (const rid of [...productRuleIds, ...customerRuleIds, ...stockRuleIds, ...purchaseRuleIds, ...salesRuleIds]) roleRules.push({ role_id: roleIdByName.get('Manager'), rule_id: rid })
  
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
  
  // Purchase Manager -> all purchase rules
  for (const rid of purchaseRuleIds) roleRules.push({ role_id: roleIdByName.get('Purchase Manager'), rule_id: rid })

  // Purchase Clerk -> purchase viewing + basic operations (create, pay, hold) - no edit/reverse/import
  for (const rid of purchaseOperationsRuleIds) roleRules.push({ role_id: roleIdByName.get('Purchase Clerk'), rule_id: rid })

  // Sales Manager -> all sales rules (CanCreateSale, CanSeeSale, CanEditSalesPrice)
  for (const rid of salesRuleIds) roleRules.push({ role_id: roleIdByName.get('Sales Manager'), rule_id: rid })

  // Sales Cashier -> sales API only (CanCreateSale, CanSeeSale); no CanEditSalesPrice (selling price is view-only)
  for (const rid of salesApiRuleIds) roleRules.push({ role_id: roleIdByName.get('Sales Cashier'), rule_id: rid })

  await knex('role_rules').insert(roleRules);

  // NOTE: roles/rules are global (shared across all tenants) and are the only
  // thing this seed provisions. The initial admin user is NOT created here --
  // in the multi-tenant cloud deployment each tenant gets its own admin user
  // (and its own chart of accounts / walk-in customer) at tenant-creation time.
  // See TenantsService.createTenant() for that per-tenant provisioning step.
}

