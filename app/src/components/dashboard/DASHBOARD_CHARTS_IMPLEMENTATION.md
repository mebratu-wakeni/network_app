# Dashboard Charts — Tech Stack & Implementation

This doc describes what it takes to implement the dashboard charts (Sales & Purchase trends, Expenses by category) from a tech-stack and implementation perspective.

---

## 1. Tech stack (what you need)

### Frontend (app)

| Piece | Choice | Notes |
|-------|--------|--------|
| **Chart library** | One of: **Chart.js**, **ApexCharts**, or **ECharts** | All work with vanilla JS + DOM; no React/Vue required. |
| **Install** | `npm install chart.js` (or `apexcharts`) | Add to `app/package.json` and use in the dashboard. |
| **Rendering** | Canvas (Chart.js) or SVG (ApexCharts, ECharts) | Library draws into a container element you provide (e.g. a `<div>` or `<canvas>`). |
| **Framework** | Existing stack only | Vite + Liteframe + Tailwind; no new framework. |

Recommendation: **Chart.js** for simplicity (line/bar/pie, good docs, small API) or **ApexCharts** if you want more built-in options (e.g. zoom, tooltips) and SVG.

### Backend (api)

| Piece | Choice | Notes |
|-------|--------|--------|
| **Data** | New or existing API endpoints | Aggregated time-series and, later, expense breakdown. |
| **Storage** | Existing DB | `sales_orders`, `purchase_orders`, `account_ledger` (and future expenses). |
| **Stack** | No change | Same Node, Express, Knex, PostgreSQL. |

### Summary

- **New dependency**: one chart library in the **app** (e.g. `chart.js`).
- **New code**: chart components in the app, optional new API routes + repository methods for aggregated stats.
- **No new language or runtime**; same Electron + Vite + Node stack.

---

## 2. What each chart needs

### Sales & Purchase trends (line or bar)

- **Data**: Time-series — e.g. “sales value per day/week/month” and “purchase value per day/week/month”.
- **Source**: Aggregate from `sales_orders` and `purchase_orders` (e.g. by `order_date` or `created_at`), or from `account_ledger` (Revenue 5100 and e.g. Inventory 1300 / AP 3100 movements by date).  
- **API**: e.g. `GET /stats/sales-trend?period=month&from=2025-01-01&to=2025-01-31` and `GET /stats/purchase-trend?...` returning `{ labels: ['Jan', 'Feb', ...], values: [100, 200, ...] }`.
- **Frontend**: One container (e.g. `<div>` or `<canvas>`) per chart; when the dashboard mounts (or when data arrives), create the chart with that element and the API data.

### Expenses by category (pie)

- **Data**: Amounts per expense category (e.g. COGS, Operating, etc.).
- **Source**: Once an Expenses module exists, from expense ledger accounts or an `expenses` table. For now you could derive from `account_ledger` (e.g. 6100 COGS, 6200 Operating, etc.) as a first step.
- **API**: e.g. `GET /stats/expenses-by-category?from=...&to=...` returning `[{ name: 'COGS', value: 5000 }, ...]`.
- **Frontend**: One container; pass labels and values to the chart library’s pie/doughnut API.

---

## 3. Implementation steps

### Step 1: Add the chart library (app)

```bash
cd app
npm install chart.js
# or: npm install apexcharts
```

### Step 2: Create a chart container in the dashboard

- In the place of the current “Sales & Purchase trends” placeholder, render a **DOM node** the library can use:
  - Chart.js: a `<canvas>` (e.g. via a wrapper that creates `document.createElement('canvas')` or a known `id`).
  - ApexCharts: a `<div id="sales-trend-chart">`.
- You need a **reference** to that node when it’s in the DOM (e.g. after the dashboard segment is rendered). Options:
  - Give the node a stable `id` and use `document.getElementById(...)` when the dashboard (or parent) is mounted or when data is set.
  - Or, if Liteframe supports refs/callbacks on mount, pass the node to a small helper that creates the chart.

### Step 3: Fetch data and create the chart

- **Data**: Reuse existing IPC/API (e.g. list of orders with dates) and aggregate in the app, **or** add dedicated endpoints (recommended for larger datasets).
- **Create chart**: When you have the container element and the data, call the library API, e.g.:
  - **Chart.js**: `new Chart(canvasElement, { type: 'line', data: { labels, datasets: [...] }, options: {...} })`.
  - **ApexCharts**: `new ApexCharts(containerElement, { chart: { type: 'line' }, series: [...], xaxis: { categories: [...] } }).render()`.
- **Lifecycle**: Create the chart once when the container is available and data is loaded; if the dashboard is removed/hidden, destroy the chart instance (e.g. `chart.destroy()`) to avoid leaks and errors.

### Step 4: Backend (optional but recommended)

- Add routes, e.g. under `api/src/routes/index.js`: `GET /stats/sales-trend`, `GET /stats/purchase-trend`, and later `GET /stats/expenses-by-category`.
- In the repository layer, run aggregated queries (e.g. `knex('sales_orders').select(knex.raw("date_trunc('month', order_date)")).sum('total_amount').groupBy(...)`) and return labels + values.
- From the app, call these via existing HTTP/API + IPC pattern and pass the result into the chart.

---

## 4. Minimal Chart.js example (vanilla JS)

```js
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// When you have a canvas in the DOM and data:
const canvas = document.getElementById('sales-trend-chart');
if (canvas && data) {
  const chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: data.labels,   // e.g. ['Jan', 'Feb', 'Mar']
      datasets: [{
        label: 'Sales',
        data: data.values,
        borderColor: 'rgb(16, 185, 129)',
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
  // Keep a reference to call chart.destroy() when the dashboard unmounts.
}
```

For a **pie** (expenses):

```js
const chart = new Chart(ctx, {
  type: 'pie',
  data: {
    labels: ['COGS', 'Operating', 'Other'],
    datasets: [{ data: [5000, 2000, 500], backgroundColor: ['#f59e0b', '#3b82f6', '#6b7280'] }]
  },
  options: { responsive: true, maintainAspectRatio: false }
});
```

---

## 5. Summary table

| Item | Technology | Effort |
|------|------------|--------|
| Chart rendering | Chart.js (or ApexCharts) in the app | Add dependency; one wrapper per chart type |
| Container | `<canvas>` or `<div>` in dashboard UI | Reuse existing Row/Card and pass an id or ref |
| Sales/Purchase trend data | API: aggregate by date from orders or ledger | New route + repository method |
| Expenses data | API: aggregate by account/category from ledger (or expenses table later) | New route + repository; can be stubbed until Expenses module exists |
| IPC | Existing `dashboard:*` or new `stats:*` handlers | Same pattern as ledger balances |

No new language or runtime is required; the same frontend and backend stack can support these charts with one new dependency and some new endpoints and UI wiring.
