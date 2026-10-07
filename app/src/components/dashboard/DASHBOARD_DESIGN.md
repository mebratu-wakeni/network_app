# Dashboard Design — PharmaSuit

A single, app-wide dashboard that gives a modern, professional overview of all modules (Inventory, Purchase, Sales, Customers) and quick access to each.

---

## Design principles

- **Modern & professional**: Clean layout, consistent spacing, subtle shadows, clear typography. No visual clutter.
- **Glanceable**: KPIs and alerts visible at a glance; drill-down via cards/links.
- **Consistent**: Reuse existing design tokens (Tailwind, Card, Row, IonIcon) and the app’s existing colour and typography.
- **Resilient**: Missing or failed data shows placeholders or “—” and does not break the dashboard.

---

## Layout (top to bottom)

1. **Welcome / Header**
   - Title: “Dashboard” or “Overview”.
   - Optional short greeting (e.g. “Welcome back” + user name if available).
   - Subtitle: “Summary of your business across all modules.”

2. **KPI cards (grid)**
   - One card per main module: **Sales**, **Purchase**, **Inventory**, **Customers**.
   - Each card:
     - Icon (IonIcon) + module name.
     - Primary metric (e.g. total sales value, total orders, stock items count, customer count).
     - Optional secondary metric (e.g. outstanding balance, low stock count).
     - “View” / “Open” link that navigates to that module (same as sidebar).
   - Grid: 2×2 on small screens, 4 columns on large (e.g. `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`).

3. **Quick actions (optional)**
   - Row of buttons or links: “New Sale”, “New Purchase”, “View Stock”, “Add Customer” (or “Open [Module]”). Uses existing router so navigation matches sidebar.

4. **Alerts / Highlights (optional)**
   - Single strip or small card: e.g. “X items low stock”, “Y orders with outstanding balance”. Tappable to go to the relevant module/tab. Can be added in a later iteration.

---

## Data sources (IPC / API)

- **Sales**: `sales:get-orders` with `limit: 1`, `offset: 0` → use `stats` (and optionally `total`) from response. Display e.g. total orders value, outstanding balance from stats.
- **Purchase**: `purchase:get-stats` → use returned `stats` (total orders, value, outstanding, etc.).
- **Inventory**: `inventory:get-stock` with `limit: 1`, `offset: 0` → use `total` and `stats` (outOfStock, lowStock, expiringSoon, etc.).
- **Customers**: `customers:get-customers` with `limit: 1`, `offset: 0` → use `total` for customer count.

All calls can be fire-and-forget for the dashboard; show loading state then numbers or “—” on error.

---

## Visual style

- **Cards**: White background, subtle border (`border border-gray-200`), rounded corners (`rounded-lg`), light shadow (`shadow-sm`). Padding consistent with rest of app (e.g. `p-5`).
- **Typography**: Module name = font-semibold, text-gray-800. Primary number = larger (e.g. `text-2xl`), font-semibold. Secondary = text-sm, text-gray-500 or muted.
- **Icons**: One IonIcon per card (e.g. pricetag-outline, cart-outline, layers-outline, business-outline). Slightly muted colour (e.g. text-blue-600 or gray-500) so they don’t dominate.
- **Links**: Text link or small button “View Sales” etc., using primary colour or underline; click triggers same navigation as sidebar (router).

---

## Responsive behaviour

- Stack KPI cards vertically on very small screens; 2 columns from `sm`, 4 columns from `lg`.
- Welcome/header text can wrap; avoid very long titles.

---

## Accessibility & UX

- Ensure sufficient contrast for all text.
- Clickable cards or “View” links must be clearly focusable and keyboard-usable (same as existing buttons/links in the app).
- Loading: show skeleton or “Loading…” on the cards while data is fetched; then replace with numbers or “—” on error.

---

## File structure (production)

- **`dashboardConfig.js`**: Single source of truth for ledger account codes, labels, icons, colors; module cards; quick actions; chart placeholders. No logic.
- **`dashboardFormatters.js`**: Pure formatters — `formatCurrency`, `formatBalance`, `formatCount`, `workingCapitalFromLedger`. Used by UI only.
- **`DashboardVM.js`**: State (loading, error, dashboard). `loadDashboard()` uses `Promise.allSettled` so one failed segment does not block others; errors are collected and surfaced as a single message. Normalizes API responses into a consistent dashboard shape. Optional guard for missing `window.ipcRenderer`.
- **`DashboardUI.js`**: Config-driven presentational component. Imports config and formatters; renders sections from `LEDGER_ACCOUNT_CODES`, `MODULE_CARDS`, `QUICK_ACTIONS`, `CHART_PLACEHOLDERS`. Uses semantic regions (`role="region"`, `aria-label`), `role="main"`, `role="status"` for loading, `role="alert"` for error. Reusable `KPICard` and `ChartPlaceholderCard`.
- Route `/` in NavigationUI renders `DashboardUI` (with router as needed).

---

## Layout details

- **Full width**: Dashboard content uses full width of its container (no `max-w` / centering).
- **Stats formatting**: Amounts shown without parentheses; negatives use a minus sign. Stat value font is slightly smaller (`text-lg`) for readability.

## Charts & trends (placeholders in place)

- **Sales & Purchase trends**: Line or bar chart over time — to be implemented.
- **Expenses by category**: Pie chart — depends on Expenses module (to be implemented).

## Production patterns

- **Config-driven UI**: Add or reorder ledger accounts, module cards, or quick actions by editing `dashboardConfig.js` only.
- **Resilient loading**: Each data segment (ledger, sales, purchase, inventory, customers) is requested in parallel; a failed segment does not clear others. First few error messages are shown in one alert.
- **Accessibility**: Main content has `role="main"`; sections use `role="region"` and `aria-label`; loading state uses `role="status"` and `aria-live="polite"`; error uses `role="alert"`. KPI and chart cards use `role="article"`.
- **Consistent data shape**: VM normalizes all responses so the UI always receives the same dashboard object shape; missing segments remain `null`.

## Future enhancements (out of scope for v1)

- Date range filter for sales/purchase stats.
- Mini sparklines or trend indicators.
- “Recent activity” list (last 5 sales/purchases).
- Export dashboard or print summary.
