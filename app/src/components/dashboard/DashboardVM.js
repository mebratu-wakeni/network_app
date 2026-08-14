const { ViewModel, SharedStateManager } = Liteframe;
import { today, weekBounds } from '../utils/DateUtils.js';
import { summarizeLoadErrors } from '../utils/userErrorMessage.js';

const EMPTY_DASHBOARD = {
  salesToday: null,
  salesWeek: null,
  purchaseToday: null,
  purchaseWeek: null,
  holdOrdersSales: null,
  holdOrdersPurchase: null,
  inventory: null,
  customers: null,
  outstandingSales: null,
  outstandingPurchase: null
};

/**
 * Dashboard VM: loads operational metrics (today's sales/week sales, today's purchases,
 * hold orders, inventory alerts, outstanding, customers). No ledger balances.
 * Uses Promise.allSettled so one failure does not block others.
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
   * Load all dashboard data via IPC in parallel.
   */
  async loadDashboard() {
    this.updateState('loading', true);
    this.updateState('error', null);

    const dashboard = { ...EMPTY_DASHBOARD };

    const t = today();
    const { from: weekFrom, to: weekTo } = weekBounds();

    const [
      salesTodayRes,
      salesWeekRes,
      purchaseTodayRes,
      purchaseWeekRes,
      holdSalesRes,
      holdPurchaseRes,
      inventoryRes,
      customersRes,
      salesOutstandingRes,
      purchaseOutstandingRes
    ] = await Promise.allSettled([
      window.ipcRenderer?.invoke?.('sales:get-orders', {
        limit: 1,
        offset: 0,
        date_from: t,
        date_to: t
      }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('sales:get-orders', {
        limit: 1,
        offset: 0,
        date_from: weekFrom,
        date_to: weekTo
      }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('purchase:get-stats', {
        date_from: t,
        date_to: t
      }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('purchase:get-stats', {
        date_from: weekFrom,
        date_to: weekTo
      }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('sales:get-hold-orders', { limit: 1, offset: 0 }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('purchase:get-hold-orders', { limit: 1, offset: 0 }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('inventory:get-stock', { limit: 1, offset: 0 }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('customers:get-customers', { limit: 1, offset: 0 }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('sales:get-orders', {
        limit: 1,
        offset: 0,
        has_outstanding_balance: true
      }) ?? Promise.resolve(null),
      window.ipcRenderer?.invoke?.('purchase:get-orders', {
        limit: 1,
        offset: 0,
        has_outstanding_balance: true
      }) ?? Promise.resolve(null)
    ]);

    const errors = [];

    if (salesTodayRes.status === 'fulfilled' && salesTodayRes.value?.period_summary) {
      dashboard.salesToday = salesTodayRes.value.period_summary;
    } else if (salesTodayRes.status === 'fulfilled' && salesTodayRes.value) {
      dashboard.salesToday = {
        count: salesTodayRes.value.total ?? 0,
        value: 0
      };
    } else if (salesTodayRes.status === 'rejected') {
      errors.push(salesTodayRes.reason?.message || 'Sales today');
    }

    if (salesWeekRes.status === 'fulfilled' && salesWeekRes.value?.period_summary) {
      dashboard.salesWeek = salesWeekRes.value.period_summary;
    } else if (salesWeekRes.status === 'fulfilled' && salesWeekRes.value) {
      dashboard.salesWeek = {
        count: salesWeekRes.value.total ?? 0,
        value: 0
      };
    } else if (salesWeekRes.status === 'rejected') {
      errors.push(salesWeekRes.reason?.message || 'Sales week');
    }

    if (purchaseTodayRes.status === 'fulfilled' && purchaseTodayRes.value?.period_summary) {
      dashboard.purchaseToday = purchaseTodayRes.value.period_summary;
    } else if (purchaseTodayRes.status === 'fulfilled' && purchaseTodayRes.value?.stats) {
      const p = purchaseTodayRes.value.stats;
      dashboard.purchaseToday = {
        count: p.total_orders?.count ?? 0,
        value: 0
      };
    } else if (purchaseTodayRes.status === 'rejected') {
      errors.push(purchaseTodayRes.reason?.message || 'Purchase today');
    }

    if (purchaseWeekRes.status === 'fulfilled' && purchaseWeekRes.value?.period_summary) {
      dashboard.purchaseWeek = purchaseWeekRes.value.period_summary;
    } else if (purchaseWeekRes.status === 'fulfilled' && purchaseWeekRes.value?.stats) {
      const p = purchaseWeekRes.value.stats;
      dashboard.purchaseWeek = {
        count: p.total_orders?.count ?? 0,
        value: 0
      };
    } else if (purchaseWeekRes.status === 'rejected') {
      errors.push(purchaseWeekRes.reason?.message || 'Purchase week');
    }

    if (holdSalesRes.status === 'fulfilled' && holdSalesRes.value != null) {
      dashboard.holdOrdersSales = holdSalesRes.value.total ?? 0;
    } else if (holdSalesRes.status === 'rejected') {
      errors.push(holdSalesRes.reason?.message || 'Hold sales');
    }

    if (holdPurchaseRes.status === 'fulfilled' && holdPurchaseRes.value != null) {
      dashboard.holdOrdersPurchase = holdPurchaseRes.value.total ?? 0;
    } else if (holdPurchaseRes.status === 'rejected') {
      errors.push(holdPurchaseRes.reason?.message || 'Hold purchase');
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

    if (salesOutstandingRes.status === 'fulfilled' && salesOutstandingRes.value?.stats) {
      const s = salesOutstandingRes.value.stats;
      dashboard.outstandingSales = {
        count: s.outstanding?.count ?? 0,
        value: s.outstanding?.value ?? 0
      };
    } else if (salesOutstandingRes.status === 'rejected') {
      errors.push(salesOutstandingRes.reason?.message || 'Outstanding sales');
    }

    if (purchaseOutstandingRes.status === 'fulfilled' && purchaseOutstandingRes.value?.stats) {
      const p = purchaseOutstandingRes.value.stats;
      dashboard.outstandingPurchase = {
        count: p.outstanding_balance?.count ?? 0,
        value: p.outstanding_balance?.value ?? 0
      };
    } else if (purchaseOutstandingRes.status === 'rejected') {
      errors.push(purchaseOutstandingRes.reason?.message || 'Outstanding purchase');
    }

    if (errors.length > 0) {
      const summary = summarizeLoadErrors(
        errors,
        'Some dashboard figures could not be loaded.'
      )
      if (summary) this.updateState('error', summary)
    }

    this.updateState('dashboard', dashboard);
    this.updateState('loading', false);
  }
}
