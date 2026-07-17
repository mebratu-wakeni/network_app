# Deployment Workflow

This repo supports deployment of the Express API via Docker. The Electron app is typically distributed as installers/binaries (built separately).

## API (Docker)

### Images and Compose
- Image built from `api/Dockerfile`
- `docker-compose.yml` defines two services:
  - `db`: PostgreSQL 15 with a data volume `db-data`
  - `backend`: Express API exposed on host `:4000`

### Environment (container)
- Set in `docker-compose.yml`:
  - `DB_HOST=db`
  - `DB_PORT=5432`
  - `DB_USER=postgres`
  - `DB_PASSWORD=password`
  - `DB_NAME=pharma_dev`
  - `PORT=4000`
  - `IS_DOCKER=true` (prevents loading local `.env` and ensures `db` host is used)

Adjust these for your environment (e.g., secrets, DB name). For production, use a proper secret store.

### Bring up services
```
docker compose up -d --build
```
- The `backend` waits for `db`, runs migrations, and starts on `:4000`.

Check status/logs:
```
docker compose ps
docker compose logs backend --tail=200
```

### Health checks
```
curl http://localhost:4000/health
curl http://localhost:4000/api/db-health
```

### Running migrations manually (optional)
```
docker compose exec backend npx knex --knexfile db/knexfile.js migrate:latest
```

### Updating
- Pull latest code, then:
```
docker compose up -d --build
```

### Scaling/External Postgres
If using an external/Postgres-as-a-service DB:
- Remove/disable the `db` service in `docker-compose.yml`
- Set env on `backend` to point at your DB:
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Keep `IS_DOCKER=true` so the API uses host-based config.

## Electron App Packaging (brief)
The Electron app in `app/` can be packaged with electron-builder.

Common steps:
```
cd app
npm install
npm run build # builds renderer
# Use your existing electron-builder config in app/electron-builder.json5
# Example:
# npx electron-builder --mac --x64
```
Configure the app to call the deployed API base URL (e.g., via env or config file).

## Troubleshooting
- API connects to localhost:5432 inside container:
  - Ensure `IS_DOCKER=true` and `DB_HOST=db` are set on the container.
- Migrations not found:
  - The image runs migrations automatically. To re-run, use the manual migrate command above.
- Permission/secret handling:
  - Replace inline passwords with secrets management (Docker secrets, env managers, KMS).
- Fiscal year coverage gaps (worst case):
  - New writes are blocked unless an **open** FY covers the transaction date.
  - Historical rows are not rewritten. If any dated row falls outside every `fiscal_years` range, run a read-only audit from `api/`:
    ```
    npm run db:audit-fy
    ```
  - Fix by inserting/extending `fiscal_years` rows (closed years are fine for history). Only new writes need an open year.
