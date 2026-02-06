const { Row, StatefulRow } = Liteframe;
import { Card, CardBody, CardHeader } from '../utils/Card';
import { Button } from '../utils/Button';
import { IonIcon } from '../utils/Icon';
import { DashboardVM } from './DashboardVM';
import {
  LEDGER_ACCOUNT_CODES,
  LEDGER_ACCOUNT_META,
  WORKING_CAPITAL_META,
  GROSS_PROFIT_META,
  CURRENT_ASSET_CODES,
  CURRENT_LIABILITY_CODES,
  SECTION_TITLES,
  MODULE_CARDS,
  QUICK_ACTIONS,
  CHART_PLACEHOLDERS
} from './dashboardConfig.js';
import { formatCurrency, formatBalance, formatCount, workingCapitalFromLedger, grossProfitFromLedger } from './dashboardFormatters.js';

const CARD_HEADER_CLASS = 'flex flex-row items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/50';
const CARD_TITLE_CLASS = 'text-base font-semibold text-gray-800 whitespace-nowrap';

function KPICard({ title, titleAbbr, titleFullName, icon, iconColor, primaryLabel, primaryValue, secondaryLabel, secondaryValue, viewLabel, onViewClick }) {
  const hasAbbr = titleAbbr != null && titleFullName != null;
  const headerTitle = hasAbbr
    ? Row({ class: 'flex flex-col gap-0.5' }, [
        Row({ class: `${CARD_TITLE_CLASS} leading-tight` }, titleAbbr),
        Row({ class: 'text-xs font-normal text-gray-500 leading-tight' }, titleFullName)
      ])
    : Row({ class: CARD_TITLE_CLASS }, title ?? titleAbbr ?? '');
  return Card(
    {
      class: 'flex flex-col border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow',
      role: 'article'
    },
    [
      CardHeader({ class: CARD_HEADER_CLASS }, [
        Row({ class: `p-2 rounded-lg ${iconColor || 'bg-blue-50 text-blue-600'}` }, [IonIcon({ name: icon, class: 'text-2xl' })]),
        headerTitle
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

function getModulePrimaryValue(dashboard, id) {
  switch (id) {
    case 'sales':
      return dashboard.sales ? formatCurrency(dashboard.sales.totalValue) : '—';
    case 'purchase':
      return dashboard.purchase ? formatCurrency(dashboard.purchase.totalValue) : '—';
    case 'inventory':
      return dashboard.inventory?.total != null ? formatCount(dashboard.inventory.total) : '—';
    case 'customers':
      return dashboard.customers?.total != null ? formatCount(dashboard.customers.total) : '—';
    default:
      return '—';
  }
}

function getModuleSecondaryValue(dashboard, id) {
  switch (id) {
    case 'sales':
      return dashboard.sales?.outstanding != null ? formatCurrency(dashboard.sales.outstanding) : null;
    case 'purchase':
      return dashboard.purchase?.outstanding != null ? formatCurrency(dashboard.purchase.outstanding) : null;
    case 'inventory': {
      const inv = dashboard.inventory;
      if (!inv || (inv.outOfStock === 0 && inv.lowStock === 0 && inv.expiringSoon === 0)) return null;
      const parts = [];
      if (inv.outOfStock > 0) parts.push(`${inv.outOfStock} out of stock`);
      if (inv.lowStock > 0) parts.push(`${inv.lowStock} low`);
      if (inv.expiringSoon > 0) parts.push(`${inv.expiringSoon} expiring soon`);
      return parts.join(' · ');
    }
    case 'customers':
      return null;
    default:
      return null;
  }
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
      CardBody(
        { class: 'flex-1 flex items-center justify-center min-h-[200px] text-gray-400 text-sm' },
        description
      )
    ]
  );
}

export function DashboardUI(props) {
  const router = props?.router || null;
  const viewModel = new DashboardVM();

  const navigate = (route) => {
    if (router && typeof router.navigate === 'function') router.navigate(route);
  };

  const render = (p) => {
    const vm = p.viewModel;
    const dashboard = vm.getDashboard();
    const loading = vm.getState('loading');
    const error = vm.getState('error');

    const isEmpty =
      dashboard.ledger == null &&
      !dashboard.sales &&
      !dashboard.purchase &&
      !dashboard.inventory &&
      !dashboard.customers;
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
          Row({ class: 'text-sm text-gray-500' }, 'Summary of your business across all modules')
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

        dashboard.ledger != null
          ? Row(
              {
                class: 'flex flex-col gap-2',
                role: 'region',
                'aria-label': SECTION_TITLES.financial
              },
              [
                Row({ class: 'text-sm font-semibold text-gray-700' }, SECTION_TITLES.financial),
                Row(
                  { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4' },
                  [
                    ...LEDGER_ACCOUNT_CODES.map((code) => {
                      const meta = LEDGER_ACCOUNT_META[code] || { abbr: code, fullName: code, icon: 'ellipse-outline', iconColor: 'bg-gray-50 text-gray-600' };
                      return KPICard({
                        titleAbbr: meta.abbr,
                        titleFullName: meta.fullName,
                        icon: meta.icon,
                        iconColor: meta.iconColor,
                        primaryLabel: 'Current balance',
                        primaryValue: formatBalance(dashboard.ledger[code], code),
                        secondaryLabel: null,
                        secondaryValue: null,
                        viewLabel: null,
                        onViewClick: null
                      });
                    }),
                    KPICard({
                      titleAbbr: WORKING_CAPITAL_META.abbr,
                      titleFullName: WORKING_CAPITAL_META.fullName,
                      icon: WORKING_CAPITAL_META.icon,
                      iconColor: WORKING_CAPITAL_META.iconColor,
                      primaryLabel: WORKING_CAPITAL_META.primaryLabel,
                      primaryValue: (() => {
                        const wc = workingCapitalFromLedger(dashboard.ledger, CURRENT_ASSET_CODES, CURRENT_LIABILITY_CODES);
                        return wc != null ? formatBalance(wc) : '—';
                      })(),
                      secondaryLabel: null,
                      secondaryValue: null,
                      viewLabel: null,
                      onViewClick: null
                    }),
                    KPICard({
                      titleAbbr: GROSS_PROFIT_META.abbr,
                      titleFullName: GROSS_PROFIT_META.fullName,
                      icon: GROSS_PROFIT_META.icon,
                      iconColor: GROSS_PROFIT_META.iconColor,
                      primaryLabel: GROSS_PROFIT_META.primaryLabel,
                      primaryValue: (() => {
                        const gp = grossProfitFromLedger(dashboard.ledger);
                        return gp != null ? formatBalance(gp) : '—';
                      })(),
                      secondaryLabel: null,
                      secondaryValue: null,
                      viewLabel: null,
                      onViewClick: null
                    })
                  ]
                )
              ]
            )
          : null,

        Row(
          {
            class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
            role: 'region',
            'aria-label': SECTION_TITLES.modules
          },
          MODULE_CARDS.map((card) =>
            KPICard({
              title: card.title,
              icon: card.icon,
              iconColor: card.iconColor,
              primaryLabel: card.primaryLabel,
              primaryValue: getModulePrimaryValue(dashboard, card.id),
              secondaryLabel: card.secondaryLabel,
              secondaryValue: getModuleSecondaryValue(dashboard, card.id),
              viewLabel: card.viewLabel,
              onViewClick: () => navigate(card.route)
            })
          )
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
