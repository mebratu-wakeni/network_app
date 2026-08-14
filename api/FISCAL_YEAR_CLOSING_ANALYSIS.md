# Fiscal Year Closing – Account-by-Account Analysis

## Chart of Accounts Summary (COA)

| Code | Account Name | Type | Nature |
|------|---------------|------|--------|
| **ASSETS** (debit-normal, balance positive) | | | |
| 1100 | Cash | Asset | Permanent |
| 1200 | Accounts Receivable | Asset | Permanent |
| 1210 | Loans Receivable | Asset | Permanent |
| 1250 | Withhold Receivable | Asset | Permanent |
| 1300 | Inventory | Asset | Permanent |
| 1400 | Prepaid Expenses | Asset | Permanent |
| 2100 | Equipment | Asset | Permanent |
| 2200 | Accumulated Depreciation | Asset | Permanent |
| **LIABILITIES** (credit-normal, balance negative) | | | |
| 3100 | Accounts Payable | Liability | Permanent |
| 3200 | Accrued Expenses | Liability | Permanent |
| 3210 | Withholding Payable | Liability | Permanent |
| 3300 | Loans Payable | Liability | Permanent |
| **EQUITY** (credit-normal, balance negative) | | | |
| 4100 | Owner's Capital | Equity | Permanent |
| 4200 | Retained Earnings | Equity | Permanent |
| 4300 | Opening Balance | Equity | Permanent |
| **REVENUE** (credit-normal, balance negative) | | | |
| 5100 | Sales Revenue | Revenue | **Temporary** |
| 5200 | Other Revenue | Revenue | **Temporary** |
| **EXPENSES** (debit-normal, balance positive) | | | |
| 6100 | Cost of Goods Sold | Expense | **Temporary** |
| 6200 | Operating Expenses | Expense | **Temporary** |
| 6300 | Depreciation Expense | Expense | **Temporary** |

---

## What Happens in Traditional Year-End Closing

### 1. Temporary Accounts (Revenue & Expenses) → Zero

These accounts are **closed to zero**. Their balances are **transferred** to Retained Earnings (4200).

| Account | Before Close | Closing Entry | After Close |
|---------|--------------|---------------|-------------|
| **5100** Sales Revenue | Credit balance (e.g. -30,000) | DR 5100, CR 4200 | **0** |
| **5200** Other Revenue | Credit balance | DR 5200, CR 4200 | **0** |
| **6100** COGS | Debit balance (e.g. +10,000) | DR 4200, CR 6100 | **0** |
| **6200** Operating Expenses | Debit balance | DR 4200, CR 6200 | **0** |
| **6300** Depreciation Expense | Debit balance | DR 4200, CR 6300 | **0** |

**Effect:** Revenue and Expense accounts start the new year with **zero balance**.

---

### 2. Retained Earnings (4200) – Receives the Transfer

| Before Close | Closing Entries | After Close |
|--------------|-----------------|-------------|
| Previous RE balance | + Revenue (credit) | Previous RE + Net Income |
| | − Expenses (debit) | |

**Formula:**  
`New Retained Earnings = Old Retained Earnings + (Total Revenue − Total Expenses)`

**Effect:** 4200 accumulates profits/losses from prior years. It is **never zeroed**; it carries forward.

---

### 3. Permanent Accounts – No Closing Entries

These accounts **carry forward** with no change. No special closing entries.

| Category | Accounts | What Happens |
|----------|----------|--------------|
| **Assets** | 1100, 1200, 1210, 1250, 1300, 1400, 2100, 2200 | Balance at Dec 31 = balance at Jan 1 |
| **Liabilities** | 3100, 3200, 3210, 3300 | Same |
| **Equity (other)** | 4100 Owner's Capital, 4300 Opening Balance | Same |

**Effect:** Their last ledger row at FY end is the opening balance for the next year. No posting required.

---

## Summary: Who Gets Zeroed, Who Carries Forward

| Account Type | Zeroed? | Balance goes to |
|--------------|---------|------------------|
| **Revenue** (5100, 5200) | ✓ Yes | Retained Earnings (4200) |
| **Expenses** (6100, 6200, 6300) | ✓ Yes | Retained Earnings (4200) |
| **Retained Earnings** (4200) | ✗ No | Carries + receives net income |
| **Owner's Capital** (4100) | ✗ No | Carries |
| **Opening Balance** (4300) | ✗ No | Carries |
| **All Assets** (1xxx, 2xxx) | ✗ No | Carries |
| **All Liabilities** (3xxx) | ✗ No | Carries |

---

## Current Implementation vs Traditional

The current `closeFiscalYear` logic in `fiscal-years.service.js`:

1. Gets **all** closing balances (including Revenue and Expenses)
2. Creates a single GL transaction on **next year’s first day** with entries for **every** account that has a non-zero balance
3. For each account: `balance > 0` → DR entry, `balance < 0` → CR entry
4. Uses 4300 to absorb rounding differences

**Important:** This approach has issues:
- It creates **new** ledger rows for every account. Because `new_balance = current_balance + debit - credit`, posting a DR 10,000 for Cash (which already has 10,000) would result in balance 20,000 – i.e. **duplication** of balances.
- It treats Revenue and Expenses as permanent (carrying forward) instead of closing them to zero and transferring to Retained Earnings.

Traditional closing would instead:

- Post **closing entries on the last day of the FY** (or first day of next year):
  - DR Revenue accounts, CR 4200 (close revenue)
  - DR 4200, CR Expense accounts (close expenses)
- Do **not** post opening entries for Assets, Liabilities, or Equity; their balances already carry via the ledger.

---

## Recommended Closing Logic

1. **On FY end date** (or first day of next year, depending on policy):
   - Close **Revenue** (5100, 5200) to **Retained Earnings (4200)**
   - Close **Expenses** (6100, 6200, 6300) to **Retained Earnings (4200)**

2. **Do not** post new entries for:
   - Assets
   - Liabilities
   - Owner's Capital (4100)
   - Opening Balance (4300)

3. **Retained Earnings (4200)** is the only Equity account that receives closing entries.
