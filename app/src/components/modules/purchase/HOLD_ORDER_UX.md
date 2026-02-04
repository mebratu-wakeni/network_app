# Hold Order Tab – UX & Workflow Definition

## 1. Creating a Hold Order (already defined)

1. User fills the **Current Order** form (supplier, date, items, payment mode, withholding, etc.).
2. User clicks **Checkout** → Checkout confirmation modal opens (Complete / Edit / Hold).
3. User chooses **Hold**.
4. System validates the order and creates a row in **`purchase_hold_orders`** with a full snapshot (supplier, date, items, payment mode, withholding, first payment/cheque, etc.). No purchase order or ledger entry is created.

That’s the only way a hold order is created.

---

## 2. Hold Orders Tab – Content

### 2.1 What’s on the screen

- **List**: Table of hold orders with the headers below.
- **Pagination**: Rows per page, Previous/Next (or page numbers), total count (e.g. “Showing X to Y of Z hold orders”).
- **Search**: By hold order #, supplier (or other fields as needed).
- **Sort**: By date, amount, supplier, etc. (as supported by API).
- **Filter**: One filter for “which hold orders to show”:
  - **All hold orders** – active + archived (if we ever show archived in same list with a badge)  
  **or** three options:
  - **All** – active and archived in one list (with a column or badge for status).
  - **Hold orders** – only active (`is_archive = false`).
  - **Archived hold orders** – only archived (`is_archive = true`).

Use whichever filter model fits the UI (single “All / Active / Archived” control).

### 2.2 Table headers

| Column        | Description                    |
|---------------|--------------------------------|
| Hold Order #  | e.g. HOLD-0001                 |
| Supplier      | Supplier name                  |
| Order Date    | Date of the order              |
| Items         | Item count (e.g. “3 item(s)”)  |
| Amount        | Net amount (Br), formatted     |
| Actions       | View, Load, Delete             |

---

## 3. Actions (per row)

| Action  | Label in UI | What it does in the app | In the DB |
|---------|-------------|--------------------------|-----------|
| **View**  | View        | Opens a read-only view (e.g. drawer) of that hold order (supplier, date, items, amounts). No edit, no load. | No change. |
| **Load**   | Load        | Fetches the hold by ID, restores its snapshot into **Current Order**, switches tab to **Current Order**. User can then edit and Complete or Hold again. | See section 4 – we do **not** delete/archive the row on Load by default. |
| **Delete** | Delete      | Confirmation: “Are you sure you want to delete this hold order?” (or “archive”). On confirm: hide from active list. | Set **`is_archive = true`**. We never physically delete rows. |

So: **View** = look only. **Load** = copy into Current Order and go to Current Order tab. **Delete** = archive in DB, remove from active list.

---

## 4. What happens when we Load a hold order?

**Load** means: take this hold order’s snapshot and put it into the Current Order form, then switch to the Current Order tab. The hold order row in the DB stays as-is unless we explicitly archive it.

We have to decide: **when** do we set `is_archive = true` for that hold?

### Option A: Archive as soon as user clicks Load

- **Behavior**: When user clicks **Load**, we restore the snapshot into Current Order, switch tab, and **immediately** set `is_archive = true` for that hold order (and refresh the list so it disappears from “Hold orders”).
- **Pros**: Clean: the hold is “consumed”; no duplicate in the list; list only shows holds that haven’t been loaded yet.
- **Cons**: If the user loads by mistake or abandons without completing, the draft is no longer in the Hold Orders list (it only exists in Current Order until they clear or navigate away). No way to “put it back” into the list except Hold again (which creates a **new** hold).

### Option B: Do not archive on Load; archive only when user clicks Delete (or when they Complete – see Option C)

- **Behavior**: **Load** only copies data into Current Order and switches tab. The hold order row stays **active** (`is_archive = false`). It stays in the “Hold orders” list until the user explicitly clicks **Delete** (archive) for that row.
- **Pros**: Safe: user can load, change mind, go back to Hold Orders and Load again or Delete. No accidental loss of the draft from the list.
- **Cons**: The same hold can appear in the list while it’s also loaded in Current Order. If they Complete, we have one completed PO and one still-active hold (duplicate draft) until they Delete it. Optional: when a hold is “loaded”, we could show a badge like “Loaded” so it’s clear it’s the one in Current Order (requires tracking “which hold id is currently loaded” in the app).

### Option C: Do not archive on Load; archive when user Completes the order that came from that hold

- **Behavior**: Load only copies data and switches tab; hold stays active. When the user **Completes** the order, we send `hold_order_id` to the API; backend (or frontend after success) sets `is_archive = true` for that hold. Delete (archive) is still available for holds they never complete.
- **Pros**: List stays accurate: once they complete, that hold is archived automatically; if they don’t complete, the hold remains in the list until they Delete or complete later.
- **Cons**: Requires tracking which current order came from which hold (e.g. `hold_order_id` in state) and calling archive on complete.

### Recommendation

- **Preferred**: **Option B** for MVP: **Load does not archive.** Archive only when the user clicks **Delete**. Simple, no extra state or API calls on Load or on Complete. If you want to avoid “duplicate” drafts in the list after they complete, we can add **Option C** later (auto-archive on complete when `hold_order_id` is present).
- **Alternative**: **Option A** if the product rule is “loading a hold means I’m taking it; remove it from the list immediately.” Then we archive on Load and don’t need an “Archived” filter for “loaded” holds, but we lose the safety of “change my mind and see it again in the list.”

Once you pick A, B, or C, the doc and implementation should state it explicitly (e.g. “On Load we do / do not set is_archive”).

---

## 5. Lifecycle summary

```
[Current Order]  ──Checkout → Hold──►  [Hold order row in DB]  (appears in Hold Orders list)

From Hold Orders tab:
  - View   → open read-only drawer (no DB change)
  - Load   → copy to Current Order, switch tab (archive or not: see section 4)
  - Delete → set is_archive = true (hide from active list; we never physically delete)
```

---

## 6. Filters reminder

- **All hold orders** – could mean “active + archived” in one list with a status column, or “active only” depending on product wording.
- **Hold orders** – active only (`is_archive = false`).
- **Archived hold orders** – archived only (`is_archive = true`).

API must support filtering by `is_archive` (e.g. query param or default “active only” with an “include archived” or “filter: archived” option).

---

**Decision: Option B.** Load does **not** archive. We set `is_archive = true` only when the user clicks **Delete**. No archive on Load, no auto-archive on Complete.

---

## 7. Step-by-step implementation plan

Implement in order; confirm before moving to the next step.

| Step | What | Scope |
|------|------|--------|
| **1** | **API: Filter by `is_archive`** | Add query param `filter` to GET hold-orders: `all` \| `active` \| `archived`. Repository: make `is_archive` filter conditional. Controller + service pass `filter`. |
| **2** | **Frontend VM: Hold orders filter state** | Add state for filter (default `active`). Pass filter when loading hold orders via IPC. Ensure Load does not call archive. |
| **3** | **Hold Orders tab: Layout, filter bar, pagination** | Split into sub-steps below. |
| **3a** | **Top bar layout** | One row: search (left), empty space right. Same flex/styling as Order History table section top row (`flex items-center justify-between gap-4 px-4 py-4 border-b border-gray-200 bg-gray-50`). No new behavior. |
| **3b** | **Filter dropdown** | Add filter: "All hold orders" / "Hold orders" / "Archived". Wire to `updateHoldOrderTableConfig({ filter, offset: 0 })`. Use SelectFluid + SelectOptions; map labels to `all` / `active` / `archived`. |
| **3c** | **Rows per page + prev/next** | Add "Rows per page" SelectRelative (10, 25, 50, 100), "X–Y of Z" text, IconButton prev/next. Wire to `updateHoldOrderTableConfig({ limit })` and `updateHoldOrderTableConfig({ offset })`. |
| **3d** | **Place filter + pagination in top row** | Ensure top row is: search (left) + filter dropdown + rows per page + "X–Y of Z" + prev/next (right). Remove old pagination from bottom if still there. |
| **4** | **Hold Orders tab: Table and actions (View, Load, Delete)** | Table columns as in doc. Actions: View, Load, Delete (label “Delete”; confirmation “Are you sure you want to delete this hold order?”). Use financeFormat for amount. Load stays as-is (no archive). |
| **5** | **View action: Hold order details drawer** | New read-only drawer for hold details (supplier, date, items, summary). Fetch full hold by ID; no edit, no Record Payment. |
| **6** | **Polish** | Empty/loading states, financeFormat everywhere, any small UX tweaks. |

This document is the single reference for implementing the Hold Orders tab.
