-- Incremental migration for phpPgAdmin / cPanel Databases → PostgreSQL
-- Migration name: 20260715120000_add_customer_code_to_customers.js
--
-- Run ONLY if column customers.customer_code does not exist yet.
-- Safe to re-run the DO blocks; unique constraint may error if already present (ignore).
--
-- After this SQL succeeds, record it so Knex won't try to re-run:
--   INSERT INTO knex_migrations (name, batch, migration_time)
--   VALUES ('20260715120000_add_customer_code_to_customers.js', 999, NOW())
--   ON CONFLICT DO NOTHING;
-- (If your knex_migrations has no unique on name, skip ON CONFLICT and check manually.)

BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_code VARCHAR(32) NULL;

-- Backfill CUST0001, CUST0002, … per tenant (ordered by id)
WITH numbered AS (
  SELECT
    id,
    tenant_id,
    ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id) AS seq
  FROM customers
  WHERE customer_code IS NULL OR customer_code = ''
)
UPDATE customers c
SET customer_code = 'CUST' || LPAD(n.seq::text, 4, '0')
FROM numbered n
WHERE c.id = n.id;

-- Any remaining nulls (shouldn't happen)
UPDATE customers
SET customer_code = 'CUST' || LPAD(id::text, 4, '0')
WHERE customer_code IS NULL;

ALTER TABLE customers
  ALTER COLUMN customer_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_tenant_id_customer_code_unique'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_tenant_id_customer_code_unique
      UNIQUE (tenant_id, customer_code);
  END IF;
END $$;

-- Mark migration applied (adjust if your knex_migrations schema differs)
INSERT INTO knex_migrations (name, batch, migration_time)
SELECT
  '20260715120000_add_customer_code_to_customers.js',
  COALESCE((SELECT MAX(batch) FROM knex_migrations), 0) + 1,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM knex_migrations
  WHERE name = '20260715120000_add_customer_code_to_customers.js'
);

COMMIT;
