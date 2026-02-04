# Purchase Order Completion Algorithm — Outline for Review

This document outlines the end-to-end flow when a user **completes** a purchase order (Checkout → Confirm → Complete). Use it to review correctness.

---

## 1. Entry point (Frontend)

**Where:** Checkout confirmation modal → "Complete" button  
**What:** `PurchaseVM.processOrder()` is called.

**Preconditions (enforced earlier):**
- User already passed validation when opening the confirmation modal (supplier, items, payment mode, cheque/credit details if applicable).
- No re-validation in `processOrder()` before sending; validation was done in `openCheckoutConfirmationModal()`.

---

## 2. Frontend: build payload and call API

**Where:** `PurchaseVM.processOrder()` (app/src/components/modules/purchase/PurchaseVM.js)

**Steps:**
1. Guard: if `loading` or missing `supplier_id` / `items`, throw.
2. Set `loading` true, clear `error` / `success`.
3. Build **orderData**:
   - `supplier_id` — number
   - `order_date`, `invoice_no`, `payment_mode`, `notes`, `status: 'completed'`
   - `withhold_percentage`: from `currentOrder.is_withholding` and `getState('withhold-percentage')`, else null
   - `first_payment`: for credit only, number; else null
   - `cheque_details`: for cheque only, with `amount` as number; else null
   - **items**: each item has `product_id`, `quantity` (integer ≥ 1), `unit_price`, `batch_number`, `expiry_date` (all numbers where applicable)
4. Call `window.ipcRenderer.invoke('purchase:create-order', orderData)`.
5. On success: set success message, `resetCurrentOrder()`, optionally `loadOrders()` if on order-history tab, return.
6. On failure: set error message, rethrow.
7. In `finally`: set `loading` false.

**Note:** Frontend does **not** send subtotal/withhold/net/amount_paid; the API recomputes them.

---

## 3. Electron (IPC → HTTP)

**Where:** `ipcMain.handle('purchase:create-order')` → `PurchaseManager.createOrder(orderData, token)`  
**What:** POST to API `/purchases/orders` with JSON body and auth token. Returns API JSON (e.g. `{ ok, purchase_order }` or error). Frontend treats success when `result.success` (or equivalent) and then resets UI.

---

## 4. API: Controller and validation

**Where:** `POST /api/purchases/orders`, purchase.controller.js, purchase.schema.js

**Steps:**
1. Body validated with **createPurchaseOrderSchema** (Zod):
   - `supplier_id` (number, positive), `order_date` (YYYY-MM-DD), `invoice_no` optional
   - `items`: array, each item `product_id`, `quantity` (int, positive), `unit_price` (positive), `batch_number` / `expiry_date` optional
   - `payment_mode`: 'cash' | 'credit' | 'cheque'
   - `withhold_percentage` optional; `first_payment` optional; `cheque_details` required when payment_mode === 'cheque'
2. Controller: `createOrder(req.validBody || req.body, req.user)`.

---

## 5. API: Service — business logic and financials

**Where:** `PurchaseService.createOrder(payload, user)` (purchase.service.js)

**Steps:**

1. **Extract payload:** supplier_id, order_date, invoice_no, items, payment_mode, withhold_percentage, first_payment, cheque_details, notes, status, hold_order_id.

2. **Validate:** At least one item.

3. **Compute per-item total_price:**  
   `total_price = quantity * unit_price` for each item; **subtotal** = sum of total_price.

4. **Resolve withhold:**
   - If `withhold_percentage` provided, use it; else read from system setting (e.g. getWithholdPercentageSetting()).
   - **withhold_amount** = (subtotal × withhold_percentage) / 100 if applicable, else 0.
   - **net_amount** = subtotal − withhold_amount.

5. **Initial payment by payment_mode:**
   - **cash:** amount_paid = net_amount; initialPayment = { amount: net_amount, payment_method: 'cash', payment_date, note }.
   - **credit:** amount_paid = first_payment (or 0); if first_payment > 0, initialPayment = { amount, payment_method: 'credit', payment_date, note }.
   - **cheque:** require cheque_details; amount_paid = cheque_details.amount; initialPayment = { amount, payment_method: 'cheque', payment_date, cheque_no, bank_name, cheque_date, note }.

6. **Payment status:**
   - remaining = net_amount − amount_paid.
   - payment_status = 'paid' if remaining ≤ 0.009 and amount_paid > 0; else 'partial' if amount_paid > 0; else 'unpaid'.

7. **Receipt number:** Generate next PO receipt (e.g. `generateNextReceiptNumber()` → PO000001, PO000002, …).

8. **Build order payload for repository:**
   - supplier_id, order_date, invoice_no, remark, payment_mode, payment_status
   - total_amount = **subtotal** (not net_amount — design choice; withhold is tracked separately)
   - amount_paid, withhold_percentage, withhold_amount, withhold_settled: false
   - receipt_no, status, encoder_fullname, hold_order_id

9. **Build receipt snapshot:** order_meta, order_items (with total_price), order_payment (initial_payment_mode, initial_payment_amount, remaining_balance), snapshot_data.

10. **Call repository:**  
    `createOrderWithItemsAndReceipt({ order: orderData, items: enrichedItems, initialPayment, receiptSnapshot }, userId)`.

11. **Return:** Shaped order (id, receipt_number, supplier_id, order_date, subtotal, withhold_amount, net_amount, payment_mode, status, created_at).

---

## 6. API: Repository — single transaction

**Where:** `PurchaseRepository.createOrderWithItemsAndReceipt(payload, userId)` (purchase.repository.js)

**All steps run inside one DB transaction.** If any step fails, the whole transaction rolls back.

**Summary of what is written:**

| Area            | Tables / layer        | What is recorded |
|-----------------|------------------------|-------------------|
| **Order**       | purchase_orders        | Header: supplier, dates, totals, payment_mode, receipt_no, status. |
| **Items**       | purchase_order_items   | One row per line: product_id, quantity, unit_price, total_price; inventory_id set later. |
| **Payments**    | purchase_payments      | Optional one row: initial payment (amount, payment_method, cheque details if cheque). |
| **Receipt**     | purchase_receipts      | Snapshot JSON: order_meta, order_items, order_payment for print/audit. |
| **Inventory**   | inventories            | Per item: find or create by (product, batch, expiry, price); increase quantity or insert new. |
| **Bin cards**   | bin_cards              | Per item: one “received” row with opening_balance, quantity_in, balance. |
| **Ledger**      | account_ledger         | One set of double-entry rows per order (see § 7). |

**How items are handled**

- One row per line in **purchase_order_items**: `purchase_order_id`, `product_id`, `quantity`, `unit_price`, `total_price`; `inventory_id` is null at insert, then set in step 6.5.
- For each item, **inventory** is found or created by `findExistingInventory(product_id, batch_no, expiry_date, unit_price)`: match on product_id, purchase_price, and batch_no/expiry_date (both can be null). If found, quantity is increased; if not, a new row is inserted (inventory_code, purchase_date, acquisition_type, purchase_price, quantity, notes, etc.).
- **purchase_order_items.inventory_id** is updated to the inventory id used.
- One **bin card** row per item (see § 8).

**How payments are handled**

- If the service passes **initialPayment** with amount > 0, one row is inserted into **purchase_payments**: `purchase_order_id`, `payment_date`, `amount`, `note`, `payment_method` ('cash' | 'credit' | 'cheque'), and for cheque: `cheque_no`, `bank_name`, `branch_name`, `cheque_date`. No ledger entry is posted for “recording the payment” at completion; the ledger records the **purchase** (inventory + cash/payable withhold) in step 6.6. Later payments against the same order use **recordPurchasePayment** (DR Accounts Payable, CR Cash).

**6.1 — Insert order row**
- Insert into `purchase_orders`: supplier_id, order_date, invoice_no, remark, payment_mode, payment_status, total_amount, amount_paid, withhold_*, receipt_no, status, encoder_id, encoder_fullname, timestamps.
- Obtain `orderId`.

**6.2 — Insert order items**
- For each item: insert into `purchase_order_items` (purchase_order_id, product_id, quantity, unit_price, total_price, inventory_id = null initially).
- Obtain `insertedItems`.

**6.3 — Optional initial payment**
- If `initialPayment` exists and amount > 0: insert into `purchase_payments` (purchase_order_id, payment_date, amount, note, payment_method, cheque_no, bank_name, cheque_date, etc.).

**6.4 — Receipt snapshot**
- If `receiptSnapshot` provided: insert into `purchase_receipts` (receipt_no, purchase_order_id, snapshot_data, order_meta, order_items, order_payment as JSON strings, voided = false).

**6.5 — Inventory, bin card, and item–inventory link (per item)**

For **each** inserted order item:

1. **Product:** Load product by product_id; if not found, throw (transaction rolls back).
2. **Batch/expiry:** From original `items` (same product_id): batch_number, expiry_date.
3. **Find or create inventory:**
   - **findExistingInventory(product_id, batchNo, expiryDate, unit_price)** — match on product_id, batch_no, expiry_date, purchase_price.
   - If **found:**  
     - UPDATE `inventories` SET quantity = quantity + item.quantity WHERE id = inventory.id.
     - inventoryId = that inventory id.
   - If **not found:**  
     - Generate inventory_code (e.g. I001 + product code digits).
     - INSERT into `inventories` (product_id, inventory_code, batch_no, expiry_date, purchase_date, acquisition_type, purchase_price, quantity, selling_price, settlement_status, notes, …).
     - inventoryId = new id.
4. **Link item to inventory:** UPDATE `purchase_order_items` SET inventory_id = inventoryId WHERE id = item.id.
5. **Bin card:**  
   - **getLastProductBalance(product_id, trx)** — last balance for this product from `bin_cards` (by transaction_date, id desc).  
   - **createBinCardTransaction(...)** — insert bin card row: opening_balance, quantity_in = item.quantity, balance = opening_balance + quantity, reference to inventory, reason = "Purchase Order {receipt_no}", etc.

**6.6 — Ledger (by payment_mode)**

One set of double-entry ledger rows is posted per order via `LedgerHelper` (see **§ 7** for accounts and amounts).

- **cash:** `ledgerHelper.recordPurchaseCash({ purchaseOrderId, totalAmount, withholdAmount, transactionDate, referenceNumber, memo, createdBy }, trx)`.
- **credit:** `ledgerHelper.recordPurchaseCredit({ ..., firstPayment: initialPayment?.amount || 0 }, trx)`.
- **cheque:** `ledgerHelper.recordPurchaseCheque({ ..., chequeAmount: initialPayment?.amount || 0 }, trx)`.

**6.7 — Return**
- Return { order: insertedOrder, items: insertedItems, initialPayment, inventoryIds }.

---

## 7. Account ledger — accounts affected and double-entry

All purchase completion entries use **chart_of_accounts** by **account_code**. One logical transaction may create multiple **account_ledger** rows (one per account in the entries array). Debits and credits per transaction are equal.

**Account codes used:**

| Code | Account name              | Role in purchase completion      |
|------|---------------------------|-----------------------------------|
| 1300 | Inventory                 | Debit: cost of inventory received |
| 1100 | Cash / Bank               | Credit: cash/cheque paid; Credit on later payments |
| 3100 | Accounts Payable          | Credit: amount owed to supplier (credit/cheque)     |
| 3200 | Accounts Withhold Payable | Credit: withhold amount (when withholding applies)  |

**Cash (full payment, no withhold):**

- DR Inventory (1300) = net_amount  
- CR Cash (1100) = net_amount  

**Cash with withhold:**

- DR Inventory (1300) = total_amount (subtotal)  
- CR Cash (1100) = net_amount  
- CR Accounts Withhold Payable (3200) = withhold_amount  

**Credit (supplier payable + optional first payment):**

- DR Inventory (1300) = total_amount  
- CR Accounts Payable (3100) = net_amount − first_payment  
- If first_payment > 0: CR Cash (1100) = first_payment  
- If withhold > 0: CR Accounts Withhold Payable (3200) = withhold_amount  

**Cheque:**

- DR Inventory (1300) = total_amount  
- CR Cash (1100) = cheque_amount (amount paid by cheque)  
- If net_amount − cheque_amount > 0: CR Accounts Payable (3100) = that remainder  
- If withhold > 0: CR Accounts Withhold Payable (3200) = withhold_amount  

**Ledger row fields (account_ledger):**

- `transaction_date`, `account_code`, `account_name`, `debit`, `credit`, `balance` (running balance per account)
- `reference_no` = receipt_no (e.g. PO000001), `reference_table` = `'purchase_orders'`, `reference_id` = purchase_order id
- `transaction_type` = `'purchase'`, `description` includes receipt and memo

---

## 8. Bin card transactions (per order item)

For **each** purchase order line, after the inventory record is found/created and `purchase_order_items.inventory_id` is set:

1. **Opening balance:** `getLastProductBalance(product_id, trx)`  
   - Last row in `bin_cards` for that `product_id` ordered by `transaction_date` desc, `id` desc; use its `balance`, or 0 if none.

2. **New bin card row:** `createBinCardTransaction({ ... }, trx)`  
   - **product_id**, **inventory_id**: from the item and the inventory record just used.  
   - **batch_no**, **expiry_date**: from the order item (can be null).  
   - **transaction_date**: order date.  
   - **transaction_type**: `'received'`.  
   - **reference_table**: `'inventories'`, **reference_id**: inventory_id.  
   - **opening_balance**: from step 1.  
   - **quantity_in**: item quantity, **quantity_out**: 0.  
   - **balance**: opening_balance + quantity_in (running balance for that product).  
   - **unit_cost**, **total_cost**: item unit_price and quantity × unit_price.  
   - **reason**: e.g. `"Purchase Order PO000001"`, **notes**: product name.

**Note:** If the same product appears on multiple lines, each line gets its own bin card row; `getLastProductBalance` is called after the previous line’s bin card insert, so the running balance reflects all lines in the same order.

---

## 9. Back to frontend

- On success: VM sets success message, resets current order (clear items, supplier, etc.), optionally reloads order list.
- On error: VM sets error message; user can correct and retry.

---

## 10. Summary checklist for correctness review

| Area | Check |
|------|--------|
| **Validation** | Supplier, ≥1 item, payment_mode; credit → first_payment; cheque → cheque_details; amounts vs net where applicable. |
| **Numbers** | Frontend sends numbers (supplier_id, product_id, quantity, unit_price); API validates types. |
| **Financials** | Subtotal from items; withhold from setting or payload; net = subtotal − withhold; amount_paid and payment_status consistent with mode. |
| **Order row** | total_amount = subtotal (withhold stored separately); amount_paid, payment_status, receipt_no set. |
| **Items** | Stored with purchase_order_id, product_id, quantity, unit_price, total_price; later linked to inventory_id. |
| **Payment** | One initial payment row when cash (full) or credit/cheque with amount > 0. |
| **Inventory** | Per product/batch/expiry/price: one inventory row; quantity increased or new row created; purchase_order_items.inventory_id set. |
| **Bin card** | One bin card transaction per order item; opening_balance from last balance for that product; quantity_in = order quantity; balance updated. |
| **Ledger** | One set of ledger entries per order (cash / credit / cheque) with correct amounts and reference. |
| **Receipt** | Snapshot stored for printing/audit (order_meta, order_items, order_payment). |
| **Atomicity** | Entire create is in one transaction; any failure rolls back order, items, payments, inventories, bin cards, ledger. |

---

## 11. Potential issues to double-check (suggested review)

1. **total_amount in purchase_orders:** Currently set to **subtotal** (before withhold). If reports or downstream logic expect “net” in total_amount, this may need to be net_amount or a separate field clarified.
2. **getLastProductBalance:** Called per item in sequence; each bin card uses “last” balance at call time. If multiple items are the same product, the second item’s opening_balance includes the first item’s bin card insert (same transaction). Confirm that this matches intended “running balance per product” semantics.
3. **findExistingInventory:** Match on (product_id, batch_no, expiry_date, purchase_price). Same product with different batch/expiry/price creates a new inventory row; same batch/expiry/price reuses and adds quantity. Confirm business rules (e.g. FIFO vs batch-level tracking).
4. **Frontend validation:** `validateOrder()` uses `!currentOrder.payment_mode === 'credit'` which is wrong (always false). Should be `currentOrder.payment_mode === 'credit'` for “first payment required when credit”. Same for cheque checks. Recommend fixing to `=== 'credit'` and `=== 'cheque'`.

If you want, the next step can be proposing concrete code changes for the validation bug and any total_amount/bin-card semantics you want to adjust.
