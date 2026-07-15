# Deployment Workflow

This repo supports two different delivery paths:

1. **API (cPanel / Postgres host)** — **tarball deploy** (extract on server, `npm install`, `npm run migrate`, restart). cPanel does not support reliable GitHub→server CI; ignore `.github/workflows/deploy.yml` for multi-tenant production unless you explicitly use it for a legacy SQLite host.
2. **Desktop installers** — GitHub Actions builds Mac/Windows/Linux; you upload artifacts to `server.masatechplc.com/downloads/`. See [DOWNLOADS_AND_UPDATES.md](./DOWNLOADS_AND_UPDATES.md).

Branch policy: [BRANCHING.md](./BRANCHING.md). Multi-tenant readiness: [MULTI_TENANT_READINESS.md](./MULTI_TENANT_READINESS.md).

## API (cPanel / Postgres host)

**Multi-tenant and most cPanel hosts:** ship a **tarball** (zip/`tar.gz` of `api/`), upload via File Manager or SFTP, extract, then:

```bash
cd /path/to/api
npm install --production
npm run migrate
# restart app (e.g. touch tmp/restart.txt or cPanel Node “Restart”)
```

Desktop installers are **not** part of the API tarball. They are published automatically by GitHub Actions to `/downloads/cloud-multi/` — see [docs/DOWNLOADS_AND_UPDATES.md](./docs/DOWNLOADS_AND_UPDATES.md).

## API (Docker — local dev)

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
