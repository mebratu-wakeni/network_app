# Products CSV import samples

Use these with **Inventory → Products → Import products** (multipart CSV upload).

## Accepted columns

| Column (any alias) | Required | Notes |
|--------------------|----------|--------|
| `Product Name` / `name` | **Yes** | Non-empty |
| `Description` | No | |
| `Category` | No | Created automatically if missing |
| `Unit` | No | Created automatically if missing |
| `Product Code` | Ignored | Server always assigns `PRD####` |

Header matching is case-insensitive (rows are normalized to lowercase keys).

## Files

| File | Purpose |
|------|---------|
| `products-import-valid.csv` | Happy path — mixed categories/units, ready to upload |
| `products-import-minimal.csv` | Name-only rows (optional fields omitted) |
| `products-import-invalid.csv` | Expect row failures / skips (empty name, blank lines) |

## How to test

1. Open cloud app → Inventory → Products.
2. Import products → choose one of the CSVs above.
3. Confirm summary: successful / failed counts.
4. Verify new products appear in the list with generated codes.

Source mapping: `api/src/modules/inventory/importCsvHelpers.js` → `csvRowsToProducts`.
