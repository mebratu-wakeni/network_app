import knexConfig from '../db/knexfile.js'
import knexModule from 'knex'

const knex = knexModule(knexConfig)

async function removeMigrationRecord() {
  try {
    // Migration name that was deleted but still exists in knex_migrations table
    const migrationName = process.argv[2] || '20260204000000_ensure_last_login_at_on_users.js'
    
    console.log(`Removing migration record: ${migrationName}`)
    
    // First, check if the record exists
    const existing = await knex('knex_migrations')
      .where('name', migrationName)
      .select('*')
    
    if (existing.length === 0) {
      console.log(`⚠ No migration record found with name: ${migrationName}`)
      console.log('Checking existing migration records...')
      const allMigrations = await knex('knex_migrations')
        .select('name', 'batch', 'migration_time')
        .orderBy('migration_time', 'desc')
      console.log('Existing migrations:')
      allMigrations.forEach(m => {
        console.log(`  - ${m.name} (batch ${m.batch})`)
      })
      process.exit(0)
      return
    }
    
    console.log(`Found migration record in batch ${existing[0].batch}`)
    
    // Remove the migration record
    const deleted = await knex('knex_migrations')
      .where('name', migrationName)
      .del()
    
    if (deleted > 0) {
      console.log(`✓ Successfully removed ${deleted} migration record(s)`)
      console.log('You can now run migrations again.')
    } else {
      console.log(`⚠ Failed to remove migration record`)
    }
    
    process.exit(0)
  } catch (error) {
    console.error('Error removing migration record:', error)
    process.exit(1)
  } finally {
    await knex.destroy()
  }
}

removeMigrationRecord()
