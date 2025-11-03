import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'

// Resolve paths relative to this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDocker = process.env.IS_DOCKER === 'true'
// Load env for local dev only; in Docker, rely on container env
if (!isDocker) {
  dotenv.config()
  dotenv.config({ path: path.resolve(__dirname, '../../.env') })
}

// Prefer DATABASE_URL if present; otherwise use host-based vars (e.g., in Docker)
const useUrlBased = Boolean(process.env.DATABASE_URL)
let connection
if (useUrlBased) {
  connection = process.env.DATABASE_URL
} else {
  const host = isDocker
    ? (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? process.env.DB_HOST : 'db')
    : process.env.DB_HOST
  connection = {
    host,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  }
}

const config = {
  client: 'pg',
  connection,
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    directory: path.resolve(__dirname, './migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.resolve(__dirname, './seeds'),
  },
};

export default config;
