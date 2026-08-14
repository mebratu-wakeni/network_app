# Liteframe (AI reference)

Vanilla DOM UI: **`Row`** builds elements; **`EventDelegator`** centralizes events via **`data-uuid`**. **`SharedStateManager`** + **`ViewModel`** hold reactive state. **`StatefulRow`** is the usual module root (local state + VM subscriptions + **`morphdom`** updates). **`Router`** swaps views from the hash.

**This repo:** many files call **`Row({ class: '...' }, children)`** — the bundled API may normalize `class`; the reference below matches the **core** option names (`classNames` array). Follow **local file patterns** for props; follow this doc for **delegation, state, and lifecycle** behavior.

---

## Row

Creates `document.createElement(tagType)`, applies **`classNames`** (array of single tokens, no spaces per entry), **`style`**, **`attributes`**, appends **`children`** (only `Node` | `string` | `number`). Deprecated:**`styles`** — prefer `classNames` + `style`.

**Events / lifecycle:** if `events` is non-empty or `lifecycle` has `onMount`/`onUnmount`, the node gets **`data-uuid`** (= `attributes.id` or random UUID). Handlers are **not** `addEventListener` on the node; they register on **`delegator`**.

**Default:** `delegator = mainDelegator` (`new EventDelegator(document.body)`).

---

## EventDelegator

**Constructor:** `new EventDelegator(rootElement)` — must be an ancestor of any `Row` using this delegator.

**Dispatch:** one listener per event type on `rootElement`; **`handleEvent`** does `event.target.closest('[data-uuid]')` → lookup handler by `dataset.uuid` and event type. **Nearest** `data-uuid` ancestor wins.

**Cleanup:** `MutationObserver` on subtree; removed nodes with `data-uuid` → unregister events + lifecycle; **`onUnmount`** runs if present.

**Modals:** `const delegator = new EventDelegator(modalElement)` — pass **`delegator`** into every interactive **`Row`** (and into **`StatefulRow`**) inside that overlay.

**Broken clicks:** missing `delegator`, wrong root, or `Row` without `events`/`lifecycle` (no `data-uuid`) → delegation cannot find the handler.

---

## SharedStateManager (base)

- **`setState(key, value)`** — once per key; stores `deepClone`; duplicate key → warn + no-op.
- **`updateState(key, value)`** — requires prior `setState`; clones; runs **`middleware({ key, oldValue, newValue })`** (errors logged, no rollback); **`notifySubscribers(key)`**.
- **`getState(key, default?)`**
- **`deepClone`** — primitives, plain objects, arrays, `Date`, `Map`, `Set`; not safe for cycles, `RegExp`, class instances.
- **`subscribe` / `unsubscribe`** — subscriber gets `getState(key)` on update; **initial `setState` does not notify** (only `updateState` does).
- **`useMiddleware(fn)`** — optional.

---

## ViewModel

Facade over injected **`SharedStateManager`**: **`getState`**, **`updateState`**, **`setState`** (delegates — same once-only init rule), **`subscribe` / `unsubscribe`**, **`cleanup()`** (unsubscribes all callbacks this VM registered).

- **`resetState()`** → **`initializeState()`** — **not defined on base class**; subclasses must implement.
- **`execute(asyncFn)`** — try/catch, logs `constructor.name`, rethrows.
- **`batchUpdate(fn)`** — calls **`this.state.beginBatch()` / `endBatch()`**. Plain `SharedStateManager` in the docs you have **may not** define these → **throws** unless you extend or inject a manager that implements batching.

---

## StatefulRow

**Signature:** `StatefulRow({ viewModel, render, delegator = new EventDelegator(), initialState, stateKeys, ...props }, renderChild?)` — **`paint = render ?? renderChild`**.

- **Local:** `getLocalState`, `setLocalState` (shallow merge + rerender), `ensureLocalStateKey`, `localStateValue`. **Use sparingly** — intended for tiny UI-only flags (e.g. booleans); easy to get wrong. Prefer **ViewModel state** + a **single** reactive subscription when possible (see below).
- **VM subscriptions (`stateKeys`):** For each listed key, `StatefulRow` **`subscribe`s** to the ViewModel. **Every `updateState` on that key runs subscribers → `rerender()` → `morphdom`.** Listing **many** keys means **many independent re-renders** and more churn than needed.
- **Preferred project pattern (minimize `stateKeys`):** Put **only the key(s) that should “drive” morphs** in `stateKeys` — in this codebase often **just `loading`** (or one similar governor). On each paint, read everything else with **`viewModel.getState('product-list')`**, etc. **`viewModelState`** then only mirrors those few subscribed keys; treat other reads as **pull** from the VM at render time after **`loading`** (or your governor) transitions. *Tradeoff:* if you update a non-subscribed key without ever bumping a subscribed key, the UI will not morph until something subscribed updates — structure loads so **`loading`** (or explicit governor) toggles around work that must refresh the screen.
- **`ensureStateKey(k)`** adds another subscription mid-life (same re-render cost per key); avoid sprinkling many lazy keys unless necessary.
- **Rerender:** `paint({ viewModelState, localStateValue, getLocalState, setLocalState, ensureLocalStateKey, viewModel, ensureStateKey })` → must return an `HTMLElement` or rerender is skipped (warn). First node becomes **`container`**; later updates **`morphdom(container, newEl)`** with hooks: skip DOM update for **`ION-ICON`** if `name` unchanged; skip **`#salesChart`**.
- **Outer `Row`:** `children: [container]`, `lifecycle.onUnmount` → VM unsubscribes + debug log. **`...props`** spread last — avoid passing `children`/`lifecycle`/`delegator` in props by mistake.
- **Guards:** `isRendering` prevents reentrant morph while a paint is running.

---

## Router

**`new Router(container, prefix)`** — listens **`hashchange`**; optional initial hash handled on construct (may wait until first **`addRoute`** because **`isInitialized`** starts false).

- **`normalizePath`:** trim trailing slashes, **lowercase** — matching is case-insensitive.
- **`addRoute(path, fn)`** — stores `normalizePath(path)`. First route → **`isInitialized`**, **`requestAnimationFrame(handleRouteChange)`**.
- **`handleRouteChange`:** `rawPath = hash.slice(1) || '/'`; `path = normalizePath(rawPath)`; `routePath = path.startsWith(prefix) ? path.slice(prefix.length) : path`.
  - **Prefixed:** `path.startsWith(prefix) && routes.has(routePath)`.
  - **Top-level:** `!prefix && routes.has(routePath)` (`prefix === ''` ⇒ `routePath === path`).
  - **`content = await fn()`** — if **truthy:** `clearContent()` + `appendChild(content)`; if **falsy:** **do not clear** (keep previous DOM).
- **`navigate(path)`** — `location.hash = normalizePath(prefix + path)` (browser adds `#`).
- **`renderDefaultRoute()`** — `navigate('/')` if `'/'` registered.
- **No matching route:** silent (no log, no DOM change).

---

## Agent checklist (short)

| Topic | Rule |
|--------|------|
| Delegation | Modal / subtree root → dedicated **`EventDelegator(root)`** on all interactive **`Row`** + **`StatefulRow`**. |
| `data-uuid` | Needs non-empty **`events`** or **`lifecycle`** on that **`Row`**. |
| Buttons | **`attributes: { type: 'button' }`** in forms. |
| Children | Core **`Row`** ignores non-node / non-text children — filter booleans if needed. |
| State | **`setState`** once per key, then **`updateState`**; VM **`cleanup`** on teardown. |
| `StatefulRow` | **Few `stateKeys`** — often only **`loading`** to avoid one morph per VM key. Read other fields with **`viewModel.getState`** in `render`. Use **local state** minimally (simple flags); prefer VM + governor key. |
| `Router` | Return **falsy** from route only to **keep** current view; otherwise return a root node. |
| Paths | Router paths are **normalized** (lower, no trailing slash). |
