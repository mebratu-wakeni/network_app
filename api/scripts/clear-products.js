/**
 * Script to clear all products from the database
 * Usage: node scripts/clear-products.js
 */
import knex from '../src/db/knex.js'

async function clearProducts() {
  try {
    // Check if products table exists
    const tableExists = await knex.schema.hasTable('products')
    
    if (!tableExists) {
      console.log('⚠️  Products table does not exist. Please run migrations first:')
      console.log('   npm run migrate')
      process.exit(1)
    }

    // Count existing products
    const count = await knex('products').count('* as count').first()
    const productCount = parseInt(count.count, 10)

    if (productCount === 0) {
      console.log('✅ Products table is already empty.')
      process.exit(0)
    }

    // Delete all products
    const deleted = await knex('products').del()
    console.log(`✅ Deleted ${deleted} product(s) from the database.`)

  } catch (error) {
    console.error('❌ Error clearing products:', error.message)
    process.exit(1)
  } finally {
    await knex.destroy()
  }
}

clearProducts()
