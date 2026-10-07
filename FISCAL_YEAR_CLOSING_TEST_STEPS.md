# Fiscal Year Closing – Test Steps (UI Simulation)

Use these steps to test FY closing without waiting a full year. Start with a fresh DB.

---

## 1. Reset database and start app

```bash
cd api && npm run db:reset:seed
```

Then start the API and app, and log in.

---

## 2. Create test fiscal years

**Go to:** Settings → Fiscal Year tab

**Option A – Quick add**
- Click **"Quick add test years (2024 + 2025)"**
- This creates FY 2024 (2024-01-01 to 2024-12-31) and FY 2025 (2025-01-01 to 2025-12-31)

**Option B – Manual**
- Year: **2024**, Start: **2024-01-01**, End: **2024-12-31** → Create
- Year: **2025**, Start: **2025-01-01**, End: **2025-12-31** → Create

---

## 3. Add transactions dated in 2024

All of these must use dates in **2024** (e.g. 2024-01-15).

### 3a. Initial cash / equity (Deposits)

1. Go to **Financial → Deposits**
2. Add deposit:
   - Type: **Initial Seed**
   - Date: **2024-01-01**
   - Amount: e.g. **50,000**
   - Description: optional

### 3b. Opening inventory (Inventory)

1. Go to **Inventory → Products**
2. Create a product if needed
3. Go to **Inventory → Stock**
4. **Adjust stock** (add quantity) or **Import stock**:
   - Date: **2024-01-05**
   - Quantity: e.g. 100 units at some cost

### 3c. Sale (Sales)

1. Go to **Sales**
2. Add items, set a sale date of **2024-01-20**
3. Complete the sale (cash or credit)

### 3d. Optional: expense or purchase

- **Financial → Expenses**: `paid_on` = 2024-01-25
- **Purchase**: create order with `order_date` = 2024-01-10

---

## 4. Close FY 2024

1. Go to **Settings → Fiscal Year**
2. Find **2024** in the table
3. Open **Actions** (⋯) for 2024
4. Click **Close**
5. Confirm
6. FY 2024 status should change to **Closed**

---

## 5. Verify

1. **FY 2024 Report**
   - Actions → **Report** for FY 2024
   - Check closing balances, transaction counts

2. **Balance Sheet**
   - Go to **Financial → Reports**
   - Select **Balance Sheet**
   - As of: **2024-12-31** or **2025-01-01**
   - Confirm totals look correct

3. **Ledger**
   - Closing creates entries on the first day of the next year (`year_end_opening`)
   - Inspect `account_ledger` if needed

---

## Notes

- **Date pickers** in Deposits, Expenses, Sales, Purchase accept past dates – no extra setup
- FY 2024 can be closed because its end date (2024-12-31) is before today
- FY 2025 stays open so you can continue normal operations
- If the Close button is disabled, confirm FY 2024’s end date is not in the future
