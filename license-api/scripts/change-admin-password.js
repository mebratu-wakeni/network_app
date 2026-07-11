/**
 * One-time script to change the admin password.
 * Usage:  node scripts/change-admin-password.js <new-password>
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcrypt'
import knexLib from 'knex'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const newPassword = process.argv[2]
if (!newPassword || newPassword.length < 8) {
  console.error('Usage: node scripts/change-admin-password.js <new-password>')
  console.error('Password must be at least 8 characters.')
  process.exit(1)
}

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || 'db/license.db')
const knex = knexLib({ client: 'sqlite3', connection: { filename: dbPath }, useNullAsDefault: true })

const hash = await bcrypt.hash(newPassword, 10)
const updated = await knex('admin_users').where({ username: 'admin' }).update({ password_hash: hash })
if (updated) {
  console.log('Password updated successfully.')
} else {
  console.error('admin user not found. Did you run migrations and seed?')
}
await knex.destroy()
