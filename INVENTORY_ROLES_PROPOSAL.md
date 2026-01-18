# Inventory Management Roles Proposal

## Rules Summary

### Product Management Rules (5)
- `CanAddProduct` - Add new products
- `CanImportProducts` - Bulk import products
- `CanExportProducts` - Export product data
- `CanSeeProductDetails` - View product details
- `CanEditProductDetails` - Edit product details

### Stock Management Rules (13)
- `CanImportStock` - Bulk import stock
- `CanExportStock` - Export stock data
- `CanSeeStockDashboard` - View stock dashboard
- `CanSeeTotalStockStat` - View total stock statistics
- `CanSeeExpiredStockStat` - View expired stock statistics
- `CanSeeHighValueStockStat` - View high value stock statistics
- `CanSeeStockItemDetails` - View stock item details
- `CanEditStockItemDetails` - Edit stock item details (except price)
- `CanEditStockItemPrice` - Edit stock item selling price
- `CanAdjustStockItemQuantities` - Adjust quantities (add/subtract/set)
- `CanTransferItemShelf` - Transfer items between locations
- `CanReceiveBorrowedFromStock` - Receive stock borrowed from partners
- `CanReturnBorrowedFromStock` - Return borrowed stock to partners
- `CanReceiveBorrowedToStock` - Receive back stock borrowed to partners

## Proposed Roles

### 1. **Product Manager**
**Purpose:** Manage product catalog
**Rules:**
- CanAddProduct
- CanImportProducts
- CanExportProducts
- CanSeeProductDetails
- CanEditProductDetails

### 2. **Stock Manager**
**Purpose:** Full stock management operations
**Rules:**
- CanImportStock
- CanExportStock
- CanSeeStockDashboard
- CanSeeTotalStockStat
- CanSeeExpiredStockStat
- CanSeeHighValueStockStat
- CanSeeStockItemDetails
- CanEditStockItemDetails
- CanEditStockItemPrice
- CanAdjustStockItemQuantities
- CanTransferItemShelf
- CanReceiveBorrowedFromStock
- CanReturnBorrowedFromStock
- CanReceiveBorrowedToStock

### 3. **Stock Clerk**
**Purpose:** Day-to-day stock operations (no pricing or borrow operations)
**Rules:**
- CanSeeStockDashboard
- CanSeeTotalStockStat
- CanSeeExpiredStockStat
- CanSeeHighValueStockStat
- CanSeeStockItemDetails
- CanEditStockItemDetails
- CanAdjustStockItemQuantities
- CanTransferItemShelf

### 4. **Stock Viewer**
**Purpose:** Read-only access to stock information
**Rules:**
- CanSeeStockDashboard
- CanSeeTotalStockStat
- CanSeeExpiredStockStat
- CanSeeHighValueStockStat
- CanSeeStockItemDetails

### 5. **Borrow Coordinator**
**Purpose:** Manage borrowed stock operations (specialized role)
**Rules:**
- CanSeeStockDashboard
- CanSeeStockItemDetails
- CanReceiveBorrowedFromStock
- CanReturnBorrowedFromStock
- CanReceiveBorrowedToStock

### 6. **Inventory Administrator** (Optional - could be Admin role)
**Purpose:** Full inventory management (products + stock)
**Rules:** All product + stock rules
