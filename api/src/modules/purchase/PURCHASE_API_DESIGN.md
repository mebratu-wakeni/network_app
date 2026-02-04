# Purchase Module API Design

## API Endpoints Overview

### 1. Product & Supplier Lookup (for dropdowns/search)

#### 1.1 GET `/api/purchases/products`
**Purpose**: Get products for search dropdown and select  
**Query Params**: 
- `search` (optional): Search by product name/code
- `limit` (optional, default: 50): Max results

**Response**:
```json
{
  "ok": true,
  "products": [
    {
      "id": 1,
      "product_code": "PRD0001",
      "name": "Product Name",
      "unit": "kg",
      "category": "Category Name"
    }
  ]
}
```

#### 1.2 GET `/api/purchases/suppliers`
**Purpose**: Get suppliers for search dropdown and select  
**Query Params**:
- `search` (optional): Search by supplier name
- `limit` (optional, default: 50): Max results

**Response**:
```json
{
  "ok": true,
  "suppliers": [
    {
      "id": 1,
      "name": "Supplier Name",
      "customer_type": "supplier",
      "phone": "...",
      "email": "..."
    }
  ]
}
```

#### 1.3 GET `/api/purchases/settings/withhold-percentage`
**Purpose**: Get system withhold percentage setting  
**Response**:
```json
{
  "ok": true,
  "withhold_percentage": 2.5,
  "setting_name": "purchase_withhold_percentage"
}
```

---

### 2. Purchase Order Management

#### 2.1 POST `/api/purchases/orders`
**Purpose**: Process/create purchase order (checkout)  
**Note**: Can be called with `hold_order_id` in body to indicate this order was created from a hold order (for tracking purposes)

**Payment Mode Logic:**
- **cash**: Full payment in cash. No additional fields required. Creates a single payment record in payments array.
- **credit**: Partial or no upfront payment. Optional `first_payment` (can be 0 or omitted). If `first_payment` > 0, creates first payment record. Remaining balance = (subtotal - withhold - first_payment) goes to Accounts Payable.
- **cheque**: Payment by cheque. Requires `cheque_details` with `amount`. Creates first payment record. If cheque amount < (subtotal - withhold), remaining goes to Accounts Payable.

**Withhold Percentage:**
- If `withhold_percentage` is provided in request, use that value
- Otherwise, fetch from system settings if applicable to this order
- If not applicable, use `null` (no withhold)
- **No default fallback value** - must be explicitly set or null

**Body**:
```json
{
  "supplier_id": 1,
  "order_date": "2026-01-26",
  "items": [
    {
      "product_id": 1,
      "quantity": 100,
      "unit_price": 50.00,
      "batch_number": "BATCH001",
      "expiry_date": "2026-12-31"
    }
  ],
  "payment_mode": "cheque", // "cash" | "credit" | "cheque"
  "withhold_percentage": 2.5, // Optional: if not provided, fetch from settings if applicable, otherwise null (no default fallback)
  "first_payment": 0, // Optional for credit mode: initial payment amount (if provided and > 0, creates first payment record in payments array; can be 0 or omitted for no upfront payment)
  "cheque_details": { // Required for cheque mode
    "bank_name": "Bank Name",
    "cheque_number": "CHQ123456",
    "cheque_date": "2026-01-30",
    "amount": 4875.00 // Net amount after withhold (subtotal - withhold_amount)
  },
  "notes": "Optional notes",
  "status": "completed", // "completed" | "archived" | "reversed"
  "hold_order_id": null // Optional: ID of hold order if this order was created from a hold order
}
```

**Example for credit mode:**
```json
{
  "supplier_id": 1,
  "order_date": "2026-01-26",
  "items": [
    {
      "product_id": 1,
      "quantity": 100,
      "unit_price": 50.00,
      "batch_number": "BATCH001",
      "expiry_date": "2026-12-31"
    }
  ],
  "payment_mode": "credit",
  "withhold_percentage": 2.5,
  "first_payment": 1000.00, // Optional: initial payment amount (creates first payment record in payments array)
  "notes": "Remaining balance to be paid later"
}
```

**Example for cash mode:**
```json
{
  "supplier_id": 1,
  "order_date": "2026-01-26",
  "items": [
    {
      "product_id": 1,
      "quantity": 100,
      "unit_price": 50.00,
      "batch_number": "BATCH001",
      "expiry_date": "2026-12-31"
    }
  ],
  "payment_mode": "cash",
  "withhold_percentage": null, // No withhold applicable
  "notes": "Full cash payment"
}
```

**Response**:
```json
{
  "ok": true,
  "purchase_order": {
    "id": 1, // Primary key, used as order identifier
    "receipt_number": "PO000001", // Generated when order is finalized (format: PO#######)
    "supplier_id": 1,
    "supplier_name": "Supplier Name",
    "order_date": "2026-01-26",
    "subtotal": 5000.00,
    "withhold_amount": 125.00,
    "net_amount": 4875.00,
    "payment_mode": "credit",
    "status": "completed",
    "created_at": "..."
  }
}
```

#### 2.2 GET `/api/purchases/orders`
**Purpose**: Get list of purchase orders with filters, search, sort, and pagination  
**Note**: Only returns "completed" or "reversed" orders. Hold orders are managed separately via `/api/purchases/hold-orders` endpoints.

**Query Params**:
- `limit` (default: 20)
- `offset` (default: 0)
- `search` (optional): Search by receipt number, supplier name
- `status` (optional): Filter by status ("completed", "archived", "reversed") - defaults to "completed" if not specified
- `supplier_id` (optional): Filter by supplier
- `payment_mode` (optional): Filter by payment mode ("cash", "credit", "cheque")
- `date_from` (optional): Filter orders from date (YYYY-MM-DD)
- `date_to` (optional): Filter orders to date (YYYY-MM-DD)
- `has_outstanding_balance` (optional): Filter orders with outstanding balance (true/false)
- `sort_by` (optional): "order_date", "id", "receipt_number", "net_amount", "supplier_name"
- `order_by` (optional): "asc" | "desc"

**Response**:
```json
{
  "ok": true,
  "orders": [
    {
      "id": 1, // Primary key
      "receipt_number": "PO000001", // Generated when order is finalized (format: PO#######)
      "supplier_name": "Supplier Name",
      "order_date": "2026-01-26",
      "net_amount": 4875.00,
      "payment_mode": "credit",
      "status": "completed",
      "outstanding_balance": 4875.00
    }
  ],
  "total": 100,
  "stats": {
    "total_orders": {
      "count": 100, // Total count of purchase orders (completed + reversed)
      "value": 500000.00 // Sum of net_amount for all orders
    },
    "cash_orders": {
      "count": 30, // Count of orders paid by cash
      "value": 150000.00 // Sum of net_amount for cash orders
    },
    "credit_orders": {
      "count": 50, // Count of orders paid by credit
      "value": 250000.00 // Sum of net_amount for credit orders
    },
    "cheque_orders": {
      "count": 20, // Count of orders paid by cheque
      "value": 100000.00 // Sum of net_amount for cheque orders
    },
    "outstanding_balance": {
      "count": 45, // Number of orders with outstanding balance
      "value": 50000.00 // Total outstanding balance (credit + partial cheque payments)
    },
    "total_withhold_amount": {
      "count": 80, // Number of orders with withhold applied
      "value": 12500.00 // Sum of all withhold amounts
    },
    "reversed_orders": {
      "count": 5, // Count of reversed orders
      "value": 25000.00 // Sum of net_amount for reversed orders
    }
  }
}
```

#### 2.3 GET `/api/purchases/orders/:id`
**Purpose**: Get order details by order ID (for view order action)  
**Response**:
```json
{
  "ok": true,
    "order": {
      "id": 1, // Primary key
      "receipt_number": "PO000001", // Generated when order is finalized (format: PO#######)
      "supplier_id": 1,
      "supplier_name": "Supplier Name",
      "supplier_details": {...},
      "order_date": "2026-01-26",
    "items": [
      {
        "id": 1,
        "product_id": 1,
        "product_code": "PRD0001",
        "product_name": "Product Name",
        "quantity": 100,
        "unit_price": 50.00,
        "subtotal": 5000.00,
        "batch_number": "BATCH001",
        "expiry_date": "2026-12-31"
      }
    ],
    "subtotal": 5000.00,
    "withhold_percentage": 2.5,
    "withhold_amount": 125.00,
    "net_amount": 4875.00,
    "payment_mode": "credit",
    "cheque_details": null, // Initial cheque details if payment_mode was "cheque"
    "status": "completed",
    "notes": "...",
    "created_by": 1,
    "created_at": "...",
    "payments": [
      {
        "id": 1,
        "payment_amount": 1000.00, // First payment (from initial order creation if first_payment was provided)
        "payment_mode": "cash",
        "payment_date": "2026-01-26", // Same as order_date
        "cheque_details": null,
        "remaining_balance_after": 3875.00,
        "created_at": "2026-01-26T10:00:00Z" // Payments ordered by created_at (earliest = first payment)
      },
      {
        "id": 2,
        "payment_amount": 2000.00, // Subsequent payment via POST /api/purchases/orders/:id/pay
        "payment_mode": "cash",
        "payment_date": "2026-01-27",
        "cheque_details": null,
        "remaining_balance_after": 1875.00,
        "created_at": "2026-01-27T14:30:00Z"
      },
      {
        "id": 3,
        "payment_amount": 1500.00, // Another subsequent payment
        "payment_mode": "cheque",
        "payment_date": "2026-01-28",
        "cheque_details": {
          "bank_name": "Bank Name",
          "cheque_number": "CHQ789012",
          "cheque_date": "2026-01-30"
        },
        "remaining_balance_after": 375.00,
        "created_at": "2026-01-28T09:15:00Z"
      }
    ],
    "total_paid": 4500.00, // Sum of all payment amounts (must equal sum of payments array)
    "outstanding_balance": 375.00 // Current outstanding balance (net_amount - total_paid)
  }
}
```
**Note**: The `payments` array is ordered by `created_at` (ascending), so the first payment (if any) from order creation will be the first element, followed by subsequent payments made via `POST /api/purchases/orders/:id/pay`.

#### 2.4 GET `/api/purchases/orders/:id/receipt`
**Purpose**: Get order receipt by order ID (formatted for printing)  
**Note**: Returns the receipt snapshot from `purchase_receipts` table. If no receipt exists, generates one from current order data and saves it to `purchase_receipts`.  
**Response**:
```json
{
  "ok": true,
  "receipt": {
    "id": 1,
    "receipt_no": "PO000001",
    "purchase_order_id": 1,
    "snapshot_data": {
      // Complete order snapshot at receipt generation time
      "order": {...},
      "items": [...],
      "payments": [...],
      "supplier": {...}
    },
    "order_meta": {
      "supplier_name": "Supplier Name",
      "order_date": "2026-01-26",
      "status": "completed",
      "payment_mode": "credit"
    },
    "order_items": [...],
    "order_payment": {...},
    "voided": false,
    "generated_at": "2026-01-26T10:00:00Z"
  }
}
```

#### 2.4.1 GET `/api/purchases/receipts/:receipt_no`
**Purpose**: Get receipt snapshot by receipt number (for reprinting receipts)  
**Query Params**: None  
**Response**: Same structure as `GET /api/purchases/orders/:id/receipt`  
**Note**: This endpoint retrieves the receipt directly from `purchase_receipts` table by receipt number, ensuring the exact snapshot is returned even if the order has been modified.

#### 2.5 PUT `/api/purchases/orders/:id`
**Purpose**: Edit purchase order (only if status is "completed" and not yet fully paid)  
**Body**: Same structure as POST (can update items, payment details, etc.)  
**Response**: Updated order object

#### 2.6 POST `/api/purchases/orders/:id/reverse`
**Purpose**: Reverse purchase order when something is wrong (creates reverse entries)  
**Body**:
```json
{
  "reason": "Wrong items received",
  "reverse_inventory": true, // Whether to reverse inventory entries
  "reverse_ledger": true // Whether to reverse ledger entries
}
```

**Response**:
```json
{
  "ok": true,
  "reversed_order": {
    "id": 1,
    "status": "reversed",
    "reversal_date": "..."
  }
}
```

#### 2.7 POST `/api/purchases/orders/:id/pay`
**Purpose**: Pay outstanding fee for a purchase order by ID  
**Body**:
```json
{
  "payment_amount": 2000.00,
  "payment_mode": "cash", // "cash" | "cheque"
  "payment_date": "2026-01-27",
  "cheque_details": { // If payment_mode is "cheque"
    "bank_name": "Bank Name",
    "cheque_number": "CHQ789012",
    "cheque_date": "2026-01-30"
  },
  "notes": "Partial payment"
}
```

**Response**:
```json
{
  "ok": true,
  "payment": {
    "id": 1,
    "purchase_order_id": 1,
    "payment_amount": 2000.00,
    "remaining_balance": 2875.00,
    "payment_date": "..."
  }
}
```

---

### 3. Hold Orders Management

#### 3.1 GET `/api/purchases/hold-orders`
**Purpose**: Get list of hold orders  
**Query Params**:
- `limit` (default: 20)
- `offset` (default: 0)
- `search` (optional): Search by order number, supplier name
- `sort_by` (optional)
- `order_by` (optional)

**Response**:
```json
{
  "ok": true,
  "hold_orders": [
    {
      "id": 1,
      "hold_order_number": "HOLD-2026-0001",
      "supplier_name": "Supplier Name",
      "order_date": "2026-01-26",
      "net_amount": 4875.00,
      "items_count": 3,
      "created_at": "..."
    }
  ],
  "total": 10
}
```

#### 3.2 GET `/api/purchases/hold-orders/:id`
**Purpose**: Load purchase hold order by hold order ID (to load into UI for editing)  
**Note**: This returns the hold order data that will be loaded into the purchase form UI. The user can then edit it (product details may have changed since hold creation) and process it as a new purchase order via POST `/api/purchases/orders`.  
**Response**: Same structure as order details, but with `hold_order_id` field (hold orders are separate from purchase_orders)

#### 3.3 DELETE `/api/purchases/hold-orders/:id`
**Purpose**: Archive/delete hold order by hold order ID  
**Response**:
```json
{
  "ok": true,
  "message": "Hold order archived successfully"
}
```

---

### 4. Bulk Import

#### 4.1 POST `/api/purchases/import`
**Purpose**: Import bulk purchase from CSV  
**Body**:
```json
{
  "purchase_date": "2026-01-26",
  "supplier_id": 1,
  "payment_mode": "cash",
  "withhold_percentage": 2.5,
  "stock_items": [
    {
      "product_name": "Product Name",
      "product_code": "PRD0001",
      "quantity": 100,
      "unit_cost": 50.00,
      "batch_number": "BATCH001",
      "expiry_date": "2026-12-31"
    }
  ]
}
```

**Response**: Similar to bulk import stock (summary with successful/failed items)

---

## Suggested Additional APIs

### 5. Receipt Management

#### 5.1 GET `/api/purchases/receipts`
**Purpose**: Get list of receipts with filters, search, and pagination  
**Query Params**:
- `limit` (default: 20)
- `offset` (default: 0)
- `search` (optional): Search by receipt number, supplier name
- `voided` (optional): Filter by voided status (true/false)
- `date_from` (optional): Filter receipts from date (YYYY-MM-DD)
- `date_to` (optional): Filter receipts to date (YYYY-MM-DD)
- `sort_by` (optional): "generated_at", "receipt_no"
- `order_by` (optional): "asc" | "desc"

**Response**:
```json
{
  "ok": true,
  "receipts": [
    {
      "id": 1,
      "receipt_no": "PO000001",
      "purchase_order_id": 1,
      "order_meta": {
        "supplier_name": "Supplier Name",
        "order_date": "2026-01-26",
        "net_amount": 4875.00
      },
      "voided": false,
      "generated_at": "2026-01-26T10:00:00Z"
    }
  ],
  "total": 100
}
```

#### 5.2 POST `/api/purchases/receipts/:id/void`
**Purpose**: Void a receipt (mark as voided)  
**Body**:
```json
{
  "reason": "Receipt was printed incorrectly"
}
```

**Response**:
```json
{
  "ok": true,
  "message": "Receipt voided successfully",
  "receipt": {
    "id": 1,
    "receipt_no": "PO000001",
    "voided": true
  }
}
```

**Note**: Voiding a receipt marks it as voided but does not delete it. The receipt snapshot remains for audit purposes.

---

### 6. Purchase Statistics & Reporting

#### 5.1 GET `/api/purchases/stats`
**Purpose**: Get purchase statistics for dashboard  
**Query Params**:
- `date_from` (optional): Filter stats from date
- `date_to` (optional): Filter stats to date
- `supplier_id` (optional): Filter stats by supplier
- `payment_mode` (optional): Filter stats by payment mode ("cash", "credit", "cheque")
- `status` (optional): Filter stats by status ("completed", "archived", "reversed")

**Response**:
```json
{
  "ok": true,
  "stats": {
    "total_orders": {
      "count": 100, // Total count of purchase orders
      "value": 500000.00 // Sum of net_amount for all orders
    },
    "cash_orders": {
      "count": 30, // Count of orders paid by cash
      "value": 150000.00 // Sum of net_amount for cash orders
    },
    "credit_orders": {
      "count": 50, // Count of orders paid by credit
      "value": 250000.00 // Sum of net_amount for credit orders
    },
    "cheque_orders": {
      "count": 20, // Count of orders paid by cheque
      "value": 100000.00 // Sum of net_amount for cheque orders
    },
    "outstanding_balance": {
      "count": 45, // Number of orders with outstanding balance
      "value": 50000.00 // Total outstanding balance (credit + partial cheque payments)
    },
    "total_withhold_amount": {
      "count": 80, // Number of orders with withhold applied
      "value": 12500.00 // Sum of all withhold amounts
    },
    "reversed_orders": {
      "count": 5, // Count of reversed orders
      "value": 25000.00 // Sum of net_amount for reversed orders
    },
    "this_month_orders": {
      "count": 20, // Orders created this month
      "value": 100000.00 // Total amount for this month
    }
  }
}
```

**Note**: These stats can also be used as filters in the purchase orders list endpoint. The stats reflect the same filters applied to the orders list.

### 7. Payment History

#### 6.1 GET `/api/purchases/orders/:id/payments`
**Purpose**: Get payment history for a purchase order  
**Response**:
```json
{
  "ok": true,
  "payments": [
    {
      "id": 1,
      "payment_amount": 2000.00,
      "payment_mode": "cash",
      "payment_date": "2026-01-27",
      "created_at": "..."
    }
  ],
  "total_paid": 2000.00,
  "outstanding_balance": 2875.00
}
```

---

## Database Tables Required

### 1. purchase_orders
Main purchase order table.

```sql
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `supplier_id` integer,
  `order_date` date NOT NULL,
  `invoice_no` varchar(255),
  `remark` text,
  `payment_status` text CHECK (`payment_status` in('paid', 'partial', 'unpaid')) DEFAULT 'paid',
  `status` text CHECK (`status` in('completed', 'archived', 'reversed')) DEFAULT 'completed',
  `payment_mode` text CHECK (`payment_mode` in('cash', 'credit', 'cheque')) NOT NULL,
  `amount_paid` float,
  `withhold_percentage` float,
  `receipt_no` varchar(255) NOT NULL,
  `withhold_amount` float,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(255) DEFAULT 'pending',
  `total_amount` float DEFAULT '0',
  `withhold_settled` boolean DEFAULT '0',
  `encoder_id` integer,
  `encoder_fullname` varchar(255),
  FOREIGN KEY (`supplier_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`encoder_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

CREATE UNIQUE INDEX `purchase_orders_receipt_no_unique` ON `purchase_orders` (`receipt_no`);
```

**Key Fields:**
- `id`: Primary key (auto-increment)
- `supplier_id`: Foreign key to `customers.id` (supplier)
- `invoice_no`: Reference number from the supplier (external reference, optional)
- `receipt_no`: System-generated unique receipt number (format: PO#######) - internal reference
- `status`: Order status ('completed', 'archived', 'reversed')
- `payment_status`: Payment status ('paid', 'partial', 'unpaid')
- `payment_mode`: Payment mode ('cash', 'credit', 'cheque') - required field
- `total_amount`: Total order amount
- `amount_paid`: Amount paid so far
- `withhold_percentage`: Withhold percentage (default: 2)
- `withhold_amount`: Calculated withhold amount
- `withhold_settled`: Whether withhold has been settled
- `encoder_id`: Foreign key to `users.id` (user who created the order)
- `encoder_fullname`: Full name of the encoder (denormalized for performance)

### 2. purchase_order_items
Line items for each purchase order.

```sql
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `purchase_order_id` integer,
  `product_id` integer,
  `quantity` integer NOT NULL,
  `unit_price` float NOT NULL,
  `total_price` float NOT NULL,
  `inventory_id` integer,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(255) DEFAULT 'pending',
  FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`inventory_id`) REFERENCES `inventories` (`id`) ON DELETE CASCADE
);
```

**Key Fields:**
- `id`: Primary key (auto-increment)
- `purchase_order_id`: Foreign key to `purchase_orders.id`
- `product_id`: Foreign key to `products.id` - the product being purchased (required, as inventory doesn't exist yet at order creation)
- `quantity`: Quantity of the product (required)
- `unit_price`: Unit price of the product (required)
- `total_price`: Total price for this line item (quantity × unit_price) (required)
- `inventory_id`: Foreign key to `inventories.id` - links to the inventory record created for this item after the purchase order is processed (nullable until inventory is created)
- `sync_status`: Sync status for synchronization purposes

**Note**: When a purchase order is created, we only know the `product_id` (what product is being purchased). The `inventory_id` is populated later when inventory records are created after processing the purchase order.

### 3. purchase_hold_orders
Snapshot of held orders (separate from purchase_orders table). Stores a snapshot of the order from the UI before it's finalized.

```sql
CREATE TABLE IF NOT EXISTS "purchase_hold_orders" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `supplier_id` integer,
  `order_date` date NOT NULL,
  `invoice_no` varchar(255),
  `remark` text,
  `payment_mode` text CHECK (`payment_mode` in('cash', 'credit', 'cheque')) NOT NULL,
  `withhold_percentage` float,
  `withhold_amount` float,
  `total_amount` float DEFAULT '0',
  `amount_paid` float,
  `cheque_details` text, -- JSON string for cheque details: {"bank_name": "...", "cheque_number": "...", "cheque_date": "...", "amount": ...}
  `first_payment` float, -- For credit mode: initial payment amount (if any)
  `items` text NOT NULL, -- JSON string array of order items: [{"product_id": 1, "quantity": 100, "unit_price": 50.00, "batch_number": "...", "expiry_date": "...", ...}, ...]
  `is_archive` boolean DEFAULT '0', -- Indicates if the hold order is archived (no longer active)
  `encoder_id` integer,
  `encoder_fullname` varchar(255),
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`supplier_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`encoder_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
```

**Key Fields:**
- `id`: Primary key (auto-increment)
- `supplier_id`: Foreign key to `customers.id` (supplier)
- `order_date`: Date of the order
- `payment_mode`: Payment mode ('cash', 'credit', 'cheque') - required field
- `items`: JSON string containing array of order items (snapshot of items from UI)
- `cheque_details`: JSON string containing cheque details (if payment_mode is 'cheque')
- `first_payment`: Initial payment amount for credit mode (if any)
- `total_amount`: Total order amount (calculated from items)
- `withhold_percentage`: Withhold percentage
- `withhold_amount`: Calculated withhold amount
- `amount_paid`: Amount paid (for credit mode with first_payment)
- `is_archive`: Boolean flag indicating if the hold order is archived (no longer active) - default: false
- `encoder_id`: Foreign key to `users.id` (user who created the hold order)
- `encoder_fullname`: Full name of the encoder (denormalized for performance)

**Note**: This table stores a complete snapshot of the order as it appears in the UI. When a hold order is loaded back into the UI, all fields are restored, allowing the user to edit and then process it as a new purchase order via `POST /api/purchases/orders`.

### 4. purchase_payments
Payment records for purchase orders (credit and cheque payments).

```sql
CREATE TABLE `purchase_payments` (
  `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  `purchase_order_id` integer,
  `payment_date` date NOT NULL,
  `amount` float NOT NULL,
  `note` text,
  `payment_method` varchar(255),
  `cheque_no` varchar(255),
  `bank_name` varchar(255),
  `branch_name` varchar(255),
  `cheque_date` date,
  `cleared_date` date,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_updated` datetime DEFAULT CURRENT_TIMESTAMP,
  `sync_status` varchar(255) DEFAULT 'pending',
  FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
);
```

**Key Fields:**
- `id`: Primary key (auto-increment)
- `purchase_order_id`: Foreign key to `purchase_orders.id`
- `payment_date`: Date of the payment (required)
- `amount`: Payment amount (required)
- `payment_method`: Payment method (e.g., 'cash', 'cheque')
- `note`: Optional note about the payment
- `cheque_no`: Cheque number (if payment_method is 'cheque')
- `bank_name`: Bank name (if payment_method is 'cheque')
- `branch_name`: Branch name (if payment_method is 'cheque')
- `cheque_date`: Date on the cheque (if payment_method is 'cheque')
- `cleared_date`: Date when cheque was cleared (if payment_method is 'cheque')
- `sync_status`: Sync status for synchronization purposes

**Note**: This table stores all payments made against purchase orders. For credit purchases, multiple payment records can exist. For cheque payments, the cheque details are stored in the cheque-related fields.

### 5. purchase_receipts
Receipt snapshots for purchase orders. Stores a complete snapshot of the order data at the time the receipt was generated, allowing for historical receipt viewing even if the order is later modified or reversed.

```sql
CREATE TABLE purchase_receipts (
  id bigint PRIMARY KEY,
  receipt_no varchar(255) NOT NULL UNIQUE,
  purchase_order_id bigint,
  snapshot_data jsonb NOT NULL,
  order_meta jsonb DEFAULT '{}'::jsonb,
  order_items jsonb DEFAULT '[]'::jsonb,
  order_payment jsonb DEFAULT '{}'::jsonb,
  voided boolean DEFAULT false,
  generated_at timestamp DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  last_updated timestamp DEFAULT CURRENT_TIMESTAMP,
  sync_status varchar(255) DEFAULT 'pending',
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX purchase_receipts_receipt_no_unique ON purchase_receipts (receipt_no);
CREATE INDEX purchase_receipts_purchase_order_id_index ON purchase_receipts (purchase_order_id);
CREATE INDEX purchase_receipts_voided_index ON purchase_receipts (voided);
CREATE INDEX purchase_receipts_generated_at_index ON purchase_receipts (generated_at);
CREATE INDEX purchase_receipts_snapshot_data_gin_index ON purchase_receipts USING GIN (snapshot_data);
CREATE INDEX purchase_receipts_order_meta_gin_index ON purchase_receipts USING GIN (order_meta);
CREATE INDEX purchase_receipts_order_items_gin_index ON purchase_receipts USING GIN (order_items);
```

**Key Fields:**
- `id`: Primary key (auto-increment)
- `receipt_no`: Unique receipt number (format: PO#######) - matches `purchase_orders.receipt_no`
- `purchase_order_id`: Foreign key to `purchase_orders.id` (nullable, as receipt can exist even if order is deleted)
- `snapshot_data`: Complete JSON snapshot of order data at receipt generation time (required)
- `order_meta`: Denormalized JSON field for order metadata (supplier info, dates, status, etc.) - for easier querying
- `order_items`: Denormalized JSON array of order items - for easier querying
- `order_payment`: Denormalized JSON object for payment information - for easier querying
- `voided`: Boolean flag indicating if the receipt has been voided (default: false)
- `generated_at`: Timestamp when receipt was generated
- `sync_status`: Sync status for synchronization purposes

**Note**: This table stores immutable receipt snapshots. When a purchase order is finalized, a receipt record is automatically created with a complete snapshot of the order data at that moment. This ensures that:
- Receipts remain unchanged even if the order is later modified or reversed
- Historical receipts can be viewed and printed accurately
- Receipt data is denormalized into `order_meta`, `order_items`, and `order_payment` for efficient querying
- The `snapshot_data` field contains the complete, unmodified receipt data
- Receipts can be voided (marked as `voided = true`) without deleting the record

### 6. system_settings
System-wide settings table (used for withhold percentage and other system settings).

```sql
CREATE TABLE `system_settings` (
  `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
  `setting_key` varchar(255) NOT NULL,
  `setting_value` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX `system_settings_setting_key_unique` ON `system_settings` (`setting_key`);
```

**Key Fields:**
- `id`: Primary key (auto-increment)
- `setting_key`: Unique setting identifier (e.g., 'purchase_withhold_percentage') (required, unique)
- `setting_value`: Value of the setting (stored as text, can be null)
- `created_at`: Timestamp when setting was created
- `updated_at`: Timestamp when setting was last updated

**Note**: This table stores system-wide settings. For purchase orders, the withhold percentage can be retrieved using `setting_key = 'purchase_withhold_percentage'`. The `setting_key` is unique to ensure only one value exists per setting.

---

## Hold Order Workflow

**Important**: Hold orders are NOT directly converted to purchase orders. The workflow is:

1. User creates a purchase order and clicks "Hold Order" → Saved to `purchase_hold_orders` table
2. Later, user views hold orders list and selects one to resume
3. `GET /api/purchases/hold-orders/:id` loads the hold order data into the purchase form UI
4. User can edit the order (product details, prices, quantities may have changed)
5. User processes the order via `POST /api/purchases/orders` (creates new purchase order)
6. After successful processing, the hold order can be archived via `DELETE /api/purchases/hold-orders/:id`

**Why this approach?**
- Product details (prices, availability) may have changed since hold creation
- User needs to review and update the order before finalizing
- Hold order is just a snapshot/template, not a direct conversion

## Notes

- All endpoints require authentication
- Permission rules to be defined (e.g., `CanCreatePurchase`, `CanEditPurchase`, `CanReversePurchase`, `CanHoldPurchase`)
- Ledger entries will be created automatically:
  - Inventory (debit)
  - Accounts Payable (credit) - for credit purchases
  - Accounts Withhold Payable (credit) - for withhold amount
  - Cash/Bank (credit) - for cash/cheque payments
- Bin card entries will be created for each item
- Inventory records will be created/updated for each item
- Hold orders are snapshots and do not create inventory/ledger entries until processed as purchase orders
- Each finalized purchase order (status "completed") automatically gets a receipt number generated (format: "PO000001", "PO000002", etc.)
- Receipt number is stored in `purchase_orders.receipt_no` field and can be used for filtering/searching
- When a purchase order is finalized, a receipt snapshot is automatically created in `purchase_receipts` table
- Receipt snapshots are immutable and preserve the exact state of the order at receipt generation time
- Receipts can be voided but not deleted (for audit purposes)
- Order identification uses `id` (primary key) - no separate `order_number` field needed
