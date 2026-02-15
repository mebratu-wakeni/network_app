import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'
import fs from 'fs'

// Resolve paths relative to this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const dbFile = process.env.DB_FILE
  ? path.resolve(process.env.DB_FILE)
  : path.resolve(__dirname, '../data/pharmasuit_lan.db')

fs.mkdirSync(path.dirname(dbFile), { recursive: true })

const config = {
  client: 'sqlite3',
  connection: {
    filename: dbFile,
  },
  useNullAsDefault: true,
  migrations: {
    directory: path.resolve(__dirname, './migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.resolve(__dirname, './seeds'),
  },
};

export default config;
