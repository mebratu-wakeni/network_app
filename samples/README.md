# Sample upload fixtures

Formal CSV fixtures for manual QA and bug reproduction of import flows.

| Folder | Feature in app | Notes |
|--------|----------------|--------|
| [`products-import/`](./products-import/) | Inventory → Products → Import | Product master data only |
| [`stock-import/`](./stock-import/) | Inventory → Stock → Import | Stock quantities / batches |

**Rules**
- Files are UTF-8 CSV.
- Do not commit real customer data here.
- Prefer the `*-valid.csv` files for happy-path checks; use `*-invalid.csv` for error-handling checks.
