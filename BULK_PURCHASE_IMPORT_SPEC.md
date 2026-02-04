# Bulk Purchase Order Import from CSV/Spreadsheet

This document defines how to prepare and upload bulk purchase orders from CSV or spreadsheet files, and how the data is converted into order objects and persisted (with supplier/product name resolution).

---

## 1. Spreadsheet layout rules

### 1.1 Supported layout: **denormalized (one row per line item)**

Because one order can have multiple items, the recommended and only supported layout for a **single CSV/sheet** is **denormalized**:

- **One row per order line item.**
- **Order-level columns** (supplier, date, invoice, totals, payment) are **repeated on every row** that belongs to the same order.
- **Item-level columns** (product, batch, expiry, quantity, unit price) **vary per row**.

Example:

| supplier_name | order_date  | invoice_number | total_amount | amount_paid | withhold_percentage | payment_mode | product_name | batch_number | expiry_date | quantity | unit_price |
|---------------|-------------|----------------|--------------|-------------|---------------------|--------------|--------------|--------------|-------------|----------|------------|
| Company X     | 2026-01-15  | INV-001        | 15000        | 15000       | 2                   | cash         | Amoxa 500    | BATCH-A      | 2030-05-01  | 3        | 3000       |
| Company X     | 2026-01-15  | INV-001        | 15000        | 15000       | 2                   | cash         | Paracetamol  | BATCH-B      | 2028-12-31  | 10       | 500        |

Here, the two rows form **one order** (same supplier_name, total_amount, withhold_percentage, amount_paid, payment_mode) with **two items**.

### 1.2 Order grouping key

Orders are grouped by a **composite key** so that multiple rows are merged into one order with an `items` array:

- **Key:** `(supplier_name, total_amount, withhold_percentage, amount_paid, payment_mode)`
- **Rule:** Rows with the same key are treated as one order; their item columns are combined into a single `items` array.
- To have two separate orders from the same supplier, use different values for at least one of: `total_amount`, `withhold_percentage`, `amount_paid`, or `payment_mode`.

### 1.3 Column names (required and optional)

Column names are **case-insensitive** and **normalized** (spaces/underscores). The following aliases are accepted:

| Canonical field         | Accepted column names (examples) |
|-------------------------|-----------------------------------|
| supplier_name           | supplier name, supplier_name, suppliername, supplier |
| order_date              | order date, order_date, orderdate, date |
| invoice_number          | invoice number, invoice_number, invoicenumber, invoice_no, invoice |
| total_amount            | total amount, total_amount, totalamount, total |
| amount_paid             | amount paid, amount_paid, amountpaid, paid |
| withhold_percentage     | withhold percentage, withhold_percentage, withholdpercentage, withhold |
| payment_mode            | payment mode, payment_mode, paymentmode, mode |
| product_name            | product name, product_name, productname, product |
| batch_number            | batch number, batch_number, batchnumber, batch |
| expiry_date             | expiry date, expiry_date, expirydate, expiry |
| quantity                | quantity, qty |
| unit_price              | unit price, unit_price, unitprice, price |

Optional item-level fields (for display/future use; product creation may use defaults if not in DB):

| Canonical field | Accepted column names |
|-----------------|------------------------|
| category        | category |
| unit            | unit |

- **Order meta required (per row):** `supplier_name`, `amount_paid`, `withhold_percentage`. For grouping, `total_amount` and `payment_mode` are also required (same value on every row of the same order).
- **Item required (per row):** `product_name`, `quantity`, `unit_price`.
- **Optional order-level:** `order_date`, `invoice_number` (defaults: today, empty when missing).
- **Dates:** `order_date` and `expiry_date` must be **YYYY-MM-DD** or parseable when provided.
- **Numbers:** `total_amount`, `amount_paid`, `withhold_percentage`, `quantity`, `unit_price` must be valid numbers (decimals allowed).
- **payment_mode:** When provided, one of `cash`, `credit`, `cheque` (case-insensitive).

### 1.4 Validation rules before conversion

- **Order meta required:** `supplier_name`, `total_amount`, `amount_paid`, `withhold_percentage`, `payment_mode`.
- **Item required:** `product_name`, `quantity`, `unit_price`.
- `quantity` and `unit_price` > 0.
- `withhold_percentage` in [0, 100].
- `order_date` and `expiry_date` (if present) valid and parseable.
- `payment_mode` required; one of { cash, credit, cheque }.

---

## 2. Converted order object shape

After parsing and grouping, each order is represented as:

```js
{
  supplier_name: 'Company X',
  order_date: '2026-01-15',
  invoice_number: 'INV-001',
  total_amount: 15000,
  amount_paid: 15000,
  withhold_percentage: 2,
  payment_mode: 'cash',
  items: [
    {
      product_name: 'Amoxa 500',
      batch_number: 'BATCH-A',
      category: 'supplies',
      unit: 'bottle',
      expiry_date: '2030-05-01',
      unit_price: 3000,
      quantity: 3
    },
    {
      product_name: 'Paracetamol',
      batch_number: 'BATCH-B',
      category: null,
      unit: null,
      expiry_date: '2028-12-31',
      unit_price: 500,
      quantity: 10
    }
  ]
}
```

- **total_amount / amount_paid / withhold_percentage:** From the grouping key (required on every row of the same order).
- **order_date:** From first row of the group if provided; otherwise default to today.
- **category / unit:** Optional; used when creating new products (see Resolution below).

---

## 3. Resolution: supplier and product names to IDs

The API expects `supplier_id` and, per item, `product_id`. Resolution rules:

### 3.1 Supplier

- **Lookup:** Find customer where `LOWER(name) = LOWER(supplier_name)` and `customer_type` in `('supplier', 'both')`.
- **If found:** Use that `id` as `supplier_id`.
- **If not found:** Create a new customer with `name = supplier_name`, `customer_type = 'supplier'`; use the new `id` as `supplier_id`.

### 3.2 Product

- **Lookup:** Find product where `LOWER(name) = LOWER(product_name)`.
- **If found:** Use that `id` as `product_id`.
- **If not found:** Create a new product:
  - `name = product_name`
  - `category_id`: from item `category` (resolve category by name) or default category (e.g. category named "supplies" or first category in DB).
  - `unit_id`: from item `unit` (resolve unit by name) or default unit (e.g. unit named "bottle" or first unit in DB).
  - Product code auto-generated (e.g. PRD0001, PRD0002).

After resolution, each order is turned into the API shape:

- `supplier_id`, `order_date`, `invoice_no`, `payment_mode`, `withhold_percentage`, `first_payment` (from amount_paid for credit/cheque), etc.
- `items`: array of `{ product_id, quantity, unit_price, batch_number, expiry_date }`.

---

## 4. Conversion pipeline summary

1. **Parse** CSV/text into rows with normalized column names.
2. **Validate** each row (order meta required: supplier_name, total_amount, amount_paid, withhold_percentage; item required: product_name, quantity, unit_price; types, ranges).
3. **Group** rows by `(supplier_name, total_amount, withhold_percentage, amount_paid, payment_mode)`.
4. **Build** one order object per group with an `items` array (and optional category/unit per item); use first row’s order_date or default.
5. **Send** array of order objects to the API (e.g. `POST /api/purchases/import-from-spreadsheet`).
6. **API** resolves supplier and product names (find or create), then creates purchase orders and related records (items, payments, inventory, ledger as per existing flow).

---

## 5. File format

- **Encoding:** UTF-8.
- **Delimiter:** Comma (`,`). For other delimiters (e.g. tab), pre-convert or use a parser option.
- **Header:** First row must be header; column names are normalized as above.
- **Quotes:** Fields containing commas or newlines should be double-quoted; escaped quotes as `""`.
