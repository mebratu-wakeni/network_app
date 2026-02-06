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
 *   node scripts/reset-db.js           # drop all + recreate schema (empty)
 *   node scripts/reset-db.js --seed    # same, then run seeds
 *
 *   npm run db:reset
 *   npm run db:reset:seed
 */
import knex from 'knex';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env so knexfile can read DB_* / DATABASE_URL
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const knexfilePath = path.resolve(__dirname, '../db/knexfile.js');
const knexConfig = (await import(knexfilePath)).default;
const db = knex(knexConfig);

const runSeed = process.argv.includes('--seed');

async function main() {
  try {
    console.log('Resetting database...');

    // Roll back all migrations (loop until none left; safety limit 100 batches)
    let rolled;
    let rollbackCount = 0;
    let iterations = 0;
    const maxRollbacks = 100;
    do {
      rolled = await db.migrate.rollback();
      if (rolled && rolled.length > 0) {
        rollbackCount += rolled.length;
        console.log('  Rolled back:', rolled.join(', '));
      }
      iterations++;
      if (iterations >= maxRollbacks) {
        console.warn('  Stopped after max rollback iterations.');
        break;
      }
    } while (rolled && rolled.length > 0);

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
      const [batchNo, seedNames] = await db.seed.run();
      console.log('  Seeds run:', seedNames?.length ?? 0, seedNames?.length ? `(batch ${batchNo})` : '');
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
