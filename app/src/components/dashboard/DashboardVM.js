const { ViewModel, SharedStateManager } = Liteframe;

const EMPTY_DASHBOARD = {
  ledger: null,
  sales: null,
  purchase: null,
  inventory: null,
  customers: null
};

/**
 * Dashboard VM: loads aggregate stats for Sales, Purchase, Inventory, Customers,
 * and ledger balances. Uses Promise.allSettled so one failure does not block others.
 * State: loading, error (first message if any), dashboard (normalized per-segment data).
 */
export class DashboardVM extends ViewModel {
  constructor(sharedStateManager = new SharedStateManager()) {
    super(sharedStateManager);
    this.initializeState();
  }

  initializeState() {
    this.setState('loading', false);
    this.setState('error', null);
    this.setState('dashboard', { ...EMPTY_DASHBOARD });
  }

  getDashboard() {
    return this.getState('dashboard') || { ...EMPTY_DASHBOARD };
  }

  /**
   * Load all dashboard data via IPC in parallel. Normalizes each segment so UI
   * always receives a consistent shape; missing or failed segments stay null.
   */
  async loadDashboard() {
    this.updateState('loading', true);
    this.updateState('error', null);

    const dashboard = { ...EMPTY_DASHBOARD };

    const [ledgerRes, salesRes, purchaseRes, inventoryRes, customersRes] = await Promise.allSettled([
      window.ipcRenderer?.invoke?.('dashboard:get-ledger-balances') ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('sales:get-orders', { limit: 1, offset: 0 }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('purchase:get-stats', {}) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('inventory:get-stock', { limit: 1, offset: 0 }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('customers:get-customers', { limit: 1, offset: 0 }) ?? Promise.resolve(null)
    ]);

    const errors = [];

    if (ledgerRes.status === 'fulfilled' && ledgerRes.value != null) {
      dashboard.ledger = ledgerRes.value.balances ?? {};
    } else if (ledgerRes.status === 'rejected') {
      errors.push(ledgerRes.reason?.message || 'Ledger');
    }

    if (salesRes.status === 'fulfilled' && salesRes.value?.stats) {
      const s = salesRes.value.stats;
      dashboard.sales = {
        totalOrders: (s.all?.count ?? 0) + (s.total_orders?.count ?? 0),
        totalValue: s.all?.value ?? s.total_orders?.value ?? 0,
        outstanding: s.outstanding?.value ?? 0,
        outstandingCount: s.outstanding?.count ?? 0
      };
    } else if (salesRes.status === 'rejected') {
      errors.push(salesRes.reason?.message || 'Sales');
    }

    if (purchaseRes.status === 'fulfilled' && purchaseRes.value?.stats) {
      const p = purchaseRes.value.stats;
      dashboard.purchase = {
        totalOrders: p.total_orders?.count ?? 0,
        totalValue: p.total_orders?.value ?? 0,
        outstanding: p.outstanding_balance?.value ?? 0,
        outstandingCount: p.outstanding_balance?.count ?? 0
      };
    } else if (purchaseRes.status === 'rejected') {
      errors.push(purchaseRes.reason?.message || 'Purchase');
    }

    if (inventoryRes.status === 'fulfilled' && inventoryRes.value != null) {
      const inv = inventoryRes.value;
      dashboard.inventory = {
        total: inv.total ?? (inv.stock?.length ?? 0),
        outOfStock: inv.stats?.outOfStock ?? 0,
        lowStock: inv.stats?.lowStock ?? 0,
        expiringSoon: inv.stats?.expiringSoon ?? 0
      };
    } else if (inventoryRes.status === 'rejected') {
      errors.push(inventoryRes.reason?.message || 'Inventory');
    }

    if (customersRes.status === 'fulfilled' && customersRes.value != null) {
      dashboard.customers = { total: customersRes.value.total ?? 0 };
    } else if (customersRes.status === 'rejected') {
      errors.push(customersRes.reason?.message || 'Customers');
    }

    if (errors.length > 0) {
      this.updateState('error', `Failed to load: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '…' : ''}`);
    }

    this.updateState('dashboard', dashboard);
    this.updateState('loading', false);
  }
}
