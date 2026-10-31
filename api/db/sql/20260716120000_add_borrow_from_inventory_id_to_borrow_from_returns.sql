-- Incremental migration for phpPgAdmin / cPanel PostgreSQL
-- Knex migration: 20260716120000_add_borrow_from_inventory_id_to_borrow_from_returns.js
--
-- BEFORE YOU RUN:
--   1. Backup the database (cPanel backup or pgAdmin export).
--   2. Select the same database your Node API uses (check DB_NAME in the app).
--   3. Paste this entire script and Execute once (single transaction).
--
-- Safe to re-run: uses IF NOT EXISTS / skips rows already linked / skips knex row if present.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Column
-- ---------------------------------------------------------------------------
ALTER TABLE borrow_from_returns
  ADD COLUMN IF NOT EXISTS borrow_from_inventory_id BIGINT NULL;

-- ---------------------------------------------------------------------------
-- 2) Index
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS borrow_from_returns_borrow_from_inventory_id_index
  ON borrow_from_returns (borrow_from_inventory_id);

-- ---------------------------------------------------------------------------
-- 3) Foreign key → borrow_from_inventories.id
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'borrow_from_returns_borrow_from_inventory_id_foreign'
  ) THEN
    ALTER TABLE borrow_from_returns
      ADD CONSTRAINT borrow_from_returns_borrow_from_inventory_id_foreign
      FOREIGN KEY (borrow_from_inventory_id)
      REFERENCES borrow_from_inventories (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Backfill legacy rows (FIFO per tenant + borrowed_inventory_id)
--    Matches api/db/migrations/20260716120000_...js
-- ---------------------------------------------------------------------------

-- 4a) One obligation per inventory lot → assign all returns for that lot
UPDATE borrow_from_returns r
SET borrow_from_inventory_id = sub.ob_id
FROM (
  SELECT
    bfi.tenant_id,
    bfi.inventory_id,
    MIN(bfi.id) AS ob_id
  FROM borrow_from_inventories bfi
  GROUP BY bfi.tenant_id, bfi.inventory_id
  HAVING COUNT(*) = 1
) sub
WHERE r.borrow_from_inventory_id IS NULL
  AND r.tenant_id = sub.tenant_id
  AND r.borrowed_inventory_id = sub.inventory_id;

-- 4b) Multiple obligations on same lot → FIFO by returned_on, id
CREATE TEMP TABLE ob_alloc (
  obligation_id BIGINT PRIMARY KEY,
  allocated INT NOT NULL DEFAULT 0
) ON COMMIT DROP;

DO $$
DECLARE
  ret RECORD;
  ob RECORD;
  qty INT;
  used INT;
  cap INT;
  rem INT;
  assigned BIGINT;
  ob_count INT;
  last_tenant BIGINT;
  last_inv BIGINT;
BEGIN
  last_tenant := NULL;
  last_inv := NULL;

  FOR ret IN
    SELECT
      id,
      tenant_id,
      borrowed_inventory_id,
      COALESCE(quantity_returned, 0) AS quantity_returned
    FROM borrow_from_returns
    WHERE borrow_from_inventory_id IS NULL
    ORDER BY tenant_id, borrowed_inventory_id, returned_on, id
  LOOP
    SELECT COUNT(*)::INT INTO ob_count
    FROM borrow_from_inventories bfi
    WHERE bfi.tenant_id = ret.tenant_id
      AND bfi.inventory_id = ret.borrowed_inventory_id;

    IF ob_count = 0 THEN
      RAISE NOTICE '[backfill] No borrow_from_inventories for return id=% tenant=% inventory=%',
        ret.id, ret.tenant_id, ret.borrowed_inventory_id;
      CONTINUE;
    END IF;

    IF ob_count = 1 THEN
      UPDATE borrow_from_returns
      SET borrow_from_inventory_id = (
        SELECT bfi.id
        FROM borrow_from_inventories bfi
        WHERE bfi.tenant_id = ret.tenant_id
          AND bfi.inventory_id = ret.borrowed_inventory_id
        ORDER BY bfi.borrowed_date, bfi.id
        LIMIT 1
      )
      WHERE id = ret.id;
      CONTINUE;
    END IF;

    IF last_tenant IS DISTINCT FROM ret.tenant_id
       OR last_inv IS DISTINCT FROM ret.borrowed_inventory_id THEN
      TRUNCATE ob_alloc;
      INSERT INTO ob_alloc (obligation_id, allocated)
      SELECT bfi.id, 0
      FROM borrow_from_inventories bfi
      WHERE bfi.tenant_id = ret.tenant_id
        AND bfi.inventory_id = ret.borrowed_inventory_id
      ORDER BY bfi.borrowed_date, bfi.id;
      last_tenant := ret.tenant_id;
      last_inv := ret.borrowed_inventory_id;
    END IF;

    qty := ret.quantity_returned;
    assigned := NULL;

    FOR ob IN
      SELECT bfi.id, bfi.quantity, oa.allocated
      FROM borrow_from_inventories bfi
      INNER JOIN ob_alloc oa ON oa.obligation_id = bfi.id
      WHERE bfi.tenant_id = ret.tenant_id
        AND bfi.inventory_id = ret.borrowed_inventory_id
      ORDER BY bfi.borrowed_date, bfi.id
    LOOP
      cap := COALESCE(ob.quantity, 0);
      used := COALESCE(ob.allocated, 0);
      rem := cap - used;
      IF rem <= 0 THEN
        CONTINUE;
      END IF;
      IF qty <= rem THEN
        assigned := ob.id;
        UPDATE ob_alloc
        SET allocated = allocated + qty
        WHERE obligation_id = ob.id;
        EXIT;
      END IF;
    END LOOP;

    IF assigned IS NULL THEN
      FOR ob IN
        SELECT bfi.id, bfi.quantity, oa.allocated
        FROM borrow_from_inventories bfi
        INNER JOIN ob_alloc oa ON oa.obligation_id = bfi.id
        WHERE bfi.tenant_id = ret.tenant_id
          AND bfi.inventory_id = ret.borrowed_inventory_id
        ORDER BY bfi.borrowed_date, bfi.id
      LOOP
        cap := COALESCE(ob.quantity, 0);
        used := COALESCE(ob.allocated, 0);
        IF used < cap THEN
          assigned := ob.id;
          UPDATE ob_alloc
          SET allocated = allocated + qty
          WHERE obligation_id = ob.id;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF assigned IS NOT NULL THEN
      UPDATE borrow_from_returns
      SET borrow_from_inventory_id = assigned
      WHERE id = ret.id;
    ELSE
      RAISE NOTICE '[backfill] Could not FIFO-assign return id=% tenant=%',
        ret.id, ret.tenant_id;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Tell Knex this migration is already applied (so npm/migrate-lite won't re-run)
-- ---------------------------------------------------------------------------
INSERT INTO knex_migrations (name, batch, migration_time)
SELECT
  '20260716120000_add_borrow_from_inventory_id_to_borrow_from_returns.js',
  COALESCE((SELECT MAX(batch) FROM knex_migrations), 0) + 1,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM knex_migrations
  WHERE name = '20260716120000_add_borrow_from_inventory_id_to_borrow_from_returns.js'
);

COMMIT;

-- ---------------------------------------------------------------------------
-- Verify (optional — run separately after COMMIT)
-- ---------------------------------------------------------------------------
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'borrow_from_returns' AND column_name = 'borrow_from_inventory_id';
--
-- SELECT COUNT(*) AS still_unlinked FROM borrow_from_returns
-- WHERE borrow_from_inventory_id IS NULL;
--
-- SELECT name, batch, migration_time FROM knex_migrations
-- WHERE name LIKE '%borrow_from_inventory_id%';
