# Inventory Management Database Schema Design

## Overview
This document outlines the database schema design for the inventory management system, including products, inventories, charts of accounts, and account ledger.

---

## 1. Products Table

### Purpose
Stores product catalog information - the master list of all products that can be stocked.

### Schema Design

```sql
CREATE TABLE `products` (
  `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  `product_code` text,                           -- System-generated unique code (e.g., "0001", "PRD001")
  `name` varchar(255) NOT NULL,                  -- Product name (e.g., "Paracetamol 500mg")
  `description` text,                            -- Optional product description
  `category_id` integer,                         -- Foreign key to categories table
  `unit_id` integer,                             -- Foreign key to units table
  `remark` text,                                 -- Additional remarks/notes
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(255) DEFAULT 'pending',
  FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL
);

CREATE UNIQUE INDEX `products_product_code_unique` ON `products` (`product_code`);
CREATE UNIQUE INDEX `uq_product_details` ON `products` (`name`, `description`, `category_id`, `unit_id`);
```

### Key Fields:
- **product_code**: System-generated unique identifier (nullable text, auto-incrementing code)
- **name**: Product name (required, varchar(255))
- **description**: Optional product description
- **category_id**: Links to categories table (e.g., "Reagent", "Supplies") - SET NULL on delete
- **unit_id**: Links to units table (e.g., "Bottle", "PK", "Kit") - SET NULL on delete
- **remark**: Additional remarks/notes field

### Key Constraints:
1. **Unique product_code**: Each product has a unique code (if provided) - prevents duplicate codes
2. **Unique product details** (`uq_product_details`): Prevents duplicate products with same `(name, description, category_id, unit_id)` combination
   - This ensures no duplicate products with identical characteristics
   - Allows same name with different category/unit, but not exact duplicates
3. **Foreign Key Behavior**: `ON DELETE SET NULL` means if category/unit is deleted, product remains but links are cleared (soft relationship)

---

## 2. Inventories Table (Organized)

### Purpose
Stores physical stock items - each row represents a unique stock batch with specific purchase details.

### Schema Design (Organized)

```sql
CREATE TABLE IF NOT EXISTS "inventories" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  
  -- Product Reference
  `product_id` integer NOT NULL,
  
  -- Stock Identification
  `inventory_code` varchar(255) UNIQUE,         -- System-generated unique inventory identifier
  
  -- Batch Information
  `batch_no` text,                              -- Batch/lot number (nullable, can be missing)
  `expiry_date` date,                           -- Product expiry date (nullable for non-perishable)
  
  -- Acquisition Details
  `purchase_date` date NOT NULL,                -- Date stock was acquired
  `acquisition_type` text CHECK (`acquisition_type` IN ('purchase', 'cash', 'credit', 'cheque', 'borrow')) DEFAULT 'cash',
  `purchase_price` float NOT NULL,              -- Original purchase price per unit
  `adjusted_purchase_price` float,              -- Adjusted price (for price corrections/adjustments)
  
  -- Stock Quantity
  `quantity` integer NOT NULL DEFAULT 0,        -- Current quantity in stock
  
  -- Pricing
  `selling_price` float,                        -- Selling price per unit (can override product default)
  
  -- Settlement Status (for accounts payable integration)
  `settlement_status` text CHECK (`settlement_status` IN ('unsettled', 'partially_settled', 'fully_settled')) DEFAULT 'unsettled',
  
  -- Metadata
  `location` varchar(255),                      -- Storage location (e.g., "A-01", "B-03")
  `notes` text,                                 -- Optional notes about this stock item
  
  -- Timestamps
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(255) DEFAULT 'pending',
  
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
);

-- Unique constraint: Same product + batch + expiry + purchase_price = unique inventory item
CREATE UNIQUE INDEX `inventories_product_batch_expiry_price_unique` 
  ON `inventories` (`product_id`, `batch_no`, `expiry_date`, `purchase_price`);

-- Unique constraint: inventory_code must be unique
CREATE UNIQUE INDEX `inventories_inventory_code_unique` 
  ON `inventories` (`inventory_code`);

-- Indexes for common queries
CREATE INDEX `inventories_product_id_index` ON `inventories` (`product_id`);
CREATE INDEX `inventories_settlement_status_index` ON `inventories` (`settlement_status`);
CREATE INDEX `inventories_location_index` ON `inventories` (`location`);
CREATE INDEX `inventories_expiry_date_index` ON `inventories` (`expiry_date`);
CREATE INDEX `inventories_acquisition_type_index` ON `inventories` (`acquisition_type`);
CREATE INDEX `inventories_quantity_index` ON `inventories` (`quantity`);
```

### Key Design Decisions:
1. **Unique Constraint**: Same product + batch_no + expiry_date + purchase_price = unique inventory item
   - Prevents duplicate stock entries
   - Allows multiple entries for same product with different prices/batches
   
2. **Settlement Status**: Tracks payment status for purchased inventory
   - `unsettled`: Not yet paid (for credit purchases)
   - `partially_settled`: Partially paid
   - `fully_settled`: Fully paid
   
3. **Acquisition Type**: How the stock was acquired
   - `purchase`: Regular purchase
   - `cash`: Cash purchase
   - `credit`: Credit purchase (unpaid)
   - `cheque`: Cheque payment
   - `borrow`: Borrowed from supplier/partner
   
4. **Price Fields**:
   - `purchase_price`: Original price
   - `adjusted_purchase_price`: Adjusted price (for corrections)
   - `selling_price`: Override product's default selling price
   
5. **Location**: Stored directly (could be normalized to locations table later)

---

### 2.1 Categories Table (Supporting Table)

### Purpose
Product categories (e.g., "Reagent", "Supplies")

### Schema Design

```sql
CREATE TABLE `categories` (
  `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(255) DEFAULT 'pending'
);

CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);
```

### Key Fields:

- **name**: Category name (required, unique) - e.g., "Reagent", "Supplies", "Equipment"
- **description**: Optional description of the category
- **sync_status**: Status for synchronization (default 'pending')

### Key Constraints:

1. **Unique name**: Each category name must be unique (enforced by unique index)

---

### 2.2 Units Table (Supporting Table)

### Purpose
Measurement units (e.g., "Bottle", "PK", "Kit", "Unit", "Litter")

### Schema Design

```sql
CREATE TABLE `units` (
  `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  `name` varchar(255) NOT NULL,
  `abbreviation` varchar(255),
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(255) DEFAULT 'pending'
);

CREATE UNIQUE INDEX `units_name_unique` ON `units` (`name`);
```

### Key Fields:

- **name**: Unit name (required, unique) - e.g., "Bottle", "Package", "Kit", "Unit", "Liter"
- **abbreviation**: Optional abbreviation for the unit (e.g., "PK" for "Package", "L" for "Liter")
- **sync_status**: Status for synchronization (default 'pending')

### Key Constraints:

1. **Unique name**: Each unit name must be unique (enforced by unique index)

---

## 3. Chart of Accounts Table

### Purpose
Financial chart of accounts - master list of all accounting accounts for financial tracking. Supports hierarchical account structure with parent-child relationships.

### Schema Design

```sql
CREATE TABLE `chart_of_accounts` (
  `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  `account_code` varchar(20) NOT NULL,          -- Unique account code (e.g., "1000", "4001", "5001")
  `account_name` varchar(100) NOT NULL,         -- Account name (e.g., "Cash", "Accounts Payable", "Inventory Asset")
  `account_type` varchar(50) NOT NULL,          -- Type: 'asset', 'liability', 'equity', 'revenue', 'expense'
  `account_category` varchar(50) NOT NULL,      -- Category classification (e.g., "Current Assets", "Revenue", "Operating Expenses")
  `parent_account_id` integer,                  -- Parent account ID for hierarchical structure (nullable for root accounts)
  `level` integer DEFAULT 1,                    -- Hierarchy level (1 = root, 2 = sub-account, etc.)
  `is_active` boolean DEFAULT 1,                -- Active/inactive flag
  `description` text,                           -- Optional account description
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(20) DEFAULT 'pending',
  FOREIGN KEY (`parent_account_id`) REFERENCES `chart_of_accounts` (`id`)
);

CREATE UNIQUE INDEX `chart_of_accounts_account_code_unique` 
  ON `chart_of_accounts` (`account_code`);
```

### Key Fields:

- **account_code**: Unique identifier (varchar(20)) - e.g., "1000", "4001", "5001"
- **account_name**: Name of the account (varchar(100))
- **account_type**: Type classification - one of: 'asset', 'liability', 'equity', 'revenue', 'expense'
- **account_category**: Category classification (varchar(50)) - provides additional grouping beyond type
  - Examples: "Current Assets", "Fixed Assets", "Current Liabilities", "Long-term Liabilities", "Operating Revenue", "Operating Expenses", "Cost of Goods Sold"
- **parent_account_id**: Links to parent account for hierarchical structure (nullable for top-level accounts)
- **level**: Hierarchy level (default 1) - indicates depth in the account tree
  - Level 1: Root accounts (e.g., "Assets", "Liabilities")
  - Level 2: Main accounts (e.g., "Current Assets", "Cash")
  - Level 3+: Sub-accounts (e.g., "Petty Cash", "Bank Account")
- **is_active**: Boolean flag to enable/disable accounts (default true)

### Account Types:
- **asset**: Assets (Cash, Inventory, Accounts Receivable, etc.)
- **liability**: Liabilities (Accounts Payable, Loans, etc.)
- **equity**: Owner's Equity (Capital, Retained Earnings, etc.)
- **revenue**: Income/Revenue (Sales, Service Revenue, etc.)
- **expense**: Expenses (Cost of Goods Sold, Operating Expenses, etc.)

### Hierarchical Structure Example:

```
Assets (Type: asset, Level: 1, Parent: NULL)
  ├─ Current Assets (Type: asset, Level: 2, Parent: Assets)
  │   ├─ Cash (Type: asset, Level: 3, Parent: Current Assets)
  │   │   ├─ Petty Cash (Type: asset, Level: 4, Parent: Cash)
  │   │   └─ Bank Account (Type: asset, Level: 4, Parent: Cash)
  │   ├─ Accounts Receivable (Type: asset, Level: 3, Parent: Current Assets)
  │   └─ Inventory Asset (Type: asset, Level: 3, Parent: Current Assets)
  └─ Fixed Assets (Type: asset, Level: 2, Parent: Assets)
      ├─ Equipment (Type: asset, Level: 3, Parent: Fixed Assets)
      └─ Vehicles (Type: asset, Level: 3, Parent: Fixed Assets)
```

### Common Account Codes (Example Structure):
- **1000-1999**: Assets
  - 1000: Cash
  - 1100: Accounts Receivable
  - 1200: Inventory Asset
- **2000-2999**: Liabilities
  - 2000: Accounts Payable
  - 2100: Accrued Expenses
- **3000-3999**: Equity
  - 3000: Capital
  - 3100: Retained Earnings
- **4000-4999**: Revenue
  - 4000: Sales Revenue
  - 4100: Service Revenue
- **5000-5999**: Expenses
  - 5000: Cost of Goods Sold (COGS)
  - 5100: Operating Expenses

### Key Design Decisions:

1. **Hierarchical Structure**: Parent-child relationships allow for multi-level account organization
2. **Level Tracking**: `level` field makes it easy to query accounts at specific hierarchy depths
3. **Account Category**: Separate from `account_type`, allows for finer-grained classification
4. **Soft Delete**: `is_active` flag allows disabling accounts without deletion (preserves historical data)
5. **Unique Account Code**: Prevents duplicate account codes across the entire chart

---

## 4. Account Ledger Table

### Purpose
General ledger/journal entries - records all financial transactions (double-entry bookkeeping).

### Schema Design

```sql
CREATE TABLE IF NOT EXISTS "account_ledger" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `transaction_date` date NOT NULL,             -- Date of transaction
  `reference_number` varchar(255),              -- Reference number (e.g., invoice #, purchase order #)
  `reference_type` text,                        -- Type of reference (e.g., 'purchase', 'sale', 'adjustment')
  `reference_id` integer,                       -- ID of related record (e.g., purchase_id, sale_id)
  
  -- Double-Entry Accounting
  `debit_account_id` integer NOT NULL,          -- Account to debit
  `credit_account_id` integer NOT NULL,         -- Account to credit
  `amount` decimal(15, 2) NOT NULL,             -- Transaction amount (must be same for debit and credit)
  
  -- Transaction Details
  `description` text NOT NULL,                  -- Description of transaction
  `memo` text,                                  -- Additional notes/memo
  
  -- Inventory Integration
  `inventory_id` integer,                       -- Related inventory item (if applicable)
  `quantity` integer,                           -- Quantity related to this transaction (for inventory)
  
  -- Metadata
  `created_by` integer,                         -- User who created the entry
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(255) DEFAULT 'pending',
  
  FOREIGN KEY (`debit_account_id`) REFERENCES `chart_of_accounts` (`id`),
  FOREIGN KEY (`credit_account_id`) REFERENCES `chart_of_accounts` (`id`),
  FOREIGN KEY (`inventory_id`) REFERENCES `inventories` (`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
);

-- Indexes for common queries
CREATE INDEX `account_ledger_transaction_date_index` 
  ON `account_ledger` (`transaction_date`);
CREATE INDEX `account_ledger_debit_account_id_index` 
  ON `account_ledger` (`debit_account_id`);
CREATE INDEX `account_ledger_credit_account_id_index` 
  ON `account_ledger` (`credit_account_id`);
CREATE INDEX `account_ledger_reference_type_id_index` 
  ON `account_ledger` (`reference_type`, `reference_id`);
CREATE INDEX `account_ledger_inventory_id_index` 
  ON `account_ledger` (`inventory_id`);
```

### Key Design Decisions:
1. **Double-Entry Bookkeeping**: Each transaction has:
   - One debit account (left side)
   - One credit account (right side)
   - Same amount for both (ensuring balanced books)
   
2. **Reference Tracking**: Links transactions to source documents
   - `reference_type`: Type of source (e.g., 'purchase', 'sale', 'stock_adjustment')
   - `reference_id`: ID of the source record
   
3. **Inventory Integration**: Can link ledger entries to inventory items
   - Useful for tracking COGS (Cost of Goods Sold)
   - Links financial records to physical stock

### Example Transactions:

**1. Purchase Inventory (Cash)**
```
Debit:  Inventory Asset (1200)    $1,000
Credit: Cash (1000)               $1,000
Description: "Purchase of Paracetamol 500mg - Batch #B001"
```

**2. Purchase Inventory (Credit)**
```
Debit:  Inventory Asset (1200)         $1,000
Credit: Accounts Payable (2000)        $1,000
Description: "Credit purchase of Bandages - Invoice #INV-001"
```

**3. Sell Inventory**
```
Debit:  Accounts Receivable (1100)     $500
Credit: Sales Revenue (4000)           $500
AND
Debit:  Cost of Goods Sold (5000)      $300
Credit: Inventory Asset (1200)         $300
Description: "Sale of Paracetamol - 10 units"
```

**4. Stock Adjustment (Lost/Damaged)**
```
Debit:  Inventory Loss/Expense (5100)  $50
Credit: Inventory Asset (1200)         $50
Description: "Stock adjustment - Lost 5 units of Bandages"
```

**5. Stock Adjustment (Found)**
```
Debit:  Inventory Asset (1200)         $30
Credit: Inventory Gain/Revenue (4100)  $30
Description: "Stock adjustment - Found 2 units of Syringes"
```

---

## 5. Bin Cards Table (Audit Trail)

### Purpose
Complete audit trail for all inventory movements and transactions for each product. This is the "Bin Card" - a historical record of all stock activities (received, issued, adjustments, transfers, etc.).

### Schema Design

```sql
CREATE TABLE `bin_cards` (
  `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  
  -- Product Reference (Primary)
  `product_id` integer NOT NULL,
  
  -- Inventory Reference (Optional - may be NULL for product-level entries)
  `inventory_id` integer,
  
  -- Batch Information (for tracking specific batches)
  `batch_no` varchar(64),
  `expiry_date` date,
  
  -- Transaction Details
  `transaction_date` date NOT NULL,
  `transaction_type` text NOT NULL CHECK (`transaction_type` IN (
    'received',      -- Stock received/purchased
    'issued',        -- Stock issued/sold/dispatched
    'voided',        -- Transaction voided/cancelled
    'adjustment',    -- Stock adjusted (add/subtract/set)
    'opening',       -- Opening balance/initial stock
    'return',        -- Stock returned
    'transfer_in',   -- Stock transferred in from another location
    'transfer_out',  -- Stock transferred out to another location
    'expired',       -- Stock expired (moved out of inventory)
    'damaged'        -- Stock damaged (moved out of inventory)
  )),
  
  -- Reference Tracking (links to source document/transaction)
  `reference_id` integer,                       -- ID of related record
  `reference_table` varchar(32),                -- Table name of related record (e.g., 'purchases', 'sales', 'adjustments')
  `document_no` varchar(64),                    -- Document number (e.g., invoice #, PO #)
  
  -- Balance Tracking (perpetual inventory)
  `opening_balance` integer,                    -- Balance before this transaction
  `quantity_in` integer DEFAULT 0,              -- Quantity added (received/transfer_in/adjustment up)
  `quantity_out` integer DEFAULT 0,             -- Quantity removed (issued/transfer_out/expired/damaged/adjustment down)
  `balance` integer NOT NULL,                   -- Balance after this transaction (opening_balance + in - out)
  
  -- Cost Tracking
  `unit_cost` float,                            -- Unit cost for this transaction
  `total_cost` float,                           -- Total cost (unit_cost * quantity)
  
  -- Additional Information
  `reason` varchar(255),                        -- Reason for transaction (e.g., adjustment reason)
  `notes` varchar(500),                         -- Additional notes/comments
  
  -- Audit Fields
  `created_by` integer,                         -- User who created this entry
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(255) DEFAULT 'pending',
  
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`inventory_id`) REFERENCES `inventories` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
);
```

### Key Design Decisions:

1. **Product-Centric**: Links to `product_id` (required) - tracks all movements for a product
2. **Inventory Link Optional**: `inventory_id` can be NULL for product-level transactions
3. **Transaction Types**: Comprehensive set of transaction types covering all inventory movements
4. **Perpetual Inventory**: Tracks `opening_balance`, `quantity_in`, `quantity_out`, and `balance` - provides running balance
5. **Reference Tracking**: Flexible reference system (`reference_id`, `reference_table`, `document_no`) links to source documents
6. **Cost Tracking**: Records both `unit_cost` and `total_cost` for valuation
7. **Audit Trail**: Complete history with user tracking and timestamps

### Transaction Type Usage:

- **received**: Stock purchased/received (increases balance)
- **issued**: Stock sold/dispatched/used (decreases balance)
- **voided**: Cancelled transaction (reverses previous entry)
- **adjustment**: Stock adjustments (can increase or decrease)
- **opening**: Initial/opening stock balance
- **return**: Stock returned (increases balance)
- **transfer_in**: Stock transferred in from another location
- **transfer_out**: Stock transferred out to another location
- **expired**: Stock expired and removed (decreases balance)
- **damaged**: Stock damaged and removed (decreases balance)

### Example Bin Card Entries:

```
Product: Paracetamol 500mg
Date       | Type      | Opening | In  | Out | Balance | Unit Cost | Total Cost | Reference
-----------|-----------|---------|-----|-----|---------|-----------|------------|----------
2024-01-01 | opening   | 0       | 100 | 0   | 100     | $2.00     | $200.00    | Initial
2024-01-15 | received  | 100     | 50  | 0   | 150     | $2.10     | $105.00    | PO-001
2024-01-20 | issued    | 150     | 0   | 25  | 125     | $2.05     | $51.25     | Sale-001
2024-01-25 | adjustment| 125     | 0   | 5   | 120     | $2.05     | $10.25     | Lost
2024-01-30 | expired   | 120     | 0   | 10  | 110     | $2.00     | $20.00     | Batch-B001
```

### Indexes (Recommended):

```sql
CREATE INDEX `bin_cards_product_id_index` ON `bin_cards` (`product_id`);
CREATE INDEX `bin_cards_inventory_id_index` ON `bin_cards` (`inventory_id`);
CREATE INDEX `bin_cards_transaction_date_index` ON `bin_cards` (`transaction_date`);
CREATE INDEX `bin_cards_transaction_type_index` ON `bin_cards` (`transaction_type`);
CREATE INDEX `bin_cards_reference_index` ON `bin_cards` (`reference_table`, `reference_id`);
CREATE INDEX `bin_cards_created_by_index` ON `bin_cards` (`created_by`);
```

### Relationship to Other Tables:

- **products**: Primary relationship (CASCADE delete - if product deleted, all bin card entries deleted)
- **inventories**: Optional link to specific inventory item (SET NULL on delete - bin card entry remains)
- **users**: Links to user who created the entry

---

## 6. Borrow Returns Table

### Purpose
Tracks returns of borrowed inventory items. When inventory was borrowed from a supplier/partner, this table records which inventory items are used to return the borrowed stock. Links the borrowed inventory to the returning inventory used to settle the debt.

### Schema Design

```sql
CREATE TABLE `borrow_returns` (
  `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  
  -- Inventory References
  `borrowed_inventory_id` integer NOT NULL,      -- The original borrowed inventory item
  `returning_inventory_id` integer NOT NULL,     -- The inventory item used for return
  
  -- Pricing Information
  `estimated_price` float NOT NULL,              -- Estimated price at time of return
  `actual_price` float NOT NULL,                 -- Actual price used for settlement
  
  -- Return Details
  `quantity_returned` integer NOT NULL,          -- Quantity returned
  `returned_on` date NOT NULL,                   -- Date of return
  
  -- Additional Information
  `note` text,                                   -- Optional notes about the return
  
  -- Metadata
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(20) DEFAULT 'pending',
  
  FOREIGN KEY (`borrowed_inventory_id`) REFERENCES `inventories` (`id`),
  FOREIGN KEY (`returning_inventory_id`) REFERENCES `inventories` (`id`)
);
```

### Key Fields:

- **borrowed_inventory_id**: Reference to the original borrowed inventory item (from `inventories` table with `acquisition_type = 'borrow'`)
- **returning_inventory_id**: Reference to the inventory item used to return the borrowed stock (can be from purchase or other inventory)
- **estimated_price**: Expected/estimated price per unit at the time of return transaction
- **actual_price**: Final actual price per unit used for settlement (may differ from estimated)
- **quantity_returned**: Number of units being returned
- **returned_on**: Date when the return transaction occurred
- **note**: Optional notes about the return transaction

### Key Design Decisions:

1. **Two-Way Inventory Link**: 
   - `borrowed_inventory_id`: Links to the borrowed inventory that needs to be returned
   - `returning_inventory_id`: Links to the inventory used for return
   
2. **Price Tracking**: 
   - `estimated_price`: Price expected at time of planning return
   - `actual_price`: Final price used for settlement (may differ due to market changes, negotiation, etc.)
   
3. **Multiple Returns Support**: 
   - A single borrowed inventory item can have multiple return entries (partial returns)
   - Each return entry tracks its own quantity and pricing
   
4. **Date Tracking**: 
   - `returned_on` field specifically tracks the return date (separate from `created_at`)

### Business Logic Example:

**Scenario**: Company borrowed 100 units of Product A from Supplier X on 2024-01-01. Later, they want to return these using 100 units of Product A that were purchased.

```
Original Borrow:
- inventories.id = 1001
- product_id = 50 (Product A)
- quantity = 100
- acquisition_type = 'borrow'
- purchase_price = $10.00

Return Transaction:
- borrow_returns.borrowed_inventory_id = 1001 (the borrowed stock)
- borrow_returns.returning_inventory_id = 1002 (purchased stock used for return)
- borrow_returns.quantity_returned = 100
- borrow_returns.estimated_price = $10.50
- borrow_returns.actual_price = $10.50
- borrow_returns.returned_on = '2024-02-15'
```

### Indexes (Recommended):

```sql
CREATE INDEX `borrow_returns_borrowed_inventory_id_index` 
  ON `borrow_returns` (`borrowed_inventory_id`);
CREATE INDEX `borrow_returns_returning_inventory_id_index` 
  ON `borrow_returns` (`returning_inventory_id`);
CREATE INDEX `borrow_returns_returned_on_index` 
  ON `borrow_returns` (`returned_on`);
```

### Relationship to Other Tables:

- **inventories** (borrowed_inventory_id): The original borrowed inventory item that is being returned
- **inventories** (returning_inventory_id): The inventory item used to fulfill the return
- Both links are required - creating a relationship between two inventory items for settlement purposes

---

## 7. Supporting Tables (Additional Considerations)

### 6.1 Stock Transfers Table (Optional - if separate tracking needed)

```sql
CREATE TABLE IF NOT EXISTS "stock_transfers" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `inventory_id` integer NOT NULL,
  `from_location` varchar(255) NOT NULL,
  `to_location` varchar(255) NOT NULL,
  `quantity` integer NOT NULL,
  `transfer_date` date NOT NULL,
  `notes` text,
  `transferred_by` integer,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`inventory_id`) REFERENCES `inventories` (`id`),
  FOREIGN KEY (`transferred_by`) REFERENCES `users` (`id`)
);

CREATE INDEX `stock_transfers_inventory_id_index` 
  ON `stock_transfers` (`inventory_id`);
```

### 6.3 Locations Table (Optional Normalization)

```sql
CREATE TABLE IF NOT EXISTS "locations" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `location_code` varchar(255) UNIQUE NOT NULL, -- e.g., "A-01", "B-03"
  `location_name` varchar(255) NOT NULL,        -- e.g., "Warehouse A, Shelf 1"
  `description` text,
  `is_active` boolean DEFAULT true,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX `locations_location_code_unique` 
  ON `locations` (`location_code`);
```

---

## Relationships Summary

```
products
  └─> categories (category_id)
  └─> units (unit_id)

inventories
  └─> products (product_id) [CASCADE DELETE]
  └─> (Optional) locations (location) [if normalized]

bin_cards
  └─> products (product_id) [CASCADE DELETE]
  └─> inventories (inventory_id) [SET NULL on delete]
  └─> users (created_by)

account_ledger
  └─> chart_of_accounts (debit_account_id)
  └─> chart_of_accounts (credit_account_id)
  └─> inventories (inventory_id) [optional]
  └─> users (created_by)

borrow_returns
  └─> inventories (borrowed_inventory_id)
  └─> inventories (returning_inventory_id)

stock_transfers
  └─> inventories (inventory_id)
  └─> users (transferred_by)

chart_of_accounts
  └─> chart_of_accounts (parent_account_id) [self-referential for hierarchy]
```

---

## Key Design Principles

1. **Referential Integrity**: Foreign keys with CASCADE DELETE where appropriate
2. **Audit Trail**: Timestamps and user tracking for all changes
3. **Double-Entry Accounting**: Account ledger ensures balanced books
4. **Flexibility**: Support for various acquisition types and settlement statuses
5. **Performance**: Strategic indexes on frequently queried fields
6. **Data Integrity**: CHECK constraints for enums, UNIQUE constraints for codes
7. **Soft Deletes**: `is_active` flags instead of hard deletes for products/accounts

---

## Questions for Clarification

1. **Locations**: Should `location` in inventories be normalized to a `locations` table, or is storing as varchar sufficient?
2. **Suppliers/Vendors**: Do we need a separate `suppliers` table, or is that handled elsewhere (purchase module)?
3. **Purchase Orders**: Should `inventories` link to `purchase_orders` table, or is `reference_type/reference_id` in ledger sufficient?

---

## Next Steps

1. Finalize schema based on business requirements
2. Create migration files following existing pattern
3. Add seed data for charts of accounts (standard accounting accounts)
4. Implement API endpoints for CRUD operations
5. Add business logic for double-entry bookkeeping validation
