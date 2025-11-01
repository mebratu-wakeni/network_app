import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('../.env') });

const isDocker = process.env.NODE_ENV === 'docker'; // or set NODE_ENV=docker when running in container

const connection = isDocker
  ? {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  }
  : process.env.DATABASE_URL; // local macOS Postgres

export default {
  client: 'pg',
  connection,
  migrations: {
    directory: path.resolve('./migrations'),
  },
  seeds: {
    directory: path.resolve('./seeds'),
  },
};
