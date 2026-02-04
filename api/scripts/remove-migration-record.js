import knexConfig from '../db/knexfile.js'
import knexModule from 'knex'

const knex = knexModule(knexConfig)

async function removeMigrationRecord() {
  try {
    const migrationName = '20260123000000_add_inventory_id_to_borrow_from_inventories.js'
    
    console.log(`Removing migration record: ${migrationName}`)
    
    const deleted = await knex('knex_migrations')
      .where('name', migrationName)
      .del()
    
    if (deleted > 0) {
      console.log(`✓ Successfully removed ${deleted} migration record(s)`)
    } else {
      console.log(`⚠ No migration record found with name: ${migrationName}`)
      console.log('Checking existing migration records...')
      const allMigrations = await knex('knex_migrations').select('name', 'batch', 'migration_time')
      console.log('Existing migrations:', allMigrations)
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
