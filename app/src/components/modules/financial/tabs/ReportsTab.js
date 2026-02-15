const { Row } = Liteframe
import { Button, Spinner } from '../../../utils/Button'
import { Input } from '../../../utils/Input'
import { SelectCompact, SelectOptions } from '../../../utils/Select'
import { formatDateDDMMYYYY } from '../../../utils/DateUtils'

const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const REPORT_TYPES = [
  { value: 'income-statement', label: 'Income Statement' },
  { value: 'balance-sheet', label: 'Balance Sheet' },
  { value: 'cash-flow', label: 'Cash Flow' },
  { value: 'equity', label: 'Statement of Changes in Equity' }
]

const REPORT_TYPE_LABELS = Object.fromEntries(REPORT_TYPES.map((t) => [t.value, t.label]))
const REPORT_LABEL_TO_VALUE = Object.fromEntries(REPORT_TYPES.map((t) => [t.label, t.value]))

export function ReportsTab(props) {
  const vm = props.viewModel
  const reportType = vm.getState('report-type') || 'income-statement'
  const dateFrom = vm.getState('report-date-from') || ''
  const dateTo = vm.getState('report-date-to') || ''
  const asOfDate = vm.getState('report-as-of-date') || ''
  const reportData = vm.getState('report-data')
  const reportLoading = vm.getState('report-loading') === true
  const error = vm.getState('error')

  const isPeriodReport = reportType !== 'balance-sheet'
  const today = new Date().toISOString().split('T')[0]
  const defaultAsOf = asOfDate || today

  return Row({ class: 'flex flex-col gap-1 flex-1 min-h-0 overflow-hidden border border-gray-200 rounded-lg bg-white' }, [
    // Toolbar: statement selector + period/as-of dates + Generate button
    Row({ class: 'flex flex-wrap items-center gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0' }, [
      Row({ class: 'flex items-center gap-2' }, [
        Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700 whitespace-nowrap' }, 'Report:'),
        SelectCompact({
          value: REPORT_TYPE_LABELS[reportType] || reportType,
          onChange: (e) => vm.setReportType(REPORT_LABEL_TO_VALUE[e.target.value] ?? reportType),
          containerClass: 'text-sm'
        }, SelectOptions({
          options: REPORT_TYPES.map((t) => t.label),
          selectedOption: REPORT_TYPE_LABELS[reportType] || reportType
        }))
      ]),
      isPeriodReport
        ? Row({ class: 'flex items-center gap-4' }, [
            Row({ class: 'flex items-center gap-2' }, [
              Row({ tagType: 'label', class: 'text-sm text-gray-500 whitespace-nowrap' }, 'From:'),
              Input({
                type: 'date',
                class: 'w-36 text-sm py-1.5',
                value: dateFrom,
                onChange: (e) => vm.setReportDateFrom(e.target.value)
              })
            ]),
            Row({ class: 'flex items-center gap-2' }, [
              Row({ tagType: 'label', class: 'text-sm text-gray-500 whitespace-nowrap' }, 'To:'),
              Input({
                type: 'date',
                class: 'w-36 text-sm py-1.5',
                value: dateTo,
                onChange: (e) => vm.setReportDateTo(e.target.value)
              })
            ])
          ])
        : Row({ class: 'flex items-center gap-2' }, [
            Row({ tagType: 'label', class: 'text-sm text-gray-500 whitespace-nowrap' }, 'As of:'),
            Input({
              type: 'date',
              class: 'w-36 text-sm py-1.5',
              value: defaultAsOf,
              onChange: (e) => vm.setReportAsOfDate(e.target.value)
            })
          ]),
      Button({
        variant: 'primary',
        onClick: () => vm.loadReport(),
        disabled: reportLoading || (isPeriodReport && (!dateFrom || !dateTo)) || (!isPeriodReport && !defaultAsOf),
        class: 'text-sm'
      }, reportLoading ? [Spinner({ class: 'w-4 h-4' }), ' Generating...'] : 'Generate Report')
    ]),
    error && Row({ class: 'text-sm text-red-600 bg-red-50 px-4 py-1.5 flex-shrink-0' }, error),
    // Report content
    Row({ class: 'flex-1 min-h-0 overflow-auto px-4 py-4' }, [
      reportLoading
        ? Row({ class: 'flex items-center gap-2 text-gray-500 py-8' }, [Spinner({ class: 'w-5 h-5' }), 'Loading report...'])
        : !reportData
          ? Row({ class: 'text-gray-500 text-sm py-8 text-center' }, 'Select a report type, set dates, and click "Generate Report".')
          : ReportContent({ reportType, reportData })
    ])
  ])
}

function ReportContent({ reportType, reportData }) {
  if (reportType === 'income-statement') return IncomeStatementView({ data: reportData })
  if (reportType === 'balance-sheet') return BalanceSheetView({ data: reportData })
  if (reportType === 'cash-flow') return CashFlowView({ data: reportData })
  if (reportType === 'equity') return EquityView({ data: reportData })
  return null
}

function IncomeStatementView({ data }) {
  const { period, revenue, expenses, net_income } = data || {}
  const revLines = revenue?.lines || []
  const expLines = expenses?.lines || []
  const totalRev = revenue?.total ?? 0
  const totalExp = expenses?.total ?? 0

  const sectionClass = 'mb-6'
  const sectionTitle = 'text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2'
  const lineClass = 'flex justify-between py-1 text-sm border-b border-gray-100'
  const lineLabel = 'text-gray-700'
  const lineAmount = 'text-gray-900 font-medium text-right tabular-nums'
  const totalClass = 'flex justify-between py-2 text-sm font-semibold border-t-2 border-gray-300 mt-1'

  return Row({ class: 'max-w-2xl' }, [
    period && Row({ class: 'text-sm text-gray-500 mb-4' }, [
      `Period: ${formatDateDDMMYYYY(period.date_from)} – ${formatDateDDMMYYYY(period.date_to)}`
    ]),
    Row({ class: sectionClass }, [
      Row({ class: sectionTitle }, 'Revenue'),
      ...revLines.map((l) =>
        Row({ key: l.account_code, class: lineClass }, [
          Row({ class: lineLabel }, `${l.account_code} ${l.account_name}`),
          Row({ class: lineAmount }, `Br ${financeFormat(l.amount)}`)
        ])
      ),
      revLines.length === 0 && Row({ class: lineClass }, [Row({ class: lineLabel }, 'No revenue'), Row({ class: lineAmount }, 'Br 0.00')]),
      Row({ class: totalClass }, [Row({ class: 'text-gray-900' }, 'Total Revenue'), Row({ class: lineAmount }, `Br ${financeFormat(totalRev)}`)])
    ]),
    Row({ class: sectionClass }, [
      Row({ class: sectionTitle }, 'Expenses'),
      ...expLines.map((l) =>
        Row({ key: l.account_code, class: lineClass }, [
          Row({ class: lineLabel }, `${l.account_code} ${l.account_name}`),
          Row({ class: lineAmount }, `Br ${financeFormat(l.amount)}`)
        ])
      ),
      expLines.length === 0 && Row({ class: lineClass }, [Row({ class: lineLabel }, 'No expenses'), Row({ class: lineAmount }, 'Br 0.00')]),
      Row({ class: totalClass }, [Row({ class: 'text-gray-900' }, 'Total Expenses'), Row({ class: lineAmount }, `Br ${financeFormat(totalExp)}`)])
    ]),
    Row({ class: 'flex justify-between py-3 text-base font-bold border-t-2 border-gray-400' }, [
      Row({ class: 'text-gray-900' }, 'Net Income'),
      Row({ class: `tabular-nums ${net_income >= 0 ? 'text-green-700' : 'text-red-700'}` }, `Br ${financeFormat(net_income)}`)
    ])
  ])
}

function BalanceSheetView({ data }) {
  const { as_of_date, assets, liabilities, equity, total_liabilities_equity } = data || {}
  const assetLines = assets?.lines || []
  const liabLines = liabilities?.lines || []
  const eqLines = equity?.lines || []
  const totalAssets = assets?.total ?? 0
  const totalLiab = liabilities?.total ?? 0
  const totalEq = equity?.total ?? 0

  const sectionClass = 'mb-6'
  const sectionTitle = 'text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2'
  const lineClass = 'flex justify-between py-1 text-sm border-b border-gray-100'
  const lineLabel = 'text-gray-700'
  const lineAmount = 'text-gray-900 font-medium text-right tabular-nums'
  const totalClass = 'flex justify-between py-2 text-sm font-semibold border-t-2 border-gray-300 mt-1'

  const renderSection = (title, lines, total) => [
    Row({ class: sectionTitle }, title),
    ...lines.map((l) =>
      Row({ key: l.account_code, class: lineClass }, [
        Row({ class: lineLabel }, `${l.account_code} ${l.account_name}`),
        Row({ class: lineAmount }, `Br ${financeFormat(l.balance)}`)
      ])
    ),
    lines.length === 0 && Row({ class: lineClass }, [Row({ class: lineLabel }, 'No accounts'), Row({ class: lineAmount }, 'Br 0.00')]),
    Row({ class: totalClass }, [Row({ class: 'text-gray-900' }, `Total ${title}`), Row({ class: lineAmount }, `Br ${financeFormat(total)}`)])
  ]

  return Row({ class: 'max-w-2xl' }, [
    as_of_date && Row({ class: 'text-sm text-gray-500 mb-4' }, [`As of: ${formatDateDDMMYYYY(as_of_date)}`]),
    Row({ class: sectionClass }, renderSection('Assets', assetLines, totalAssets)),
    Row({ class: sectionClass }, renderSection('Liabilities', liabLines, totalLiab)),
    Row({ class: sectionClass }, renderSection('Equity', eqLines, totalEq)),
    Row({ class: 'flex justify-between py-3 text-base font-bold border-t-2 border-gray-400' }, [
      Row({ class: 'text-gray-900' }, 'Total Liabilities & Equity'),
      Row({ class: 'tabular-nums text-gray-900' }, `Br ${financeFormat(total_liabilities_equity)}`)
    ])
  ])
}

function CashFlowView({ data }) {
  const { period, operating, opening_cash, closing_cash, net_change } = data || {}
  const { cash_received, cash_paid, net_cash_from_operating } = operating || {}

  const lineClass = 'flex justify-between py-1.5 text-sm border-b border-gray-100'
  const totalClass = 'flex justify-between py-2 text-sm font-semibold border-t-2 border-gray-300 mt-1'

  return Row({ class: 'max-w-2xl' }, [
    period && Row({ class: 'text-sm text-gray-500 mb-4' }, [
      `Period: ${formatDateDDMMYYYY(period.date_from)} – ${formatDateDDMMYYYY(period.date_to)}`
    ]),
    Row({ class: 'mb-4' }, [
      Row({ class: 'text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2' }, 'Operating Activities'),
      Row({ class: lineClass }, [Row({ class: 'text-gray-700' }, 'Cash received'), Row({ class: 'tabular-nums text-gray-900' }, `Br ${financeFormat(cash_received)}`)]),
      Row({ class: lineClass }, [Row({ class: 'text-gray-700' }, 'Cash paid'), Row({ class: 'tabular-nums text-gray-900' }, `Br ${financeFormat(cash_paid)}`)]),
      Row({ class: totalClass }, [Row({ class: 'text-gray-900' }, 'Net cash from operating'), Row({ class: 'tabular-nums text-gray-900' }, `Br ${financeFormat(net_cash_from_operating)}`)])
    ]),
    Row({ class: 'flex flex-col gap-1' }, [
      Row({ class: lineClass }, [Row({ class: 'text-gray-700' }, 'Opening cash balance'), Row({ class: 'tabular-nums text-gray-900' }, `Br ${financeFormat(opening_cash)}`)]),
      Row({ class: lineClass }, [Row({ class: 'text-gray-700' }, 'Net change'), Row({ class: 'tabular-nums text-gray-900' }, `Br ${financeFormat(net_change)}`)]),
      Row({ class: 'flex justify-between py-2 text-sm font-bold border-t-2 border-gray-400' }, [
        Row({ class: 'text-gray-900' }, 'Closing cash balance'),
        Row({ class: 'tabular-nums text-gray-900' }, `Br ${financeFormat(closing_cash)}`)
      ])
    ])
  ])
}

function EquityView({ data }) {
  const { period, lines, total_opening, total_changes, total_closing } = data || {}

  const sectionTitle = 'text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2'
  const lineClass = 'flex justify-between py-1 text-sm border-b border-gray-100'
  const totalClass = 'flex justify-between py-2 text-sm font-semibold border-t-2 border-gray-300 mt-1'

  return Row({ class: 'max-w-2xl' }, [
    period && Row({ class: 'text-sm text-gray-500 mb-4' }, [
      `Period: ${formatDateDDMMYYYY(period.date_from)} – ${formatDateDDMMYYYY(period.date_to)}`
    ]),
    Row({ class: 'mb-4' }, [
      Row({ class: sectionTitle }, 'Equity movement by account'),
      Row({ class: 'grid grid-cols-4 gap-4 py-1 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200' }, [
        Row({ class: 'col-span-1' }, 'Account'),
        Row({ class: 'text-right' }, 'Opening Balance'),
        Row({ class: 'text-right' }, 'Period Changes'),
        Row({ class: 'text-right' }, 'Closing Balance')
      ]),
      ...(lines || []).map((l) =>
        Row({ key: l.account_code, class: 'grid grid-cols-4 gap-4 py-1 text-sm border-b border-gray-100' }, [
          Row({ class: 'text-gray-700 col-span-1' }, `${l.account_code} ${l.account_name}`),
          Row({ class: 'text-gray-900 tabular-nums text-right' }, `Br ${financeFormat(l.opening_balance)}`),
          Row({ class: 'text-gray-900 tabular-nums text-right' }, `Br ${financeFormat(l.changes)}`),
          Row({ class: 'text-gray-900 tabular-nums text-right font-medium' }, `Br ${financeFormat(l.closing_balance)}`)
        ])
      ),
      lines?.length > 0 && Row({ class: 'grid grid-cols-4 gap-4 py-2 text-sm font-semibold border-t-2 border-gray-300 mt-1' }, [
        Row({ class: 'col-span-1 text-gray-900' }, 'Total'),
        Row({ class: 'tabular-nums text-right' }, `Br ${financeFormat(total_opening)}`),
        Row({ class: 'tabular-nums text-right' }, `Br ${financeFormat(total_changes)}`),
        Row({ class: 'tabular-nums text-right' }, `Br ${financeFormat(total_closing)}`)
      ])
    ])
  ])
}
