# Multi-tenant production readiness (Postgres)

Last verified: API test suite **184/184** on `feature/cloud-multi-tenant`.

## Tenant isolation

- All business tables scoped by `tenant_id` with FK to `tenants`.
- Auth middleware sets `req.tenantId` from JWT; `requireTenant` on tenant routes.
- Login requires `client_code` in client mode so users resolve to the correct tenant.
- **Cross-tenant penetration suite** (`tests/integration/cross-tenant/cross-tenant.penetration.test.js`) covers HTTP → service → repository for:
  - customers, users, products/inventory, purchase, sales, financial, settings, ledger/reports, fiscal years
  - bidirectional isolation (Alpha vs Beta)
  - mutation hardening (PATCH/DELETE on other tenant’s ids)
  - JWT tenant binding via real auth service
- Repository unit tests per module assert queries filter by `tenant_id`.

## Fiscal year (FY) guarding

- `assertFiscalYearOpen(knex, tenantId, transactionDate)` enforces:
  1. A fiscal year exists covering the transaction date **for that tenant**
  2. That fiscal year is **open** (not closed)
- Used on **write** paths in: sales, purchase, inventory (adjust/borrow/import), financial (expense, deposit, loans, withhold settlements).
- Unit + integration tests: `*.fiscal-year.test.js`, `fiscal-year.guard.test.js`, fiscal-years routes tests.
- FY rows are tenant-scoped; guard rejects cross-tenant FY lookup.

## Platform admin vs tenant

- `platform_admins` table — no `tenant_id`; separate JWT `type: platform_admin`.
- Tenant provisioning via `/api/platform/*` (masatech-admin); tenant users cannot access other tenants.

## Not in scope yet (planned)

- Tenant **delete / offboard** with export and confirmation (suspend exists on `tenants.status`).
- masatech-admin deploy to production `/admin`.
- Full downloads portal for all three desktop products (see `DOWNLOADS_AND_UPDATES.md`).

## Pre-production checklist

1. Postgres backup before first migrate on production.
2. Run migrations on Postgres host (tarball deploy — see `DEPLOYMENT.md`).
3. Seed platform admin once; change default password.
4. Create test tenant; verify login with `client_code`.
5. Create fiscal year; confirm writes succeed, closed FY blocks writes.
6. Run penetration-relevant smoke: tenant A cannot read tenant B receipt/customer by id.
