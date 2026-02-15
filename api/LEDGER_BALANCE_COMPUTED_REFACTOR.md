# Ledger Balance Refactor: Compute from Debit/Credit

Switch from using the stored `balance` column to computing balance as `SUM(debit - credit)` over the transaction date range. This handles backdated transactions correctly.

---

## Affected Components

### 1. Core: Ledger Helper (`api/src/services/ledger.helper.js`)

| Method | Current behavior | New behavior |
|--------|------------------|--------------|
| **getAccountBalance(accountCode, asOfDate, trx)** | Reads `balance` from last row where `transaction_date <= asOfDate` | Compute `SUM(debit - credit)` where `account_code = X` and `transaction_date <= asOfDate` |
| **getCurrentBalances(accountCodes, trx)** | Reads `balance` from last row per account (by id) | Compute `SUM(debit - credit)` per account (all rows, or optionally `transaction_date <= today`) |
| **postGLTransaction** | Gets `currentBalance` from last row, computes `newBalance = currentBalance + debit - credit`, stores it | Same logic but use computed prior balance from `SUM(debit - credit)` for rows with `transaction_date <= this_date` (and `id` for same-day ordering). Still store the computed `newBalance` for the row being inserted |

### 2. Reports Repository (`api/src/modules/reports/reports.repository.js`)

| Method | Current behavior | New behavior |
|--------|------------------|--------------|
| **getClosingBalances(asOfDate)** | Uses ROW_NUMBER to pick last row per account by date, returns stored `balance` | Compute `SUM(debit - credit)` per account where `transaction_date <= asOfDate`; return `{ account_code, account_name, balance }` |

### 3. Fiscal Years Repository (`api/src/modules/fiscal-years/fiscal-years.repository.js`)

| Method | Current behavior | New behavior |
|--------|------------------|--------------|
| **getClosingBalances(asOfDate, trx)** | Same as reports | Same as reports – compute `SUM(debit - credit)` per account |

### 4. Consumers (no direct changes if helpers are updated)

| Location | Usage | Notes |
|----------|-------|-------|
| **reports.service.js** | `getClosingBalances` | Balance Sheet, Income Statement, Cash Flow, Equity |
| **fiscal-years.service.js** | `getClosingBalances` | Year-end closing |
| **ledger.controller.js** | `getCurrentBalances` | Dashboard `/ledger/balances` |
| **financial.repository.js** | `getCurrentBalances(['1100'])` | Cash checks: expense, loan receivable, loan repayment, withhold settlement |
| **purchase.repository.js** | `getCurrentBalances(['1100'])` | Cash checks: purchase completion, payment |
| **ReceivablesTab, CheckoutConfirmationModal** | `dashboard:get-ledger-balances` | UI cash balance hints/validation |

---

## Implementation Approach

1. **Add computed-balance helpers** in `ledger.helper.js`:
   - `getAccountBalanceComputed(accountCode, asOfDate, trx)` → `SUM(debit - credit)` for rows with `transaction_date <= asOfDate`
   - `getCurrentBalancesComputed(accountCodes, trx)` → `SUM(debit - credit)` per account (all rows; “current” = latest state)
   - `getClosingBalancesComputed(asOfDate, trx)` → `{ account_code, account_name, balance }[]` using `SUM(debit - credit)` grouped by account

2. **Update `postGLTransaction`**:
   - Prior balance = computed via `getAccountBalanceComputed` for this account with `asOfDate = transaction_date` (or last row before this one by `(transaction_date, id)` if same-day ordering matters). For same transaction inserting multiple rows, we need the balance before each insert; for the first row of an account we use computed; for second row of same account in same batch we’d use the value we’re about to insert. Need to handle same-batch ordering.

3. **Replace calls**:
   - `getAccountBalance` → `getAccountBalanceComputed` (or inline the computation)
   - `getCurrentBalances` → `getCurrentBalancesComputed`
   - `reports.repository.getClosingBalances` → use computed (or call shared helper)
   - `fiscal-years.repository.getClosingBalances` → use computed (or call shared helper)

4. **Optional**: Keep storing `balance` in each row for display/audit, but treat it as derived/cache; reports and safeguards always use computed values.

---

## SQL for Computed Balance

**Single account as of date:**
```sql
SELECT COALESCE(SUM(debit - credit), 0) as balance
FROM account_ledger
WHERE account_code = ? AND transaction_date <= ?
```

**Multiple accounts as of date (closing balances):**
```sql
SELECT account_code, MAX(account_name) as account_name,
       SUM(debit - credit) as balance
FROM account_ledger
WHERE transaction_date <= ?
GROUP BY account_code
```

**Current balances (all time):**
```sql
SELECT account_code, MAX(account_name) as account_name,
       SUM(debit - credit) as balance
FROM account_ledger
GROUP BY account_code
```

---

## Order of Work

1. Add `getAccountBalanceComputed`, `getCurrentBalancesComputed`, `getClosingBalancesComputed` in ledger helper
2. Update `postGLTransaction` to use computed prior balance
3. Update `reports.repository.getClosingBalances` to use computed
4. Update `fiscal-years.repository.getClosingBalances` to use computed
5. Replace `getAccountBalance` and `getCurrentBalances` usages with computed versions (or swap impl)
6. Verify: Balance Sheet, FY close, cash checks, dashboard
