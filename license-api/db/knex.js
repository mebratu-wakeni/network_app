import knexLib from 'knex'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || 'db/license.db')
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const knex = knexLib({
  client: 'sqlite3',
  connection: { filename: dbPath },
  useNullAsDefault: true
})

export default knex
