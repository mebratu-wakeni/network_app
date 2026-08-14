# General Ledger (GL) Posting Discipline

This document defines the rules that ensure double-entry integrity and prevent negative cash in the system.

## 1. Double-entry requirement

Every transaction that posts to `account_ledger` **must be balanced** (total debits = total credits).

### Enforcement

- `postGLTransaction()` in `api/src/services/ledger.helper.js` validates this before inserting:
  ```js
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error('Debits and credits must be equal')
  }
  ```
- **Rule:** All ledger posts MUST go through `LedgerHelper` (record*, reverse*, or `postGLTransaction`). Do not insert into `account_ledger` directly.

---

## 2. Cash balance safeguards

Any transaction that **reduces cash** (credits account 1100) must validate the available balance before posting. Otherwise, the ledger can show negative cash.

### Flows that reduce cash (CR 1100)

| Flow | LedgerHelper method | Cash safeguard |
|------|---------------------|----------------|
| Expense (cash) | `recordExpense` | ✓ `createExpense` |
| Purchase (cash) | `recordPurchaseCash` | ✓ `createOrderWithItemsAndReceipt` |
| Purchase (cheque) | `recordPurchaseCheque` | ✓ `createOrderWithItemsAndReceipt` |
| Purchase payment (cash) | `recordPurchasePayment` | ✓ `payOrder` |
| Cash loan receivable (lending) | `recordCashLoanReceivable` | ✓ `createCashLoanReceivable` |
| Cash loan payable repayment | `recordCashLoanPayableRepayment` | ✓ `recordCashLoanPayableRepayment` |
| Withhold payable settlement | `recordWithholdPayableSettlement` | ✓ `createWithholdPayableSettlement` |

### Implementation pattern

```js
if (cashRequired > 0) {
  const hasLedger = await trx.schema.hasTable('account_ledger')
  if (hasLedger) {
    const balances = await this.ledgerHelper.getCurrentBalances(['1100'], trx)
    const cashBalance = Number(balances['1100'] ?? 0)
    if (cashBalance < cashRequired) {
      const err = new Error(`Insufficient cash balance. Current: ${...}. Required: ${...}.`)
      err.status = 400
      throw err
    }
  }
}
```

---

## 3. Single GL helper call per business transaction

Each **business transaction** (e.g. one expense, one purchase order, one deposit) must post to the ledger via **exactly one** LedgerHelper call.

### Rationale

- Multiple unrelated posts for the same business event can cause imbalance or double-counting.
- Reversals + new posts (e.g. `updateDeposit`: reverse + record) are allowed when they form one logical operation (amend/replace).

### Allowed

| Business transaction | Ledger calls | Notes |
|----------------------|--------------|-------|
| Create expense | 1 `recordExpense` | Single post |
| Create deposit | 1 `recordDeposit` | Single post |
| Update deposit | `reverseDeposit` + `recordDeposit` | Amend: reverse old, post new |
| Create purchase (cash/credit/cheque) | 1 of `recordPurchaseCash` / `recordPurchaseCredit` / `recordPurchaseCheque` | One payment mode per order |
| Pay purchase order (cash/cheque) | 1 `recordPurchasePayment` | One payment |
| Create cash loan receivable | 1 `recordCashLoanReceivable` | Single post |
| Return cash loan receivable | 1 `recordCashLoanReceivableReturn` | Single post |
| Create cash loan payable | 1 `recordCashLoanPayable` | Single post |
| Repay cash loan payable | 1 `recordCashLoanPayableRepayment` | Single post |
| Withhold receivable settlement | 1 `recordWithholdReceivableSettlement` | Single post |
| Withhold payable settlement | 1 `recordWithholdPayableSettlement` | Single post |
| Sales order completion | 1 `recordSalesOrder` | Single post |
| Sales payment | 1 `recordSalesPayment` | Single post |
| Sales reversal | 1 `reverseSalesOrder` | Single reversal |
| Purchase reversal | 1 `reversePurchaseOrder` | Single reversal |
| Stock adjustments, borrow/return, etc. | 1 `postGLTransaction` or record* | One call per operation |

### Disallowed

- Inserting into `account_ledger` without using LedgerHelper.
- Calling multiple record* / postGLTransaction for the same business event (except intentional reverse+record for amends).
- Posting outside of a database transaction when the business record is created in the same flow (deposit, expense, etc. must be atomic).

---

## 4. Atomicity

When a business record and its ledger entries are created together, they MUST be in the same database transaction:

- `createExpense` – expense row + `recordExpense` in one transaction ✓
- `createDeposit` – deposit row + `recordDeposit` in one transaction ✓
- `createOrderWithItemsAndReceipt` – order + items + payments + ledger in one transaction ✓
- `payOrder` – payment row + `recordPurchasePayment` in one transaction ✓
- `createWithholdPayableSettlement` – settlement + items + order updates + `recordWithholdPayableSettlement` in one transaction ✓
- Similar patterns for other financial flows

---

## 5. Audit checklist (as of 2026-02)

- `postGLTransaction`: ✓ Validates debits = credits.
- Cash-reducing flows: ✓ All listed above have safeguards.
- Single GL call per transaction: ✓ No duplicate posts found.
- Atomicity: ✓ createDeposit now wrapped in transaction.
- LedgerHelper is the single entry point for all ledger writes; no direct inserts to `account_ledger` from business logic.
