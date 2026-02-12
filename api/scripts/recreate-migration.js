/**
 * Development only: re-run a single migration after you edited it.
 * Use when the table is empty and you want one schema file per table (no alter migrations yet).
 *
 * Usage: node scripts/recreate-migration.js <migration_file_name> <table_name>
 * Example: node scripts/recreate-migration.js 20260207120000_create_expenses_table.js expenses
 *
 * Then run: npm run migrate
 */
import knexConfig from '../db/knexfile.js'
import knexModule from 'knex'

const knex = knexModule(knexConfig)

const migrationName = process.argv[2]
const tableName = process.argv[3]

async function main() {
  if (!migrationName || !tableName) {
    console.log('Usage: node scripts/recreate-migration.js <migration_file_name> <table_name>')
    console.log('Example: node scripts/recreate-migration.js 20260207120000_create_expenses_table.js expenses')
    process.exit(1)
  }

  try {
    await knex.schema.dropTableIfExists(tableName)
    console.log(`Dropped table: ${tableName}`)

    const deleted = await knex('knex_migrations').where('name', migrationName).del()
    if (deleted > 0) {
      console.log(`Removed migration record: ${migrationName}`)
    } else {
      console.log(`No record for ${migrationName} (already pending).`)
    }

    console.log('Run: npm run migrate')
  } catch (err) {
    console.error(err)
    process.exit(1)
  } finally {
    await knex.destroy()
  }
}

main()
