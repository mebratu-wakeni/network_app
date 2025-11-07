# Development Workflow

This project has:
- Electron + Vite app in `app/`
- Express.js API in `api/`
- PostgreSQL via local DB or Docker
- Knex for migrations

## Prerequisites
- Node.js 20+
- Docker Desktop (optional if using Docker-based DB)
- Local PostgreSQL (optional if using Docker-based DB)

## Environment
Two ways to connect the API to Postgres:
- Local: set `DATABASE_URL`
- Docker: set host-based `DB_*` env (handled by `docker-compose.yml`)

Common variables used by the API:
- `DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `PORT=4000`

## Start with Local Postgres
1) Create database (example):
```
createdb pharma_dev
```
2) Create `.env` at repo root:
```
DATABASE_URL=postgres://postgres:password@localhost:5432/pharma_dev
PORT=4000
```
3) Install and migrate API:
```
cd api
npm install
npm run migrate
npm run dev
```
4) Test API:
```
curl http://localhost:4000/health
curl http://localhost:4000/api/db-health
```
5) CRUD smoke test:
```
curl -X POST http://localhost:4000/api/test-items -H 'Content-Type: application/json' -d '{"name":"Item A","quantity":3}'
curl http://localhost:4000/api/test-items
```

## Start with Dockerized Postgres + API
From repo root:
```
docker compose up --build
```
This will:
- Start `db` (Postgres)
- Run API migrations automatically
- Start `backend` (Express on :4000)

Verify:
```
curl http://localhost:4000/health
curl http://localhost:4000/api/db-health
```
(Optional) Re-run migrations inside container:
```
docker compose exec backend npx knex --knexfile db/knexfile.js migrate:latest
```

Note: Docker Postgres is mapped to host port 5433 (db:5432 -> host:5433) to avoid conflicts with any local Postgres.

## Electron + Vite App (frontend)
Run the desktop app during development:
```
cd app
npm install
npm run dev
```
Point any API calls in the app to `http://localhost:4000` for dev.

## Migrations
Create a new migration (example):
```
cd api
npx knex --knexfile db/knexfile.js migrate:make add_some_table
npm run migrate
```
Rollback last batch:
```
npm run rollback
```

### Running migrations and seeds against Docker DB from your host
If you want to run migrations/seeds without entering the container, point `DATABASE_URL` to the exposed Docker port 5433:
```
cd api
DATABASE_URL=postgres://postgres:password@localhost:5433/pharma_dev npx knex --knexfile db/knexfile.js migrate:latest
DATABASE_URL=postgres://postgres:password@localhost:5433/pharma_dev npx knex --knexfile db/knexfile.js seed:run
```

### Verifying seeded RBAC data
List roles inside the DB container:
```
docker compose exec db psql -U postgres -d pharma_dev -c "SELECT name FROM roles ORDER BY 1;"
```

You should see: admin, manager, viewer.

## Troubleshooting
- API uses local DB instead of Docker DB:
  - Ensure Docker is running and `docker compose up` started `backend` and `db`.
  - In Docker, `IS_DOCKER=true` ensures host `db` is used.
- `role "postgres" does not exist` (local only):
  - Use a valid local user in `DATABASE_URL` or create the `postgres` role.
- Port collisions:
  - Change `PORT` or Postgres mapping in `docker-compose.yml`.
