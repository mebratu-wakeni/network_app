#!/usr/bin/env node
/**
 * Reset the database for testing. Uses the same connection as knexfile.js.
 *
 * What it does:
 * 1. Roll back = run each migration's down() in reverse order. That DROPS tables
 *    and columns (removes schema), it does not just erase data. After rollback,
 *    the DB has no app tables (or is back to pre-migration state).
 * 2. Migrate latest = run every migration's up(). Tables are recreated from
 *    scratch (empty). Existing migration files are the single source of truth.
 * 3. Optionally run seeds to repopulate base data (users, roles, chart of accounts).
 *
 * Usage (from api/):
 *   npm run db:reset
 *   npm run db:reset:seed
 *   npm run db:reset:seed -- --repo   # force api/data/pharmasuit_lan.db (CI / isolated dev only)
 *
 * Default DB path is the system app data location (same as the Electron app): see api/db/resolve-db-file.js.
 * Override with DB_FILE in the environment or api/.env.
 *
 * Stop the desktop app (or any process using the DB) before reset to avoid SQLite locks.
 */
import knex from 'knex';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env before knexfile (api/.env first, then repo root)
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const forceRepoDb = process.argv.includes('--repo');
const repoDefaultDb = path.resolve(__dirname, '../data/pharmasuit_lan.db');

if (forceRepoDb) {
  process.env.DB_FILE = repoDefaultDb;
  console.log('[reset-db] --repo: using api/data/pharmasuit_lan.db only (not system app data).');
}

const knexfilePath = path.resolve(__dirname, '../db/knexfile.js');
const knexConfig = (await import(knexfilePath)).default;
const db = knex(knexConfig);

const runSeed = process.argv.includes('--seed');

async function main() {
  try {
    const dbPath =
      knexConfig?.connection?.filename ||
      (typeof knexConfig?.connection === 'string' ? knexConfig.connection : null) ||
      '(unknown)';
    console.log('Resetting database...');
    console.log('  Database file:', path.resolve(String(dbPath)));

    // Roll back all migrations (loop per batch; knex returns [batchNo, names[]])
    let rolled;
    let rollbackCount = 0;
    let iterations = 0;
    let migrationNames = [];
    const maxRollbacks = 100;
    do {
      rolled = await db.migrate.rollback();
      migrationNames = Array.isArray(rolled) && Array.isArray(rolled[1]) ? rolled[1] : [];
      if (migrationNames.length > 0) {
        rollbackCount += migrationNames.length;
        console.log(`  Rolled back batch ${rolled[0]}:`, migrationNames.join(', '));
      }
      iterations++;
      if (iterations >= maxRollbacks) {
        console.warn('  Stopped after max rollback iterations.');
        break;
      }
    } while (migrationNames.length > 0);

    if (rollbackCount === 0) {
      console.log('  No migrations to roll back.');
    } else {
      console.log(`  Rolled back ${rollbackCount} migration(s).`);
    }

    // Run all migrations
    const [batch, migrations] = await db.migrate.latest();
    console.log('  Migrations up:', migrations?.length ?? 0, migrations?.length ? `(batch ${batch})` : '');

    if (runSeed) {
      console.log('Running seeds...');
      // Knex returns [ [ filepath, ... ] ] — not [batch, names]
      const [seedLog] = await db.seed.run();
      console.log(
        '  Seeds run:',
        seedLog?.length ?? 0,
        seedLog?.length ? seedLog.map((p) => path.basename(p)).join(', ') : ''
      );
    } else {
      console.log('Skipping seeds (use --seed to run seeds).');
    }

    console.log('Done.');
  } catch (err) {
    console.error('Reset failed:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
