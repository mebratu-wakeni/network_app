# Project TODO – Roadmap to Production & Packaging

**Last Updated:** February 7, 2025  
**Scope:** Tasks from current state through production deployment and packaging.

---

## Phase 1: Cash Balance Validation (Prevent Negative Cash)

### 1.1 UI Validation — DONE ✓
- [x] Add cash balance check in Purchase CheckoutConfirmationModal before completing cash purchase
- [x] Use existing `dashboard:get-ledger-balances` IPC, compare `balances['1100']` with net amount
- [x] Show "Insufficient cash balance" alert and block completion when balance < required

### 1.2 Backend / Transaction-Level Validation — DONE ✓
- [x] Add cash balance validation inside purchase order creation transaction (API layer)
- [x] Add cash balance validation for purchase payment (cash)
- [x] Add cash balance validation for expense (cash), cash loan receivable, cash loan receivable return, cash loan payable repayment
- [ ] Add for: Sales (cash payment), Withhold payable settlement (when implemented)
- [ ] Consider race-condition handling (check balance inside DB transaction) for higher concurrency

---

## Phase 2: Financial Module & Submodules

### 2.1 Expense Sub-module
- [ ] Define `expenses` table schema (from user-provided schema)
- [ ] Migration: create expenses table
- [ ] API: expenses CRUD + ledger posting (LedgerHelper.recordExpense or similar)
- [ ] UI: Expense list, Create expense form
- [ ] Optional: Add UI cash validation when creating cash expense

### 2.2 Account Receivables (Tab-based UI)
- [ ] **Tab A – Trade Receivables:** Read-only view of outstanding sales (from `sales_orders`); payments handled in Sales module
- [ ] **Tab B – Loans Receivable:** Table `cash_loans_receivable`, API (create loan, record return), ledger integration (1210)
- [ ] **Tab C – Withhold Receivable:** List confirmed sales withholds; settlement batch API; update `sales_orders.withhold_settled`
- [ ] Settlement tables: `withhold_receivable_settlements`, `withhold_receivable_settlement_items`

### 2.3 Account Payables (Tab-based UI)
- [ ] **Tab A – Trade Payables:** Read-only view of outstanding purchases; payments handled in Purchase module
- [ ] **Tab B – Loans Payable:** Table `cash_loans_payable`, API (create loan, record repayment), ledger integration (3300)
- [ ] **Tab C – Withhold Payable:** List purchase withholds; settlement batch API; update `purchase_orders.withhold_settled`
- [ ] Settlement tables: `withhold_payable_settlements`, `withhold_payable_settlement_items`

### 2.4 Deposits Sub-module
- [ ] Define `deposits` table schema (from user-provided schema)
- [ ] Migration: create deposits table
- [ ] API: deposits CRUD + ledger posting (DR Cash, CR 4100/4300)
- [ ] UI: Deposit list, Create deposit/contribution form

### 2.5 Navigation & Module Wiring
- [ ] Add Financial module to header/navigation
- [ ] Financial module shell with sub-tabs (Expense | Receivables | Payables | Deposits)
- [ ] IPC handlers and API routes for all financial endpoints

---

## Phase 3: Dashboard Graphics

- [ ] Add chart library (e.g. Chart.js, Recharts, or similar)
- [ ] Revenue vs. Expenses trend chart (by date range)
- [ ] Sales vs. Purchase comparison chart
- [ ] Cash balance trend over time
- [ ] Optional: Inventory value over time, AR/AP aging summary
- [ ] Wire chart data from existing APIs (ledger, sales stats, purchase stats)

---

## Phase 4: SQLite3 Support

- [ ] Add SQLite3 as a database option alongside PostgreSQL
- [ ] Config/env switch: `DB_TYPE=postgres` | `DB_TYPE=sqlite`
- [ ] Knex configuration for SQLite (filename/path, no schema in sqlite)
- [ ] Migrations: ensure compatibility with SQLite (data types, constraints)
- [ ] Test full flow: migrations, seeds, API, app against SQLite

---

## Phase 5: Installation & Packaging – Server / Client / Standalone

### 5.1 Architecture Clarification
- **Server App:** Electron + API + DB. Exposes URL for clients to connect.
- **Client App:** Electron (or browser) that connects to server API only. No local DB.
- **Standalone App:** Single Electron app with embedded API + SQLite3. No network mode; single-user or local-only.

### 5.2 Installation Procedure
- [ ] Create installer that presents mode selection: Server | Client | Standalone
- [ ] **Server mode:** Install with PostgreSQL (Docker) or SQLite3; Electron starts API; shows LAN URL for clients
- [ ] **Client mode:** Install lightweight Electron; prompt for server URL; connect to existing API
- [ ] **Standalone mode:** Install with embedded SQLite3 + API; single-machine use

### 5.3 Packaging Tasks
- [ ] Electron Builder (or similar) configuration for each mode
- [ ] Server app: Include API server, DB setup (SQLite default for simplicity)
- [ ] Client app: Minimal bundle; no API/DB
- [ ] Standalone app: Full bundle with API + SQLite
- [ ] Auto-update / versioning (optional)

---

## Phase 6: Quality, Docs & Release

### 6.1 Testing
- [ ] Unit tests for critical services (LedgerHelper, purchase/sales logic)
- [ ] Integration tests for API routes
- [ ] E2E tests for key flows (purchase, sale, login)

### 6.2 Documentation
- [ ] User guide (installation, daily use)
- [ ] Admin guide (server setup, backup, restore)
- [ ] Developer setup (DEVELOPMENT.md already exists; keep updated)

### 6.3 Release
- [ ] Version tagging and changelog
- [ ] Build artifacts for target platforms (Windows, macOS, Linux)
- [ ] Signing and notarization (for distribution)

---

## Summary Checklist (High Level)

| # | Area | Status |
|---|------|--------|
| 1 | Cash validation (UI) | Done |
| 2 | Cash validation (backend/transaction) | Pending |
| 3 | Financial module + submodules | Pending |
| 4 | Dashboard graphics | Pending |
| 5 | SQLite3 support | Pending |
| 6 | Installation (Server/Client/Standalone) | Pending |
| 7 | Packaging & release | Pending |

---

## Dependencies & Order

1. **Phase 1.2** can be done independently; recommended after Phase 2 Expense (to validate expense payments too).
2. **Phase 2** depends on user-provided `expenses` and `deposits` schemas.
3. **Phase 3** (dashboard) can run in parallel with Phase 2.
4. **Phase 4** (SQLite3) should be done before Phase 5 Standalone.
5. **Phase 5** builds on Phase 4 for Standalone mode.
