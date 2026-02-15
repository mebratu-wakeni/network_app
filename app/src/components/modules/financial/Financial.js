import { CardBody, CardHeader } from '../../utils/Card'
import { FinancialVM } from './FinancialVM'
import { ExpenseTab } from './tabs/ExpenseTab'
import { DepositsTab } from './tabs/DepositsTab'
import { ReceivablesTab } from './tabs/ReceivablesTab'
import { PayablesTab } from './tabs/PayablesTab'
import { ReportsTab } from './tabs/ReportsTab'
import { Button } from '../../utils/Button'

const { Row, StatefulRow } = Liteframe

const TAB_OPTIONS = [
  { key: 'expense', label: 'Expense', icon: 'cash-outline' },
  { key: 'deposits', label: 'Deposits', icon: 'wallet-outline' },
  { key: 'receivables', label: 'Receivables', icon: 'arrow-down-circle-outline' },
  { key: 'payables', label: 'Payables', icon: 'arrow-up-circle-outline' },
  { key: 'reports', label: 'Reports', icon: 'document-text-outline' }
]

export function FinancialUI(props = {}) {
  const { router, navigationVM } = props
  const viewModel = new FinancialVM()

  const render = (renderProps) => {
    const mergedProps = { ...renderProps, router, navigationVM }
    const activeTab = mergedProps.viewModel.getActiveTab()

    return Row({ class: 'w-full h-full flex flex-col overflow-hidden' }, [
      CardHeader({
        class: 'px-6 py-2 text-gray-900 text-md font-semibold flex items-center justify-between flex-shrink-0'
      }, [
        'Financial Management',
        Row({ class: 'flex gap-2' }, [
          ...TAB_OPTIONS.map((opt) =>
            Button({
              variant: activeTab === opt.key ? 'primary' : 'outline',
              class: 'w-35 flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition',
              onClick: () => mergedProps.viewModel.setActiveTab(opt.key)
            }, [
              Row({ tagType: 'ion-icon', attributes: { name: opt.icon, class: 'text-lg' } }),
              opt.label
            ])
          ),
        ]),
      ]),
      CardBody({ class: 'flex flex-col overflow-hidden flex-1 min-h-0' }, [
        
        activeTab === 'expense' && ExpenseTab(mergedProps),
        activeTab === 'deposits' && DepositsTab(mergedProps),
        activeTab === 'receivables' && ReceivablesTab(mergedProps),
        activeTab === 'payables' && PayablesTab(mergedProps),
        activeTab === 'reports' && ReportsTab(mergedProps)
      ])
    ])
  }

  return StatefulRow({
    class: 'w-full h-full overflow-hidden',
    viewModel,
    stateKeys: ['loading', 'active-tab', 'expense-form', 'expense-customer-list', 'expenses', 'expense-total', 'expense-table-config', 'expense-search', 'expense-category-filter', 'selected-expense', 'expense-drawer-open', 'error', 'deposits', 'deposit-total', 'deposit-stats', 'deposit-table-config', 'deposit-search', 'deposit-type-filter', 'deposit-date-from', 'deposit-date-to', 'deposit-stats-collapsed', 'drawer-deposit-id', 'show-deposit-drawer', 'selected-deposit', 'deposit-form', 'create-deposit-modal-open', 'create-deposit-submitting', 'edit-deposit-modal-open', 'editing-deposit', 'trade-receivables', 'trade-receivables-table-config', 'trade-search', 'loans-receivable', 'loans-receivable-table-config', 'loans-search', 'loans-status-filter', 'loan-form', 'loan-customer-list', 'create-loan-modal-open', 'create-loan-submitting', 'create-loan-cash-balance', 'withhold-receivables', 'withhold-receivables-table-config', 'withhold-search', 'withhold-status-filter', 'withhold-date-from', 'withhold-date-to', 'withhold-settlement-modal-open', 'withhold-settlement-submitting', 'withhold-selected-orders', 'trade-payables', 'trade-payables-table-config', 'trade-payables-search', 'loans-payable', 'loans-payable-table-config', 'loans-payable-search', 'loans-payable-status-filter', 'loan-payable-form', 'loan-payable-customer-list', 'create-loan-payable-modal-open', 'withhold-payables', 'withhold-payables-table-config', 'withhold-payables-search', 'withhold-payables-status-filter', 'withhold-payables-date-from', 'withhold-payables-date-to', 'withhold-payables-settlement-modal-open', 'withhold-payables-settlement-submitting', 'withhold-payables-selected-orders', 'report-type', 'report-date-from', 'report-date-to', 'report-as-of-date', 'report-data', 'report-loading']
  }, render)
}
