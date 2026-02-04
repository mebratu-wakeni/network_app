# How the Accounts Ledger Is Affected by Sales Orders

## Current State

**Sales orders do not currently post to the accounts ledger.**  
When you create a sales order, the API only:

1. Inserts into `sales_orders` and `sales_order_items`
2. Decrements `inventories.quantity` for each item sold

No rows are written to `account_ledger`. So **the ledger is not affected by sales** in the current implementation.

---

## How the Ledger Works in This Project

- **Double-entry:** Every transaction has equal debits and credits. The shared helper is `api/src/services/ledger.helper.js`; it posts to `account_ledger` with `reference_table` / `reference_id` and `transaction_type`.
- **Account codes** (from `chart_of_accounts` / seed):

| Code | Account Name           | Used for                                      |
|------|------------------------|-----------------------------------------------|
| 1100 | Cash                   | Cash/Bank receipts and payments               |
| 1200 | Accounts Receivable    | Amounts owed by customers (credit sales)      |
| 1300 | Inventory              | Stock value (purchases DR, sales/cogs CR)     |
| 3100 | Accounts Payable       | Amounts owed to suppliers                     |
| 3200 | Accrued / Withhold     | Ledger helper uses this for withhold payable  |
| 3210 | Withholding Payable    | Tax withheld (chart seed)                     |
| 4300 | Opening Balance        | Initial/opening balances                      |
| 5100 | Sales Revenue          | Revenue from sales of goods                   |
| 6100 | Cost of Goods Sold     | Cost of inventory sold                        |

---

## How Purchase Affects the Ledger (Reference)

When a **purchase order** is completed, the purchase repository calls `LedgerHelper` inside the same transaction:

- **Cash:**  
  DR Inventory (1300), CR Cash (1100).  
  If withhold: also CR 3200 and increase Inventory DR by withhold amount.
- **Credit:**  
  DR Inventory (1300), CR Accounts Payable (3100), and if there is first payment: CR Cash (1100). Withhold: CR 3200.
- **Cheque:**  
  Same idea: DR Inventory (1300), CR Cash (1100) for cheque amount, CR AP (3100) for balance, CR 3200 for withhold.

Later **purchase payments** post:  
DR Accounts Payable (3100), CR Cash (1100).

**Reversing a purchase** calls `ledgerHelper.reversePurchaseOrder(...)`, which finds all ledger rows for that purchase and posts reversing entries.

So for purchase: **inventory increase, payables/cash, and withhold are all reflected in the ledger.**

---

## How Sales *Should* Affect the Ledger (Not Implemented)

Conceptually, a **completed sale** has two parts:

1. **Revenue and receipt of cash or receivable**
2. **Reduction of inventory and recognition of cost of goods sold (COGS)**

### 1. Revenue side (by payment type)

- **Cash sale**  
  - DR Cash (1100) — net of withhold if applicable  
  - CR Sales Revenue (5100)  
  - If withhold: e.g. CR Withholding Payable (3200 or 3210) and reduce Cash DR accordingly (depending on how you treat withhold on sales).

- **Credit sale**  
  - DR Accounts Receivable (1200) — net amount owed by customer  
  - CR Sales Revenue (5100)  
  - If customer pays part now: DR Cash (1100), CR Accounts Receivable (1200) for that payment.  
  - Withhold (if any) same as above.

- **Cheque sale**  
  - Same as cash from a ledger perspective: DR Cash (1100), CR Sales Revenue (5100), plus withhold if applicable.

When the customer **pays later** (sales payment):  
DR Cash (1100), CR Accounts Receivable (1200).

### 2. Cost side (COGS and inventory)

- For each sold item you need the **cost** of that inventory (e.g. `purchase_price` or average cost from `inventories`), not the selling price.
- **Total COGS** = sum over items of (quantity × cost).
- Entry:  
  - DR Cost of Goods Sold (6100)  
  - CR Inventory (1300)  
  So the ledger reflects both the **revenue** (5100) and the **cost** (6100, 1300) of the sale.

### 3. Withhold on sales

- If sales withhold is treated like purchase (tax withheld for authority):  
  - Reduce revenue or split: part to Sales Revenue (5100), part to Withholding Payable (3200/3210).  
- Exact treatment depends on your chart of accounts and policy; the important point is that **sales currently do not post any of these entries**.

### 4. Reversing a sale

- Reverse **revenue**: DR Sales Revenue (5100), CR Cash (1100) or CR Accounts Receivable (1200).  
- Reverse **COGS**: CR Cost of Goods Sold (6100), DR Inventory (1300).  
- Plus any reversing entries for withhold if you had posted them.

---

## Summary Table (What *would* happen if sales posted to the ledger)

| Event              | Debit (DR)        | Credit (CR)       |
|--------------------|-------------------|--------------------|
| Cash sale          | 1100 Cash         | 5100 Sales Revenue |
| Credit sale        | 1200 AR           | 5100 Sales Revenue |
| Customer payment   | 1100 Cash         | 1200 AR            |
| COGS (on sale)     | 6100 COGS         | 1300 Inventory     |
| Withhold (if used) | (depends on policy)| 3200/3210 Withhold |
| Reverse sale       | Opposite of above | Opposite of above  |

---

## What You Need to Implement

To have sales affect the ledger in the same way purchase does:

1. **In `api/src/services/ledger.helper.js`**  
   Add helpers, for example:
   - `recordSaleCash(...)` — DR 1100, CR 5100 (and withhold if needed)
   - `recordSaleCredit(...)` — DR 1200, CR 5100
   - `recordSaleCheque(...)` — same as cash
   - `recordSalePayment(...)` — DR 1100, CR 1200 (when customer pays)
   - `recordSaleCOGS(...)` — DR 6100, CR 1300 (using cost from inventories)
   - `reverseSalesOrder(...)` — reverse all entries for that sales order

2. **In `api/src/modules/sales/sales.repository.js`**  
   - Inject/use `LedgerHelper` (same pattern as purchase).
   - Inside the same transaction that creates the order and decrements inventory:
     - Call the appropriate `recordSale*` for the payment type (and withhold if applicable).
     - Call `recordSaleCOGS` using item quantities and cost from `inventories` (e.g. `purchase_price` or your cost field).
   - On **payment** (customer pays later): call `recordSalePayment`.
   - On **reverse**: after restoring inventory, call `reverseSalesOrder`.

3. **Cost for COGS**  
   Ensure you have a cost per unit for each inventory row (e.g. `inventories.purchase_price` or equivalent). When creating the sales order you already have `inventory_id` and quantity; use that to look up cost and sum COGS.

Once these are in place, the accounts ledger will be affected by sales orders in a way that mirrors purchase: revenue, cash/AR, withhold (if used), and COGS/Inventory, plus reversals.
