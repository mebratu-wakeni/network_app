/**
 * Dashboard configuration: operational metrics, module cards, quick actions,
 * and chart placeholders. Used by DashboardUI for config-driven rendering.
 */

/** Section titles. */
export const SECTION_TITLES = {
  today: "Today's activity",
  week: 'This week',
  holds: 'Hold orders',
  modules: 'Module overview',
  quickActions: 'Quick actions',
  charts: 'Charts & trends'
};

/** Today's activity cards: id, title, icon, iconColor, primaryLabel, route. */
export const TODAY_CARDS = [
  {
    id: 'sales-today',
    title: "Today's sales",
    icon: 'pricetag-outline',
    iconColor: 'bg-emerald-50 text-emerald-600',
    primaryLabel: 'Value',
    secondaryLabel: 'Orders',
    route: '/sales'
  },
  {
    id: 'purchase-today',
    title: "Today's purchases",
    icon: 'cart-outline',
    iconColor: 'bg-blue-50 text-blue-600',
    primaryLabel: 'Value',
    secondaryLabel: 'Orders',
    route: '/purchase'
  }
];

/** This week cards. */
export const WEEK_CARDS = [
  {
    id: 'sales-week',
    title: "This week's sales",
    icon: 'trending-up-outline',
    iconColor: 'bg-teal-50 text-teal-600',
    primaryLabel: 'Value',
    secondaryLabel: 'Orders',
    route: '/sales'
  },
  {
    id: 'purchase-week',
    title: "This week's purchases",
    icon: 'cart-outline',
    iconColor: 'bg-blue-50 text-blue-600',
    primaryLabel: 'Value',
    secondaryLabel: 'Orders',
    route: '/purchase'
  }
];

/** Hold orders card (sales + purchase counts). */
export const HOLDS_CARD = {
  id: 'holds',
  title: 'Hold orders',
  icon: 'hourglass-outline',
  iconColor: 'bg-amber-50 text-amber-600',
  primaryLabel: 'Sales',
  secondaryLabel: 'Purchases',
  route: null
};

/** Module cards: id, title, icon, iconColor, primaryLabel, secondaryLabel, viewLabel, route. */
export const MODULE_CARDS = [
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
    iconColor: 'bg-indigo-50 text-indigo-600',
    primaryLabel: 'Total customers',
    secondaryLabel: null,
    viewLabel: 'View Customers',
    route: '/customers'
  },
  {
    id: 'outstanding-sales',
    title: 'Outstanding sales',
    icon: 'wallet-outline',
    iconColor: 'bg-rose-50 text-rose-600',
    primaryLabel: 'Amount due',
    secondaryLabel: 'Orders',
    viewLabel: 'View Sales',
    route: '/sales'
  },
  {
    id: 'outstanding-purchase',
    title: 'Outstanding purchases',
    icon: 'card-outline',
    iconColor: 'bg-orange-50 text-orange-600',
    primaryLabel: 'Amount owing',
    secondaryLabel: 'Orders',
    viewLabel: 'View Purchase',
    route: '/purchase'
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
