/**
 * Dashboard configuration: single source of truth for account codes, labels, icons,
 * module cards, quick actions, and chart placeholders. Used by DashboardUI for
 * config-driven rendering.
 */

/** Ledger account codes shown in financial overview (order preserved). */
export const LEDGER_ACCOUNT_CODES = ['5100', '1300', '6100', '3100', '1200'];

/** Metadata per ledger account: abbr (card header), fullName (subtitle), icon, iconColor. */
export const LEDGER_ACCOUNT_META = {
  '5100': { abbr: 'SR', fullName: 'Sales Revenue', icon: 'trending-up-outline', iconColor: 'bg-emerald-50 text-emerald-600' },
  '1300': { abbr: 'Inv', fullName: 'Inventory', icon: 'layers-outline', iconColor: 'bg-violet-50 text-violet-600' },
  '6100': { abbr: 'COGS', fullName: 'Cost of Goods Sold', icon: 'receipt-outline', iconColor: 'bg-orange-50 text-orange-600' },
  '3100': { abbr: 'AP', fullName: 'Accounts Payable', icon: 'card-outline', iconColor: 'bg-rose-50 text-rose-600' },
  '1200': { abbr: 'AR', fullName: 'Accounts Receivable', icon: 'wallet-outline', iconColor: 'bg-blue-50 text-blue-600' }
};

/** Working capital = current assets (cash, stock, receivables) − current liabilities (payables, etc.). */
export const WORKING_CAPITAL_META = {
  abbr: 'WC',
  fullName: 'Working capital',
  icon: 'briefcase-outline',
  iconColor: 'bg-teal-50 text-teal-600',
  primaryLabel: 'Current assets − Current liabilities'
};

/** Gross profit = Revenue − COGS (income statement). */
export const GROSS_PROFIT_META = {
  abbr: 'GP',
  fullName: 'Gross profit',
  icon: 'calculator-outline',
  iconColor: 'bg-indigo-50 text-indigo-600',
  primaryLabel: 'Revenue − COGS'
};

/** Current asset account codes (ledger balance positive = debit balance). */
export const CURRENT_ASSET_CODES = ['1100', '1200', '1250', '1300', '1400'];

/** Current liability account codes (ledger balance negative = credit balance). */
export const CURRENT_LIABILITY_CODES = ['3100', '3200', '3210', '3300'];

/** Section titles. */
export const SECTION_TITLES = {
  financial: 'Financial overview (from ledger)',
  modules: 'Module overview',
  quickActions: 'Quick actions',
  charts: 'Charts & trends'
};

/** Module cards: id, title, icon, iconColor, primaryLabel, secondaryLabel, viewLabel, route. */
export const MODULE_CARDS = [
  {
    id: 'sales',
    title: 'Sales',
    icon: 'pricetag-outline',
    iconColor: 'bg-emerald-50 text-emerald-600',
    primaryLabel: 'Total sales value',
    secondaryLabel: 'Outstanding',
    viewLabel: 'View Sales',
    route: '/sales'
  },
  {
    id: 'purchase',
    title: 'Purchase',
    icon: 'cart-outline',
    iconColor: 'bg-blue-50 text-blue-600',
    primaryLabel: 'Total orders value',
    secondaryLabel: 'Outstanding',
    viewLabel: 'View Purchase',
    route: '/purchase'
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: 'layers-outline',
    iconColor: 'bg-violet-50 text-violet-600',
    primaryLabel: 'Stock items',
    secondaryLabel: 'Alerts',
    viewLabel: 'View Inventory',
    route: '/inventory'
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: 'business-outline',
    iconColor: 'bg-amber-50 text-amber-600',
    primaryLabel: 'Total customers',
    secondaryLabel: null,
    viewLabel: 'View Customers',
    route: '/customers'
  }
];

/** Quick action buttons: label, route, variant. */
export const QUICK_ACTIONS = [
  { label: 'New Sale', route: '/sales', variant: 'primary' },
  { label: 'New Purchase', route: '/purchase', variant: 'outline' },
  { label: 'View Stock', route: '/inventory', variant: 'outline' },
  { label: 'Customers', route: '/customers', variant: 'outline' }
];

/** Chart placeholder cards (future implementation). */
export const CHART_PLACEHOLDERS = [
  {
    id: 'trends',
    title: 'Sales & Purchase trends',
    icon: 'stats-chart-outline',
    iconColor: 'bg-sky-50 text-sky-600',
    description: 'Line or bar chart of sales and purchase over time — to be implemented'
  },
  {
    id: 'expenses',
    title: 'Expenses by category',
    icon: 'pie-chart-outline',
    iconColor: 'bg-amber-50 text-amber-600',
    description: 'Pie chart — Expenses module to be implemented'
  }
];
