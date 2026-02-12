# Financial Module – ERP Design & Planning Document

**Status:** Planning & Design only — no implementation  
**Last Updated:** February 7, 2025  
**Scope:** Financial management submodule within the network-desktop-app ERP

---

## 1. Executive Summary

The Financial Module provides centralized control over **expenses**, **receivables**, **payables**, **withholding tax**, and **deposits/capital movements**. It integrates with the existing General Ledger via `LedgerHelper` and extends the chart of accounts where needed. The module follows standard ERP accounting principles while accommodating Ethiopian withholding tax workflows (withhold receivable vs withhold payable) and cash borrow/lend tracking.

---

## 2. Module Overview

### 2.1 Sub-module Structure

| Sub-module | Purpose | ERP Equivalent |
|------------|---------|----------------|
| **Expense** | Record operating and non-operating expenses | Expense Management |
| **Account Receivables** | Track amounts owed to the company + cash lent out + withhold receivable | AR, Loans Receivable, Withhold Receivable |
| **Account Payables** | Track amounts owed by the company + cash borrowed + withhold payable | AP, Loans Payable, Withholding Tax Payable |
| **Deposits** | Capital inflows: deposits, contributions, seed capital | Treasury / Equity Movement |

### 2.2 Clarifications (Professional ERP Alignment)

| Your Term | Professional Term | Clarification |
|-----------|-------------------|---------------|
| Cash borrow-from | **Loans Payable** / **Due to Others** | Money the company borrowed (we owe). Already in chart as 3300 Loans Payable. |
| Cash borrow-to | **Loans Receivable** / **Due from Others** | Money the company lent (others owe us). May need new GL account. |
| Withhold-receivables | **Withholding Tax Receivable** | Tax withheld by customers on our sales; we claim at month-end. Chart: 1250. |
| Withhold-payables | **Withholding Tax Payable** | Tax we withhold from suppliers; we remit to government. Chart: 3210. |
| Deposits / contributions / initial seed | **Capital contributions**, **Bank deposits**, **Opening equity** | Various equity or asset movements. |

**Important:**  
- **Inventory borrow-from / borrow-to** (goods) remain in the **Inventory** module.  
- The **Financial** module handles **cash** transactions only.

---

## 3. Sub-module Specifications

### 3.1 Expense Sub-module

**Purpose:** Record operating expenses (utilities, rent, salaries, supplies, etc.) and other expenses not tied to inventory.

**Key Operations:**
- Create expense records (date, category, amount, payee, payment method)
- Optional attachment/reference
- Post to ledger: DR Expense (6200/6300 etc.), CR Cash (1100) or CR AP (3100)

**DB Table:** `expenses` (schema to be provided by you)

**Ledger Integration:**
- `transaction_type`: `expense`
- `reference_table`: `expenses`
- Typical: DR 6200 Operating Expenses, CR 1100 Cash (or CR 3100 if on credit)

---

### 3.2 Account Receivables Sub-module

Tab-based UI with three logical areas:

#### Tab A: Trade Receivables (AR)

- **Source:** Credit sales (`sales_orders`) when `payment_status` is partial/unpaid
- **Display:** Outstanding balances by customer (from existing sales payment flow)
- **Actions:** Record payments (already handled by Sales module)
- **Ledger:** DR Cash, CR AR (1200) via existing `recordSalesPayment`

#### Tab B: Loans Receivable (Cash Borrow-To)

- **Purpose:** Track cash lent to partners/others and returns
- **Operations:**
  - Create loan: DR Loans Receivable (new account, e.g. 1210), CR Cash (1100)
  - Record return: DR Cash (1100), CR Loans Receivable (1210)
- **DB Table:** `cash_loans_receivable` (or similar)
  - Fields: partner_id, amount, lent_date, expected_return_date, returned_amount, status, notes

#### Tab C: Withholding Tax Receivable

- **Source:** `sales_orders` where `withhold_amount > 0` and `withhold_confirmation = true`
- **Purpose:** Accumulate confirmed withholds to be claimed from tax authority at month-end
- **Operations:**
  - List confirmed withhold amounts by sales order
  - Settlement: Create withhold settlement batch (e.g. per calendar month)
  - On settlement: DR Cash / Tax Receivable (or offset against tax liability), CR Withhold Receivable (1250)
  - Update `sales_orders.withhold_settled = true` for settled orders
- **Ledger on settlement:** DR Cash (1100) or appropriate tax account, CR Withhold Receivable (1250)

**Withhold Settlement Workflow:**

1. End of month: Aggregate all confirmed withhold receivables (e.g. `WHERE withhold_confirmation = true AND withhold_settled = false`).
2. Create settlement record (e.g. `withhold_receivable_settlements`) with batch date, total amount, reference to tax authority.
3. Post GL: DR Cash (or tax receivable), CR 1250 Withhold Receivable.
4. Update `sales_orders.withhold_settled = true` for all included orders.

---

### 3.3 Account Payables Sub-module

Tab-based UI with three logical areas:

#### Tab A: Trade Payables (AP)

- **Source:** Credit purchases (`purchase_orders`) when payment_status is partial/unpaid
- **Display:** Outstanding balances by supplier
- **Actions:** Record payments (already handled by Purchase module)
- **Ledger:** DR AP (3100), CR Cash (1100) via existing `recordPurchasePayment`

#### Tab B: Loans Payable (Cash Borrow-From)

- **Purpose:** Track cash borrowed from partners/others and repayments
- **Operations:**
  - Create loan: DR Cash (1100), CR Loans Payable (3300)
  - Record repayment: DR Loans Payable (3300), CR Cash (1100)
- **DB Table:** `cash_loans_payable` (or similar)
  - Fields: partner_id, amount, borrowed_date, expected_repay_date, repaid_amount, status, notes

#### Tab C: Withholding Tax Payable

- **Source:** `purchase_orders` where `withhold_amount > 0`
- **Purpose:** Track tax withheld from suppliers; company must remit to government
- **Operations:**
  - List withhold amounts by purchase order
  - Settlement: Create withhold payable settlement batch (per calendar month)
  - On settlement: DR Withhold Payable (3210), CR Cash (1100)
  - Update `purchase_orders.withhold_settled = true` for settled orders
- **Ledger on settlement:** DR Withholding Payable (3210), CR Cash (1100)

**Withhold Settlement Workflow:**

1. End of month: Aggregate all unsettled withhold payables.
2. Create settlement record (e.g. `withhold_payable_settlements`) with batch date, total amount, tax authority reference.
3. Post GL: DR 3210 Withholding Payable, CR 1100 Cash.
4. Update `purchase_orders.withhold_settled = true` for all included orders.

---

### 3.4 Deposits Sub-module

**Purpose:** Record capital contributions, bank deposits, initial seed capital, and similar inflows.

**Key Operations:**
- Create deposit/contribution record (date, type, amount, source/description)
- Types: `deposit`, `contribution`, `initial_seed`, `capital_injection`, `other`
- Post to ledger: DR Cash (1100), CR Equity (4100/4300) or appropriate account

**DB Table:** `deposits` (schema to be provided by you)

**Ledger Integration:**
- `transaction_type`: `deposit`, `contribution`, `opening_balance`, etc.
- Typical: DR 1100 Cash, CR 4100 Owner's Capital / 4300 Opening Balance / 4200 Retained Earnings (policy-dependent)

---

## 4. Withhold Settlement – Cross-Module Integration

### 4.1 Sales Order Withhold (Receivable)

| Field | Purpose |
|-------|---------|
| `withhold_amount` | Amount withheld by customer |
| `withhold_confirmation` | Confirmed by tax authority / internal process |
| `withhold_settled` | Settled in a monthly batch |
| `sales_invoice_no` | Reference for tax authority |

**Settlement API:** `POST /financial/withhold-receivable/settle`  
- Input: list of sales_order_ids or date range  
- Creates settlement batch, posts GL, updates `withhold_settled`

### 4.2 Purchase Order Withhold (Payable)

| Field | Purpose |
|-------|---------|
| `withhold_amount` | Amount we withheld from supplier |
| `withhold_settled` | Remitted to government in a batch |

**Settlement API:** `POST /financial/withhold-payable/settle`  
- Input: list of purchase_order_ids or date range  
- Creates settlement batch, posts GL, updates `withhold_settled`

### 4.3 Settlement Tables (Proposed)

| Table | Purpose |
|-------|---------|
| `withhold_receivable_settlements` | Batch records for sales withhold claims |
| `withhold_payable_settlements` | Batch records for purchase withhold remittances |
| `withhold_receivable_settlement_items` | Links settlement to sales_orders |
| `withhold_payable_settlement_items` | Links settlement to purchase_orders |

---

## 5. Chart of Accounts Additions

Existing accounts used:

| Code | Name | Use |
|------|------|-----|
| 1100 | Cash | All cash movements |
| 1200 | Accounts Receivable | Trade receivables |
| 1250 | Withhold Receivable | Sales withhold (asset) |
| 3100 | Accounts Payable | Trade payables |
| 3210 | Withholding Payable | Purchase withhold (liability) |
| 3300 | Loans Payable | Cash borrow-from |
| 6200 | Operating Expenses | Expenses |
| 4300 | Opening Balance | Initial/opening |
| 4100 | Owner's Capital | Contributions |

**Potential new account (if desired):**
- **1210 – Loans Receivable** (or Due from Others): Cash lent to partners.  
  Alternatively, use 1200 with a type/category flag if you prefer a single AR account.

---

## 6. Ledger Integration Summary

| Transaction | Debit | Credit |
|-------------|-------|--------|
| Expense (cash) | 6200 Operating Expenses | 1100 Cash |
| Expense (credit) | 6200 Operating Expenses | 3100 AP |
| Cash loan (lend) | 1210 Loans Receivable | 1100 Cash |
| Cash loan return | 1100 Cash | 1210 Loans Receivable |
| Cash loan (borrow) | 1100 Cash | 3300 Loans Payable |
| Cash loan repayment | 3300 Loans Payable | 1100 Cash |
| Withhold receivable settlement | 1100 Cash (or tax account) | 1250 Withhold Receivable |
| Withhold payable settlement | 3210 Withholding Payable | 1100 Cash |
| Deposit/contribution | 1100 Cash | 4100/4300 Equity |

---

## 7. UI Structure (Proposed)

```
Financial (Main Module)
├── Expense
│   ├── Expense List
│   ├── Create Expense
│   └── Expense Reports (optional)
├── Account Receivables (Tabs)
│   ├── Trade Receivables (from sales)
│   ├── Loans Receivable (cash lend)
│   └── Withhold Receivable (settlement)
├── Account Payables (Tabs)
│   ├── Trade Payables (from purchases)
│   ├── Loans Payable (cash borrow)
│   └── Withhold Payable (settlement)
└── Deposits
    ├── Deposit List
    ├── Create Deposit/Contribution
    └── Deposit by Type (optional report)
```

---

## 8. API Structure (Proposed)

```
/api/financial
├── /expenses
│   ├── GET    /           (list, filter)
│   ├── POST   /           (create + ledger)
│   ├── GET    /:id
│   └── PATCH  /:id        (if editable)
├── /receivables
│   ├── GET    /trade      (from sales_orders)
│   ├── GET    /loans      (cash loans receivable)
│   ├── POST   /loans      (create loan)
│   ├── POST   /loans/:id/return
│   ├── GET    /withhold   (confirmed sales withholds)
│   └── POST   /withhold/settle
├── /payables
│   ├── GET    /trade      (from purchase_orders)
│   ├── GET    /loans      (cash loans payable)
│   ├── POST   /loans      (create loan)
│   ├── POST   /loans/:id/repay
│   ├── GET    /withhold   (purchase withholds)
│   └── POST   /withhold/settle
└── /deposits
    ├── GET    /           (list, filter)
    ├── POST   /           (create + ledger)
    └── GET    /:id
```

---

## 9. Implementation Phases (When Ready)

| Phase | Scope | Dependencies |
|-------|-------|--------------|
| 1 | Expenses (schema + CRUD + ledger) | Chart 6200 |
| 2 | Cash Loans Receivable + Payable (tables, APIs, ledger) | Chart 1210 (optional), 3300 |
| 3 | Withhold Receivable settlement (batch + update sales_orders) | Sales orders |
| 4 | Withhold Payable settlement (batch + update purchase_orders) | Purchase orders |
| 5 | Deposits (schema + CRUD + ledger) | Chart 4100/4300 |
| 6 | UI (Expense, AR tabs, AP tabs, Deposits) | Phases 1–5 |

---

## 10. Open Items (For You to Provide)

1. **Expenses table schema** – columns, constraints, indexes  
2. **Deposits table schema** – columns, types (deposit/contribution/seed), constraints  
3. **Loans Receivable/Payable** – confirm if you want separate `cash_loans_receivable` and `cash_loans_payable` tables or a unified `cash_loans` with a type column  
4. **Chart of Accounts** – confirm if 1210 Loans Receivable should be added  
5. **Settlement tables** – confirm structure for withhold_receivable_settlements and withhold_payable_settlements  

---

## 11. Document Control

- **Author:** AI-assisted design  
- **Review:** Pending your schema inputs and approval  
- **Next step:** Receive `expenses` and `deposits` schemas, then refine DB design and implementation order  
