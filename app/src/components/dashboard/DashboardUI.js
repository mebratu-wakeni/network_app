const { Row, StatefulRow } = Liteframe;
import { Card, CardBody, CardHeader } from '../utils/Card';
import { Button } from '../utils/Button';
import { IonIcon } from '../utils/Icon';
import { DashboardVM } from './DashboardVM';
import {
  SECTION_TITLES,
  TODAY_CARDS,
  WEEK_CARDS,
  HOLDS_CARD,
  MODULE_CARDS,
  QUICK_ACTIONS,
  CHART_PLACEHOLDERS
} from './dashboardConfig.js';
import { formatCurrency, formatCount } from './dashboardFormatters.js';
import { today, weekBounds } from '../utils/DateUtils.js';

const CARD_HEADER_CLASS = 'flex flex-row items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/50';
const CARD_TITLE_CLASS = 'text-base font-semibold text-gray-800 whitespace-nowrap';

function KPICard({ title, icon, iconColor, primaryLabel, primaryValue, secondaryLabel, secondaryValue, viewLabel, onViewClick }) {
  return Card(
    {
      class: 'flex flex-col border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow',
      role: 'article'
    },
    [
      CardHeader({ class: CARD_HEADER_CLASS }, [
        Row({ class: `p-2 rounded-lg ${iconColor || 'bg-blue-50 text-blue-600'}` }, [IonIcon({ name: icon, class: 'text-2xl' })]),
        Row({ class: CARD_TITLE_CLASS }, title ?? '')
      ]),
      CardBody(
        { class: 'flex flex-col flex-1 p-5' },
        [
          Row({ class: 'mb-1 text-xs font-medium uppercase tracking-wide text-gray-500' }, primaryLabel),
          Row({ class: 'text-lg font-semibold text-gray-900 mb-3' }, primaryValue),
          secondaryLabel != null
            ? Row(
                { class: 'mt-auto text-sm text-gray-500' },
                secondaryLabel + (secondaryValue != null ? `: ${secondaryValue}` : '')
              )
            : null,
          onViewClick
            ? Row({ class: 'mt-4' }, [
                Button({ variant: 'outline', class: 'text-sm', onClick: onViewClick }, viewLabel || 'View')
              ])
            : null
        ].filter(Boolean)
      )
    ]
  );
}

function ChartPlaceholderCard({ title, icon, iconColor, description }) {
  return Card(
    {
      class: 'flex flex-col border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden border-dashed',
      role: 'article'
    },
    [
      CardHeader({ class: CARD_HEADER_CLASS }, [
        Row({ class: `p-2 rounded-lg ${iconColor}` }, [IonIcon({ name: icon, class: 'text-2xl' })]),
        Row({ class: CARD_TITLE_CLASS }, title)
      ]),
      CardBody({ class: 'flex-1 flex items-center justify-center min-h-[200px] text-gray-400 text-sm' }, description)
    ]
  );
}

function getCardData(dashboard, cardId) {
  switch (cardId) {
    case 'sales-today':
      return dashboard.salesToday
        ? { primary: formatCurrency(dashboard.salesToday.value), secondary: formatCount(dashboard.salesToday.count) }
        : { primary: '—', secondary: '—' };
    case 'purchase-today':
      return dashboard.purchaseToday
        ? { primary: formatCurrency(dashboard.purchaseToday.value), secondary: formatCount(dashboard.purchaseToday.count) }
        : { primary: '—', secondary: '—' };
    case 'sales-week':
      return dashboard.salesWeek
        ? { primary: formatCurrency(dashboard.salesWeek.value), secondary: formatCount(dashboard.salesWeek.count) }
        : { primary: '—', secondary: '—' };
    case 'purchase-week':
      return dashboard.purchaseWeek
        ? { primary: formatCurrency(dashboard.purchaseWeek.value), secondary: formatCount(dashboard.purchaseWeek.count) }
        : { primary: '—', secondary: '—' };
    case 'holds':
      return {
        primary: String(dashboard.holdOrdersSales ?? 0),
        secondary: String(dashboard.holdOrdersPurchase ?? 0)
      };
    case 'inventory':
      return {
        primary: dashboard.inventory?.total != null ? formatCount(dashboard.inventory.total) : '—',
        secondary: (() => {
          const inv = dashboard.inventory;
          if (!inv || (inv.outOfStock === 0 && inv.lowStock === 0 && inv.expiringSoon === 0)) return null;
          const parts = [];
          if (inv.outOfStock > 0) parts.push(`${inv.outOfStock} out of stock`);
          if (inv.lowStock > 0) parts.push(`${inv.lowStock} low`);
          if (inv.expiringSoon > 0) parts.push(`${inv.expiringSoon} expiring soon`);
          return parts.join(' · ');
        })()
      };
    case 'customers':
      return {
        primary: dashboard.customers?.total != null ? formatCount(dashboard.customers.total) : '—',
        secondary: null
      };
    case 'outstanding-sales':
      return dashboard.outstandingSales
        ? {
            primary: formatCurrency(dashboard.outstandingSales.value),
            secondary: formatCount(dashboard.outstandingSales.count)
          }
        : { primary: '—', secondary: null };
    case 'outstanding-purchase':
      return dashboard.outstandingPurchase
        ? {
            primary: formatCurrency(dashboard.outstandingPurchase.value),
            secondary: formatCount(dashboard.outstandingPurchase.count)
          }
        : { primary: '—', secondary: null };
    default:
      return { primary: '—', secondary: null };
  }
}

export function DashboardUI(props) {
  const router = props?.router || null;
  const navigationVM = props?.navigationVM || null;
  const viewModel = new DashboardVM();

  const navigate = (route, filter) => {
    if (route === '/sales' && filter && navigationVM) {
      navigationVM.updateState('pending-sales-filter', filter);
      navigationVM.updateState('active-menu', 'Sales');
    } else if (route === '/purchase' && filter && navigationVM) {
      navigationVM.updateState('pending-purchase-filter', filter);
      navigationVM.updateState('active-menu', 'Purchase');
    }
    if (router && typeof router.navigate === 'function') router.navigate(route);
  };

  const render = (p) => {
    const vm = p.viewModel;
    const dashboard = vm.getDashboard();
    const loading = vm.getState('loading');
    const error = vm.getState('error');

    const t = today();
    const { from: weekFrom, to: weekTo } = weekBounds();

    const isEmpty =
      dashboard.salesToday == null &&
      dashboard.salesWeek == null &&
      dashboard.purchaseToday == null &&
      dashboard.purchaseWeek == null &&
      dashboard.holdOrdersSales == null &&
      dashboard.holdOrdersPurchase == null &&
      !dashboard.inventory &&
      !dashboard.customers &&
      !dashboard.outstandingSales &&
      !dashboard.outstandingPurchase;
    if (!loading && isEmpty) vm.loadDashboard();

    if (loading && isEmpty) {
      return Row(
        {
          class: 'w-full h-full flex items-center justify-center p-12',
          role: 'status',
          'aria-live': 'polite'
        },
        Row({ class: 'text-gray-500' }, 'Loading dashboard…')
      );
    }

    return Row({ class: 'w-full h-full overflow-auto', role: 'main' }, [
      Row({ class: 'flex flex-col gap-6 p-6 w-full' }, [
        Row({ class: 'flex flex-col gap-1', role: 'banner' }, [
          Row({ tagType: 'h1', class: 'text-2xl font-bold text-gray-900' }, 'Dashboard'),
          Row({ class: 'text-sm text-gray-500' }, 'Operational summary of your business')
        ]),

        error
          ? Row(
              {
                class: 'rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800',
                role: 'alert'
              },
              error
            )
          : null,

        Row(
          {
            class: 'flex flex-col gap-2',
            role: 'region',
            'aria-label': SECTION_TITLES.today
          },
          [
            Row({ class: 'text-sm font-semibold text-gray-700' }, SECTION_TITLES.today),
            Row(
              { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
              TODAY_CARDS.map((card) => {
                const data = getCardData(dashboard, card.id);
                const todayFilter = { date_from: t, date_to: t };
                return KPICard({
                  title: card.title,
                  icon: card.icon,
                  iconColor: card.iconColor,
                  primaryLabel: card.primaryLabel,
                  primaryValue: data.primary,
                  secondaryLabel: card.secondaryLabel,
                  secondaryValue: data.secondary,
                  viewLabel: 'View',
                  onViewClick: card.route ? () => navigate(card.route, todayFilter) : null
                });
              })
            )
          ]
        ),

        Row(
          {
            class: 'flex flex-col gap-2',
            role: 'region',
            'aria-label': SECTION_TITLES.week
          },
          [
            Row({ class: 'text-sm font-semibold text-gray-700' }, SECTION_TITLES.week),
            Row(
              { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
              WEEK_CARDS.map((card) => {
                const data = getCardData(dashboard, card.id);
                const weekFilter = { date_from: weekFrom, date_to: weekTo };
                return KPICard({
                  title: card.title,
                  icon: card.icon,
                  iconColor: card.iconColor,
                  primaryLabel: card.primaryLabel,
                  primaryValue: data.primary,
                  secondaryLabel: card.secondaryLabel,
                  secondaryValue: data.secondary,
                  viewLabel: 'View',
                  onViewClick: card.route ? () => navigate(card.route, weekFilter) : null
                });
              })
            )
          ]
        ),

        Row(
          {
            class: 'flex flex-col gap-2',
            role: 'region',
            'aria-label': SECTION_TITLES.holds
          },
          [
            Row({ class: 'text-sm font-semibold text-gray-700' }, SECTION_TITLES.holds),
            Row(
              { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4' },
              [HOLDS_CARD].map((card) => {
                const data = getCardData(dashboard, card.id);
                return KPICard({
                  title: card.title,
                  icon: card.icon,
                  iconColor: card.iconColor,
                  primaryLabel: card.primaryLabel,
                  primaryValue: data.primary,
                  secondaryLabel: card.secondaryLabel,
                  secondaryValue: data.secondary,
                  viewLabel: null,
                  onViewClick: null
                });
              })
            )
          ]
        ),

        Row(
          {
            class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
            role: 'region',
            'aria-label': SECTION_TITLES.modules
          },
          MODULE_CARDS.map((card) => {
            const data = getCardData(dashboard, card.id);
            return KPICard({
              title: card.title,
              icon: card.icon,
              iconColor: card.iconColor,
              primaryLabel: card.primaryLabel,
              primaryValue: data.primary,
              secondaryLabel: card.secondaryLabel,
              secondaryValue: data.secondary,
              viewLabel: card.viewLabel,
              onViewClick: () => navigate(card.route)
            });
          })
        ),

        Row(
          {
            class: 'flex flex-wrap gap-2 pt-2',
            role: 'region',
            'aria-label': SECTION_TITLES.quickActions
          },
          QUICK_ACTIONS.map((action) =>
            Button(
              {
                variant: action.variant,
                class: 'text-sm',
                onClick: () => navigate(action.route)
              },
              action.label
            )
          )
        ),

        Row(
          {
            class: 'flex flex-col gap-2 mt-2',
            role: 'region',
            'aria-label': SECTION_TITLES.charts
          },
          [
            Row({ class: 'text-sm font-semibold text-gray-700' }, SECTION_TITLES.charts),
            Row(
              { class: 'grid grid-cols-1 lg:grid-cols-2 gap-4' },
              CHART_PLACEHOLDERS.map((chart) =>
                ChartPlaceholderCard({
                  title: chart.title,
                  icon: chart.icon,
                  iconColor: chart.iconColor,
                  description: chart.description
                })
              )
            )
          ]
        )
      ])
    ]);
  };

  return StatefulRow(
    {
      class: 'w-full h-full min-h-0',
      viewModel,
      stateKeys: ['loading', 'dashboard', 'error']
    },
    render
  );
}
