# Existing Roles: Admin & Manager - Inventory Rules Mapping

## Current State

### Admin
- **Current Assignment:** ALL rules (user management, product management, stock management)
- **Status:** ✅ Already has full inventory access

### Manager  
- **Current Assignment:** Only `CanSeeUsers`
- **Description:** "Manage core elements"
- **Status:** ⚠️ Has NO inventory permissions yet

## Proposed Mapping for Manager Role

Since Manager's description is "Manage core elements", it should have significant inventory management capabilities, but not all admin-level permissions.

### Option 1: Manager as Full Inventory Manager (Recommended)
**Manager gets all inventory operations EXCEPT:**
- User management (stays admin-only)

**Manager Rules:**
- ✅ All Product Management (5 rules)
- ✅ All Stock Management (13 rules)
- ❌ User Management (0 rules)

### Option 2: Manager as Limited Inventory Manager
**Manager gets most operations but EXCLUDES:**
- Pricing control (`CanEditStockItemPrice`) - admin only
- Borrow operations - might be specialized
- User management - admin only

**Manager Rules:**
- ✅ All Product Management (5 rules)
- ✅ Stock viewing and editing (dashboard, stats, details, edit items)
- ✅ Stock adjustments (quantities, transfers)
- ✅ Stock import/export
- ❌ Stock pricing (`CanEditStockItemPrice`)
- ❌ Borrow operations (receive/return borrowed stock)
- ❌ User Management

### Option 3: Manager as Inventory Operations Manager
**Manager can manage operations but not critical/sensitive actions:**

**Manager Rules:**
- ✅ All Product Management (5 rules)
- ✅ Stock viewing (dashboard, stats, details)
- ✅ Stock editing (edit items, adjust quantities, transfer)
- ✅ Stock import/export
- ❌ Stock pricing (`CanEditStockItemPrice`) - financial control
- ❌ Borrow operations - requires coordination
- ❌ User Management

## Recommendation: Option 1

**Rationale:**
- Manager description ("Manage core elements") suggests broad management authority
- Inventory management IS a core business element
- Pricing can still be controlled via business processes/approvals
- Separates system admin (Admin) from business management (Manager)

**Manager would have:**
- Full product catalog management
- Full stock/inventory management
- No user/role management (admin-only)

## Comparison

| Rule Category | Admin | Manager (Option 1) | Manager (Option 2) | Manager (Option 3) |
|--------------|-------|-------------------|-------------------|-------------------|
| User Management | ✅ All | ❌ None | ❌ None | ❌ None |
| Product Management | ✅ All | ✅ All | ✅ All | ✅ All |
| Stock Viewing | ✅ All | ✅ All | ✅ All | ✅ All |
| Stock Editing | ✅ All | ✅ All | ✅ All | ✅ All |
| Stock Pricing | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| Stock Adjustments | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Stock Import/Export | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Borrow Operations | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
