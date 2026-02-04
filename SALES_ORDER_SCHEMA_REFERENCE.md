# Sales Orders — Schema Reference & API Design

## 1. Refined Schema (Human-Readable)

**Table:** `sales_orders`

### Design decisions (refinements applied)

- **customer_id**: Renamed from `retailer_id`; FK to `customers.id`.
- **receipt_no**: System-generated sales order identifier (required, unique). Not the same as government invoice.
- **invoice_no**: Government/tax authority reference (optional). External/official reference.
- **sales_invoice_no**: Used for withhold confirmation (optional, unique). Name kept as-is despite possible confusion with `invoice_no`.
- **withhold_percentage**: No default value. When applicable, value comes from system settings (e.g. sales withhold setting).
- **Withholding**: Inferred from presence of `withhold_percentage` and `withhold_amount`; no separate `withhold` boolean.
- **Hold orders**: Stored in a separate table (e.g. `sales_hold_orders`) as a snapshot of current-order state. No `is_held` or `hold_until` on `sales_orders`.
- **payment_type**: Same concept as `payment_mode` in purchase. Allowed values: `cash` | `credit` | `cheque` (no `borrow`).
- **encoder_fullname**: Stores the user’s **display_name** (denormalized).
- **withhold_confirmation**: Kept; important for withhold workflow.
- **is_reversed**: Kept; important for reversal tracking.

---

### Columns

| Column | Type | Nullable | Default | Constraints / Notes |
|--------|------|----------|---------|----------------------|
| **id** | bigint | NO | — | PRIMARY KEY, auto-increment |
| **customer_id** | bigint | YES | — | FK → `customers(id)` ON DELETE SET NULL |
| **order_date** | date | NO | — | Required |
| **invoice_no** | varchar(255) | YES | — | Government/tax authority reference (optional) |
| **remark** | text | YES | — | |
| **payment_type** | varchar(50) | NO | `'cash'` | CHECK: `'cash'` \| `'credit'` \| `'cheque'` |
| **payment_status** | varchar(50) | — | `'unpaid'` | CHECK: `'paid'` \| `'partial'` \| `'unpaid'` |
| **total_amount** | decimal(15,2) | — | `0` | |
| **amount_paid** | decimal(15,2) | — | `0` | |
| **withhold_percentage** | decimal(5,2) | YES | — | **No default**; from settings when applicable |
| **withhold_amount** | decimal(15,2) | YES | — | |
| **received_amount** | decimal(15,2) | YES | — | |
| **withhold_settled** | boolean | — | `false` | |
| **withhold_confirmation** | boolean | — | `false` | Important for withhold workflow |
| **sales_invoice_no** | varchar(255) | YES | — | For withhold confirmation; UNIQUE when not null |
| **receipt_no** | varchar(255) | NO | — | **Required**, UNIQUE — system-generated sales order id |
| **status** | varchar(50) | — | `'pending'` | CHECK: `'pending'` \| `'completed'` \| `'archived'` |
| **is_reversed** | boolean | — | `false` | |
| **encoder_id** | bigint | YES | — | FK → `users(id)` ON DELETE SET NULL |
| **encoder_fullname** | varchar(255) | YES | — | User’s display_name (denormalized) |
| **created_at** | timestamp | — | now() | |
| **last_updated** | timestamp | — | now() | |
| **sync_status** | varchar(255) | — | `'pending'` | |

### Unique indexes

- `sales_orders_receipt_no_unique` on `receipt_no`
- `sales_orders_sales_invoice_no_unique` on `sales_invoice_no` (partial: WHERE sales_invoice_no IS NOT NULL)

### Foreign keys

- `customer_id` → `customers(id)` ON DELETE SET NULL
- `encoder_id` → `users(id)` ON DELETE SET NULL

### Enums (CHECK)

- **payment_type:** `cash` | `credit` | `cheque`
- **payment_status:** `paid` | `partial` | `unpaid`
- **status:** `pending` | `completed` | `archived`

---

## 2. Migration

- **File:** `api/db/migrations/20260131130000_create_sales_orders_table.js`
- **Timestamp:** Chosen to run after existing migrations (e.g. after `20260131120000`).
- Run: `npm run migrate` (from `api/`).

---

## 3. API Design (Sales Module)

Overview of recommended REST API for the sales module, aligned with the refined schema and frontend (customer, product from inventory, payment mode, withholding, hold orders).

### 3.1 Customer & product lookup

- **GET `/api/sales/customers`**  
  - Purpose: Customers for dropdown (e.g. retailer/both from partners).  
  - Query: `search`, `limit`.  
  - Response: `{ ok, customers: [{ id, name, customer_type, contact_person, phone, email, ... }] }`.

- **GET `/api/sales/products`** (or reuse inventory stock endpoint)  
  - Purpose: Sellable items from inventory (name, code, batch, expiry, selling price).  
  - Query: `search`, `limit`, optionally `inventory_id`.  
  - Response: `{ ok, products: [{ id, product_id, inventory_id, name, product_code, batch_number, expiry_date, selling_price, ... }] }`.

- **GET `/api/sales/settings/withhold-percentage`**  
  - Purpose: Sales withhold percentage from system settings (used when applicable; no default in DB).  
  - Response: `{ ok, withhold_percentage, setting_name }`.

### 3.2 Create sales order (checkout)

- **POST `/api/sales/orders`**  
  - Purpose: Create a completed sales order **and its line items**. Each request results in **one row in `sales_orders`** and **one row per item in `sales_order_items`** (same transaction). Inventory quantities are decremented for each item’s `inventory_id`.  
  - Body (validated):  
    - `customer_id` (optional, number).  
    - `order_date` (required, YYYY-MM-DD).  
    - `invoice_no` (optional; government/tax reference).  
    - `payment_type`: `cash` | `credit` | `cheque`.  
    - `withhold_percentage`: number or null.  
    - `amount_paid` (optional; for cash default is full amount; for cheque use `cheque_details.amount`).  
    - `cheque_details`: required when `payment_type === 'cheque'` (e.g. `bank_name`, `cheque_number`, `cheque_date`, `amount`).  
    - `items`: array of **at least one** `{ product_id, inventory_id, quantity, unit_price }` — all required; `inventory_id` identifies the batch to sell from (and to decrement).  
    - `remark`, `hold_order_id` (optional).  
  - Backend: generates `receipt_no` (e.g. SO000001), computes `total_amount`, `withhold_amount`, `received_amount`, `payment_status`; inserts into `sales_orders` then `sales_order_items` (with `total_price = quantity × unit_price` per item); decrements `inventories.quantity` for each item.  
  - Response: `{ ok, order: { id, receipt_no, customer_id, order_date, total_amount, withhold_amount, received_amount, payment_type, payment_status, status, created_at, items_count } }`.

### 3.3 List sales orders (history)

- **GET `/api/sales/orders`**  
  - Purpose: Paginated list with filters and stats.  
  - Query: `limit`, `offset`, `search` (receipt_no, customer name), `status` (`pending` | `completed` | `archived`), `customer_id`, `payment_type`, `date_from`, `date_to`, `has_outstanding_balance`, `sort_by`, `order_by`.  
  - Response: `{ ok, orders: [...], total, stats }` (e.g. total count/value, by payment_type, outstanding balance, reversed).

### 3.4 Order details

- **GET `/api/sales/orders/:id`**  
  - Purpose: Full order details including **items from `sales_order_items`** (product_id, inventory_id, quantity, unit_price, total_price, product_name, product_code, batch_number, expiry_date).  
  - Response: `{ ok, order: { ... }, items: [ ... ] }`.

### 3.5 Hold orders (snapshot of current order)

- **POST `/api/sales/hold-orders`**  
  - Purpose: Save current cart/order state as a hold (snapshot).  
  - Body: Same shape as “current order” (customer, items, payment_type, withhold_percentage, withhold_reference, amounts, etc.) as JSON snapshot.  
  - Response: `{ ok, hold_order: { id, ... } }`.

- **GET `/api/sales/hold-orders`**  
  - Purpose: List hold orders (with filters: all / active / archived).  
  - Query: `limit`, `offset`, `archived` (boolean), `search`.  
  - Response: `{ ok, hold_orders: [...], total }`.

- **GET `/api/sales/hold-orders/:id`**  
  - Purpose: Get one hold order (to load into “current sale” UI).  
  - Response: `{ ok, hold_order: { ... } }`.

- **DELETE `/api/sales/hold-orders/:id`** (or PATCH to set archived)  
  - Purpose: Archive/remove hold order after it’s been checked out or discarded.

### 3.6 Payments (for credit sales)

- **POST `/api/sales/orders/:id/payments`**  
  - Purpose: Record a payment against a sales order (credit or follow-up).  
  - Body: `amount`, `payment_date`, `payment_method` (e.g. cash/cheque), optional `cheque_details`.  
  - Backend updates `amount_paid`, `payment_status`, and optionally creates a `sales_payments` row if that table exists.  
  - Response: `{ ok, payment: { ... }, outstanding_balance }`.

### 3.7 Withhold confirmation

- **PATCH `/api/sales/orders/:id/withhold-confirmation`** (or similar)  
  - Purpose: Mark withhold as confirmed and set `sales_invoice_no` (e.g. from tax system).  
  - Body: `sales_invoice_no`, optionally `withhold_confirmation = true`.  
  - Response: `{ ok, order: { ... } }`.

### 3.8 Reversal

- **POST `/api/sales/orders/:id/reverse`** (or PATCH with `is_reversed: true`)  
  - Purpose: Reverse a sales order; restore stock and update ledger; set `is_reversed = true`.  
  - Response: `{ ok, order: { ... } }`.

### 3.9 Receipts

- **GET `/api/sales/receipts/:receipt_no`** or **GET `/api/sales/orders/:id/receipt`**  
  - Purpose: Get receipt data for print/view (snapshot or current order).  
  - If using a `sales_receipts` table (like purchase_receipts), store snapshot at checkout and serve from there.

---

## 4. Related tables (to be added as needed)

- **sales_order_items**: See **Section 6** below.
- **sales_hold_orders**: See **Section 5** below.
- **sales_payments**: Payments against sales orders (for credit/follow-up payments).
- **sales_receipts**: Receipt snapshots (receipt_no, sales_order_id, snapshot_data / order_meta / order_items / order_payment, voided, generated_at).

These can be added in later migrations with timestamps after `20260131130000`.

---

## 5. sales_hold_orders (simplified: snapshot + index columns)

Snapshot of the current sale (cart) before checkout. When the user clicks “Hold”, the current order state is stored. Later they load a hold back into the UI, edit if needed, then checkout via `POST /api/sales/orders`.

### Snapshot-only vs explicit columns vs hybrid

| Approach | Pros | Cons |
|----------|------|------|
| **Snapshot only** (e.g. `id`, `snapshot` JSON, `encoder_id`, `is_archive`, `created_at`) | One source of truth; add new fields without migrations; exact match to frontend state. | List UI needs to parse JSON for every row (or use DB JSON operators + expression indexes); filtering/sort by customer, date, total is awkward; no FK for customer. |
| **Explicit columns** (current order fields as columns) | Simple queries for list/filter/sort; FKs; indexes. | Schema grows with every new “current order” field; duplication between columns and restore payload. |
| **Hybrid** (one `snapshot` JSON + a few columns for list/filter) | List/filter uses indexed columns; full restore from `snapshot`; new fields only in JSON. | Slight duplication: write snapshot and copy a few fields into columns on save. |

**Recommendation: hybrid.** Store the full current-order state in a single **snapshot** (JSON) for load/restore. Duplicate only what the **list UI** needs into columns: e.g. customer, date, total, payment type, so you can query/filter/sort and join to `customers` for the name without touching JSON.

### Columns (hybrid schema)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|--------|
| **id** | bigint | NO | — | PRIMARY KEY, auto-increment |
| **snapshot** | jsonb (or text) | NO | — | Full current-order state (see shape below); used only for load/restore |
| **customer_id** | bigint | YES | — | FK → customers; for list + join to show customer name |
| **order_date** | date | NO | — | For list/filter/sort |
| **total_amount** | decimal(15,2) | — | 0 | For list/filter/sort |
| **payment_type** | varchar(50) | NO | `'cash'` | CHECK: cash \| credit \| cheque; for list/filter |
| **is_archive** | boolean | — | false | For list filter (active vs archived) |
| **encoder_id** | bigint | YES | — | FK → users |
| **encoder_fullname** | varchar(255) | YES | — | For list display (denormalized) |
| **created_at** | timestamp | — | now() | For list sort |
| **last_updated** | timestamp | — | now() | |

All other fields (remark, items, withhold_*, first_payment, cheque_details, withhold_reference, etc.) live **only** in `snapshot`. When saving a hold: serialize current order → `snapshot`, and set the index columns from that same object.

### Snapshot JSON shape (suggestion)

Same shape as the “current sale” in the frontend (or close). Example:

```json
{
  "customer_id": 1,
  "order_date": "2026-01-31",
  "remark": "",
  "payment_type": "cash",
  "total_amount": 1200.50,
  "amount_paid": 1200.50,
  "withhold_percentage": null,
  "withhold_amount": null,
  "withhold_reference": "",
  "first_payment": null,
  "cheque_details": null,
  "items": [
    {
      "product_id": 1,
      "inventory_id": 10,
      "quantity": 5,
      "unit_price": 120.50,
      "batch_number": "BATCH001",
      "expiry_date": "2026-12-31",
      "product_name": "Product A",
      "product_code": "PRD001"
    }
  ]
}
```

**List:** `SELECT id, customer_id, order_date, total_amount, payment_type, encoder_fullname, created_at FROM sales_hold_orders WHERE is_archive = false ORDER BY created_at DESC` (join `customers` on `customer_id` for name).  
**Load one:** `SELECT snapshot FROM sales_hold_orders WHERE id = ?` → restore into UI.

### Foreign keys

- `customer_id` → `customers(id)` ON DELETE SET NULL  
- `encoder_id` → `users(id)` ON DELETE SET NULL  

### Indexes

- `customer_id`, `order_date`, `is_archive`, `payment_type` (for list/filter).

### Migration

- **File:** `api/db/migrations/20260131130100_create_sales_hold_orders_table.js` (runs after `sales_orders`).

---

## 6. sales_order_items (refined schema)

Line items for each sales order. Each row is one product (from a specific inventory batch) sold in that order.

### Design notes

- **sales_order_id**: FK to `sales_orders`; required; ON DELETE CASCADE (delete order → delete its items).
- **product_id**: FK to `products`; required (which product was sold).
- **inventory_id**: FK to `inventories`; required for sales because we sell *from* a specific batch (stock is deducted from this inventory row). Unlike purchase, inventory exists before the sale.
- **quantity**, **unit_price**, **total_price**: quantity sold, selling price per unit, and line total (quantity × unit_price). Use `decimal(15,2)` for consistency with rest of project.
- **batch_number / expiry_date**: Available on `inventories`; join when needed for receipt/display. Not duplicated here unless you want denormalized receipt snapshot.
- **created_at**, **last_updated**, **sync_status**: Same as purchase_order_items.

### Columns (human-readable)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|--------|
| **id** | bigint | NO | — | PRIMARY KEY, auto-increment |
| **sales_order_id** | bigint | NO | — | FK → sales_orders(id) ON DELETE CASCADE |
| **product_id** | bigint | NO | — | FK → products(id) ON DELETE CASCADE |
| **inventory_id** | bigint | NO | — | FK → inventories(id) ON DELETE CASCADE; batch sold from |
| **quantity** | integer | NO | — | Units sold |
| **unit_price** | decimal(15,2) | NO | — | Selling price per unit |
| **total_price** | decimal(15,2) | NO | — | quantity × unit_price |
| **created_at** | timestamp | — | now() | |
| **last_updated** | timestamp | — | now() | |
| **sync_status** | varchar(255) | — | `'pending'` | |

### Foreign keys

- `sales_order_id` → `sales_orders(id)` ON DELETE CASCADE  
- `product_id` → `products(id)` ON DELETE CASCADE  
- `inventory_id` → `inventories(id)` ON DELETE CASCADE  

### Indexes

- `sales_order_id`, `product_id`, `inventory_id` (for lookups and joins).

### Migration

- **File:** `api/db/migrations/20260131130200_create_sales_order_items_table.js` (runs after `sales_orders`).
