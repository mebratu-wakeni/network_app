import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'
import fs from 'fs'
import { resolveDbFilePath } from './resolve-db-file.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cloud target: Just pull the production .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const dbFile = resolveDbFilePath()

// Automatically creates the /db directory if it doesn't exist yet on the server
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