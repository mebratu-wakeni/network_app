# Migrations workflow

## Important: re-create one table only

**Do not use `npm run rollback`** to re-create a single table. Rollback undoes the **last batch** of migrations (often many at once), so it can remove or revert other tables and data.

To re-create **only** one table (e.g. expenses) in development:

```bash
node scripts/recreate-migration.js <migration_file_name> <table_name>
npm run migrate
```

Example (expenses only; other tables and data are untouched):

```bash
node scripts/recreate-migration.js 20260207120000_create_expenses_table.js expenses
npm run migrate
```

---

## Two situations

### 1. Development (table empty or early stage)

- **One migration file per table** with the full schema. Easy to read later.
- When you need to change the schema, **edit that same file** and re-run it using the script above (not rollback).
- Or reset the whole DB and re-run all migrations: `npm run db:reset` then `npm run migrate`.

### 2. Production / deployed (table has data)

- **Do not drop the table.** Use **new migration files** that alter the existing table (add column, rename, change type, etc.).
- Run `npm run migrate`; the new migration updates the table structure while keeping data.
