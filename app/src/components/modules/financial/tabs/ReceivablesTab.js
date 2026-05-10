const { Row } = Liteframe
import { Spinner, Button } from '../../../utils/Button'
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table'

import { Input } from '../../../utils/Input'
import { SelectRelative, SelectOptions, SelectFluid, SelectCompact } from '../../../utils/Select'
import { IonIcon, IconButton } from '../../../utils/Icon'
import { ActionDropdown, ActionItem } from '../../../utils/Action'
import { formatDateDDMMYYYY } from '../../../utils/DateUtils'
import Modal from '../../../shared/Modal'
import { showAlert } from '../../../utils/ModalHelpers'
import { DropdownSearch, DropdownSearchItem } from '../../../utils/DropdownSearch'
import Drawer from '../../../shared/ExampleDrawer'
import { Card, CardBody, CardHeader, CardFooter } from '../../../utils/Card'
import Badge from '../../../utils/Badge'

const DRAWER_CLOSE_MS = 350
const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function capitalizeCustomerType(type) {
  if (!type) return 'Partner'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function getCustomerTypeBadgeColor(type) {
  if (type === 'supplier') return 'info'
  if (type === 'retailer') return 'success'
  if (type === 'both') return 'warning'
  return 'default'
}

function getLoanStatusBadge(status) {
  const s = (status || 'active').toLowerCase()
  if (s === 'returned') return { label: 'Returned', tone: 'success' }
  if (s === 'partially_returned') return { label: 'Partially Returned', tone: 'warning' }
  return { label: 'Active', tone: 'info' }
}

function filterAndSortLoans(loans, search, sortBy, orderBy) {
  let list = [...(loans || [])]
  const searchLower = (search || '').trim().toLowerCase()
  if (searchLower) {
    list = list.filter((l) => {
      const ref = (l.reference_no || '').toLowerCase()
      const partner = (l.partner_name || '').toLowerCase()
      const dateStr = formatDateDDMMYYYY(l.lent_date) || ''
      const dueStr = formatDateDDMMYYYY(l.expected_return_date) || ''
      const amtStr = financeFormat(l.amount)
      const status = (l.status || '').toLowerCase()
      return `${ref} ${partner} ${dateStr} ${dueStr} ${amtStr} ${status}`.includes(searchLower)
    })
  }
  const by = sortBy || 'lent_date'
  const dir = orderBy === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let cmp = 0
    const oa = Math.max(0, Number(a.amount || 0) - Number(a.returned_amount || 0))
    const ob = Math.max(0, Number(b.amount || 0) - Number(b.returned_amount || 0))
    if (by === 'lent_date') cmp = new Date(a.lent_date || 0) - new Date(b.lent_date || 0)
    else if (by === 'expected_return_date') cmp = new Date(a.expected_return_date || 0) - new Date(b.expected_return_date || 0)
    else if (by === 'partner_name') cmp = (a.partner_name || '').localeCompare(b.partner_name || '')
    else if (by === 'reference_no') cmp = (a.reference_no || '').localeCompare(b.reference_no || '')
    else if (by === 'outstanding') cmp = oa - ob
    else if (by === 'status') cmp = (a.status || '').localeCompare(b.status || '')
    return cmp * dir
  })
  return list
}

function filterAndSortTradeOrders(orders, search, sortBy, orderBy) {
  let list = [...(orders || [])]
  const searchLower = (search || '').trim().toLowerCase()
  if (searchLower) {
    list = list.filter((o) => {
      const receipt = (o.receipt_no || '').toLowerCase()
      const customer = (o.customer_name || '').toLowerCase()
      const dateStr = formatDateDDMMYYYY(o.order_date) || ''
      const payment = (o.payment_type || '').toLowerCase()
      const amountStr = financeFormat(o.outstanding_balance)
      return `${receipt} ${customer} ${dateStr} ${payment} ${amountStr}`.includes(searchLower)
    })
  }
  const by = sortBy || 'order_date'
  const dir = orderBy === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let cmp = 0
    if (by === 'order_date') cmp = new Date(a.order_date || 0) - new Date(b.order_date || 0)
    else if (by === 'receipt_no') cmp = (a.receipt_no || '').localeCompare(b.receipt_no || '')
    else if (by === 'customer_name') cmp = (a.customer_name || '').localeCompare(b.customer_name || '')
    else if (by === 'payment_type') cmp = (a.payment_type || '').localeCompare(b.payment_type || '')
    else if (by === 'outstanding_balance') cmp = Number(a.outstanding_balance || 0) - Number(b.outstanding_balance || 0)
    return cmp * dir
  })
  return list
}

const TAB_OPTIONS = [
  { key: 'trade', label: 'Trade', icon: 'arrow-down-circle-outline' },
  { key: 'loans', label: 'Loans', icon: 'cash-outline' },
  { key: 'withhold', label: 'Withhold', icon: 'arrow-up-circle-outline' },
]
export function ReceivablesTab(props) {
 const activeTab = props.viewModel.getState('receivables-tab');

  return Row({ class: 'flex flex-col gap-6 flex-1 min-h-0 overflow-hidden bg-white border border-gray-200 rounded-lg' }, [
   CardHeader({ class: 'h-12 bg-gray-100 text-gray-900 text-md font-semibold flex items-center justify-between flex-shrink-0 mb-4' }, [
    // TODO: Add tab buttons for trade, loans, and withhold 
    // TODO: the tab buttons should be based on Row() and when active with indigo top border and with hover
    Row({ class: 'flex items-center h-full' }, [
      ...TAB_OPTIONS.map((opt) =>
        Row({ tagType: 'button', class: `w-35 h-full flex items-center justify-center gap-2 text-sm 
          font-medium transition ${activeTab === opt.key ? 'border-t-3 border-indigo-600'
             : 'border-transparent hover:bg-gray-50'}`, 
             events: { click: () => props.viewModel.setReceivablesTab(opt.key) } }, [
          Row({ tagType: 'ion-icon', attributes: { name: opt.icon, class: 'text-lg' } }),
          opt.label
        ])),
    ])
   ]),
   activeTab === 'trade' && TradeReceivables(props),
   activeTab === 'loans' && LoansReceivables(props),
   activeTab === 'withhold' && WithholdReceivables(props),
  ])
}

function TradeReceivables(props) {
  const vm = props.viewModel
  const router = props.router
  const navigationVM = props.navigationVM
  const tradeReceivables = vm.getState('trade-receivables') || { orders: [], total_outstanding: 0 }
  const orders = tradeReceivables.orders || []
  const totalOutstanding = tradeReceivables.total_outstanding ?? 0
  const loading = vm.getState('loading')
  const tableConfig = vm.getState('trade-receivables-table-config') || { limit: 20, offset: 0, sortBy: 'order_date', orderBy: 'desc' }
  const search = vm.getState('trade-search') || ''
  const sortBy = tableConfig.sortBy || 'order_date'
  const orderBy = tableConfig.orderBy || 'desc'
  const paginationLimit = tableConfig.limit || 20
  const paginationOffset = tableConfig.offset || 0

  const displayedOrders = filterAndSortTradeOrders(orders, search, sortBy, orderBy)
  const totalItems = displayedOrders.length
  const initRow = totalItems > 0 ? paginationOffset + 1 : 0
  const endRow = totalItems > 0 ? Math.min(paginationOffset + paginationLimit, totalItems) : 0
  const paginatedOrders = displayedOrders.slice(paginationOffset, paginationOffset + paginationLimit)

  const headerClass = 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer'
  const headerLabelWrapClass = 'inline-flex items-center gap-1 whitespace-nowrap'
  const sortIcon = (column) => {
    if (column !== sortBy) return null
    return IonIcon({ name: orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline', class: 'text-xs shrink-0 font-semibold' })
  }

  const handleSetLimit = (newLimit) => vm.updateTradeTableConfig({ limit: newLimit, offset: 0 })
  const handlePreviousPage = () => vm.updateTradeTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) })
  const handleNextPage = () => vm.updateTradeTableConfig({ offset: paginationOffset + paginationLimit })

  const navigateToSalesOrder = (orderId, contentType) => {
    if (navigationVM && router) {
      navigationVM.updateState('pending-sales-open', { orderId, contentType })
      navigationVM.updateState('active-menu', 'Sales')
      router.navigate('/sales')
    }
  }

  props.ensureLocalStateKey('tradeActionId', null)
  const actionId = props.getLocalState('tradeActionId')

  return Row({ class: 'w-full flex flex-col gap-4 flex-1 min-h-0 overflow-hidden' }, [
    // Total summary banner
    Row({ class: 'px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2' }, [
      Row({ tagType: 'span', class: 'text-sm font-semibold text-gray-700' }, 'Total trade receivables:'),
      Row({ tagType: 'span', class: 'text-lg font-bold text-indigo-700' }, `Br ${financeFormat(totalOutstanding)}`),
      Row({ tagType: 'span', class: 'text-sm text-gray-500' }, `(${orders.length} order${orders.length !== 1 ? 's' : ''} with outstanding balance)`),
    ]),
    // Search and pagination
    Row({ class: 'flex items-center justify-between gap-6 px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex-1 min-w-[280px] max-w-md' }, [
        Row({ class: 'relative w-full' }, [
          IonIcon({
            name: 'search-outline',
            class: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl pointer-events-none'
          }),
          Input({
            placeholder: 'Search receipt #, customer, date...',
            class: 'pl-10 pr-4 w-full',
            value: search,
            onChange: (e) => vm.setTradeSearch(e.target.value)
          })
        ])
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({
          name: 'trade-limit',
          onChange: (e) => handleSetLimit(parseInt(e.target.value, 10)),
          value: paginationLimit
        }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' },
            totalItems > 0 ? `${initRow}-${endRow} of ${totalItems}` : '0-0 of 0'
          ),
          IconButton({ onClick: handlePreviousPage, disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: handleNextPage, disabled: paginationOffset + paginationLimit >= totalItems || loading }, [IonIcon({ name: 'caret-forward-outline' })])
        ]),
      ]),
    ]),
    loading ? Row({ class: 'flex items-center gap-2 text-gray-500 px-6 py-4' }, [Spinner({ class: 'w-4 h-4' }), 'Loading...']) : Row({ class: 'flex-1 min-h-0 overflow-auto' }, [
      displayedOrders.length === 0
        ? Row({ class: 'text-gray-500 text-sm py-8 px-6' }, orders.length === 0 ? 'No trade receivables. Outstanding balances appear here when sales are on credit or cheque.' : 'No orders match your search.')
        : Table({ class: 'w-full text-sm', tableClass: 'table-fixed' }, [
            TableHeader({}, [
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setTradeSort('receipt_no') }, [Row({ class: headerLabelWrapClass }, ['Receipt #', sortIcon('receipt_no')])]),
              TableHCell({ class: headerClass, onClick: () => vm.setTradeSort('customer_name') }, [Row({ class: headerLabelWrapClass }, ['Customer', sortIcon('customer_name')])]),
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setTradeSort('order_date') }, [Row({ class: headerLabelWrapClass }, ['Date', sortIcon('order_date')])]),
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setTradeSort('payment_type') }, [Row({ class: headerLabelWrapClass }, ['Payment', sortIcon('payment_type')])]),
              TableHCell({ class: `${headerClass} text-right w-28`, onClick: () => vm.setTradeSort('outstanding_balance') }, [Row({ class: `${headerLabelWrapClass} justify-end` }, ['Outstanding', sortIcon('outstanding_balance')])]),
              TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase w-24' }, 'Action')
            ]),
            TableBody({}, [
              ...paginatedOrders.map((order) =>
                TableRow({ key: order.id }, [
                  TableDCell({ class: 'w-28' }, order.receipt_no),
                  TableDCell({}, order.customer_name || '—'),
                  TableDCell({ class: 'w-28' }, formatDateDDMMYYYY(order.order_date)),
                  TableDCell({ class: 'w-24 capitalize' }, order.payment_type || 'credit'),
                  TableDCell({ class: 'text-right w-28' }, `Br ${financeFormat(order.outstanding_balance)}`),
                  TableDCell({ class: 'text-center w-24' }, ActionDropdown({
                    actionId: order.id,
                    open: order.id === actionId,
                    onToggle: () => props.setLocalState('tradeActionId', actionId === order.id ? null : order.id),
                    class: 'text-center'
                  }, [
                    ActionItem({
                      label: 'View in Sales',
                      icon: 'eye-outline',
                      onClick: () => {
                        props.setLocalState('tradeActionId', null)
                        navigateToSalesOrder(order.id, 'details')
                      }
                    }),
                    ActionItem({
                      label: 'Make Payment',
                      icon: 'wallet-outline',
                      onClick: () => {
                        props.setLocalState('tradeActionId', null)
                        navigateToSalesOrder(order.id, 'payment')
                      }
                    })
                  ]))
                ])
              ),
              // Footer total row
              TableRow({ class: 'bg-gray-100 font-semibold' }, [
                TableDCell({ class: 'w-28' }, ''),
                TableDCell({}, ''),
                TableDCell({ class: 'w-28' }, ''),
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({ class: 'text-right w-28' }, `Br ${financeFormat(paginatedOrders.reduce((s, o) => s + Number(o.outstanding_balance || 0), 0))}`),
                TableDCell({ class: 'w-24' }, '')
              ])
            ])
          ])
    ])
  ])
}

const LOANS_STATUS_OPTIONS = ['All', 'Active', 'Partially Returned', 'Returned']

function LoansReceivables(props) {
  const vm = props.viewModel
  const loansState = vm.getState('loans-receivable') || { loans: [], total: 0, total_outstanding: 0 }
  const loans = loansState.loans || []
  const totalOutstanding = loansState.total_outstanding ?? 0
  const totalCount = loansState.total ?? loans.length
  const loading = vm.getState('loading')
  const tableConfig = vm.getState('loans-receivable-table-config') || { limit: 20, offset: 0, sortBy: 'lent_date', orderBy: 'desc' }
  const search = vm.getState('loans-search') || ''
  const statusFilter = vm.getState('loans-status-filter') || ''
  const sortBy = tableConfig.sortBy || 'lent_date'
  const orderBy = tableConfig.orderBy || 'desc'
  const paginationLimit = tableConfig.limit || 20
  const paginationOffset = tableConfig.offset || 0

  const statusFilterValue = statusFilter === 'active' ? 'Active' : statusFilter === 'partially_returned' ? 'Partially Returned' : statusFilter === 'returned' ? 'Returned' : 'All'

  const displayedLoans = filterAndSortLoans(loans, search, sortBy, orderBy)
  const totalItems = displayedLoans.length
  const initRow = totalItems > 0 ? paginationOffset + 1 : 0
  const endRow = totalItems > 0 ? Math.min(paginationOffset + paginationLimit, totalItems) : 0
  const paginatedLoans = displayedLoans.slice(paginationOffset, paginationOffset + paginationLimit)

  const activeCount = loans.filter((l) => (l.status || 'active') !== 'returned').length
  const overdueCount = loans.filter((l) => {
    const due = l.expected_return_date
    if (!due || (l.status || '') === 'returned') return false
    return new Date(due) < new Date()
  }).length

  const headerClass = 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer'
  const headerLabelWrapClass = 'inline-flex items-center gap-1 whitespace-nowrap'
  const sortIcon = (col) => (col !== sortBy ? null : IonIcon({ name: orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline', class: 'text-xs shrink-0 font-semibold' }))

  const handleSetLimit = (n) => vm.updateLoansTableConfig({ limit: n, offset: 0 })
  const handlePrevPage = () => vm.updateLoansTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) })
  const handleNextPage = () => vm.updateLoansTableConfig({ offset: paginationOffset + paginationLimit })
  const handleStatusFilter = (v) => vm.setLoansStatusFilter(v === 'All' ? '' : v === 'Active' ? 'active' : v === 'Partially Returned' ? 'partially_returned' : 'returned')

  const highlightOverdue = (due) => {
    if (!due) return ''
    return new Date(due) < new Date() ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
  }

  const openCreateLoan = async () => {
    vm.resetLoanForm()
    const list = vm.getState('loan-customer-list') || []
    if (list.length === 0) await vm.loadLoanCustomers('')
    // Pre-fetch cash balance for UI validation/hint
    try {
      const ledgerRes = await window.ipcRenderer?.invoke?.('dashboard:get-ledger-balances')
      const cash = ledgerRes?.balances?.['1100'] != null ? Number(ledgerRes.balances['1100']) : 0
      vm.updateState('create-loan-cash-balance', cash)
    } catch {
      vm.updateState('create-loan-cash-balance', null)
    }
    vm.updateState('create-loan-modal-open', true)
  }

  const closeCreateLoanModal = () => {
    vm.updateState('create-loan-modal-open', false)
    vm.updateState('create-loan-submitting', false)
  }

  props.ensureLocalStateKey('loansActionId', null)
  props.ensureLocalStateKey('drawerLoanId', null)
  props.ensureLocalStateKey('showLoanDrawer', false)
  props.ensureLocalStateKey('selectedLoan', null)
  const actionId = props.getLocalState('loansActionId')
  const selectedLoan = props.getLocalState('selectedLoan')

  const openRecordReturnModal = (loan) => {
    props.setLocalState('showLoanDrawer', false)
    props.setLocalState('drawerLoanId', null)
    props.setLocalState('selectedLoan', null)
    Modal({}, (delegator, handleClose) => RecordReturnModalContent(vm, loan, handleClose, delegator))
  }

  const handleViewLoan = (loan) => {
    props.setLocalState('loansActionId', null)
    props.setLocalState('selectedLoan', loan)
    props.setLocalState('drawerLoanId', loan.id)
    requestAnimationFrame(() => props.setLocalState('showLoanDrawer', true))
  }

  return Row({ class: 'w-full flex flex-col gap-4 flex-1 min-h-0 overflow-hidden' }, [
    Row({ class: 'px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-4 flex-wrap' }, [
      Row({ class: 'flex items-center gap-4' }, [
        Row({ class: 'flex items-center gap-2' }, [
          Row({ tagType: 'span', class: 'text-sm font-semibold text-gray-700' }, 'Total outstanding:'),
          Row({ tagType: 'span', class: 'text-lg font-bold text-indigo-700' }, `Br ${financeFormat(totalOutstanding)}`),
        ]),
        Row({ tagType: 'span', class: 'text-sm text-gray-500' }, `${activeCount} active`),
        overdueCount > 0 ? Row({ tagType: 'span', class: 'text-sm font-medium text-red-600' }, `${overdueCount} overdue`) : null,
      ]),
      Button({ variant: 'primary', class: 'text-sm', onClick: openCreateLoan }, 'Create Loan')
    ]),
    Row({ class: 'flex items-center justify-between gap-6 px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex items-center gap-4 flex-1 flex-wrap' }, [
        Row({ class: 'flex-1 min-w-[200px] max-w-md' }, [
          Row({ class: 'relative w-full' }, [
            IonIcon({ name: 'search-outline', class: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none' }),
            Input({
              placeholder: 'Search reference, partner...',
              class: 'pl-10 pr-4 w-full',
              value: search,
              onChange: (e) => vm.setLoansSearch(e.target.value)
            })
          ])
        ]),
        SelectFluid({
          value: statusFilterValue,
          onChange: (e) => handleStatusFilter(e.target.value),
          class: 'min-w-[160px] text-sm'
        }, SelectOptions({ options: LOANS_STATUS_OPTIONS, selectedOption: statusFilterValue })),
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({
          name: 'loans-limit',
          onChange: (e) => handleSetLimit(parseInt(e.target.value, 10)),
          value: paginationLimit
        }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, totalItems > 0 ? `${initRow}-${endRow} of ${totalItems}` : '0-0 of 0'),
          IconButton({ onClick: handlePrevPage, disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: handleNextPage, disabled: paginationOffset + paginationLimit >= totalItems || loading }, [IonIcon({ name: 'caret-forward-outline' })])
        ]),
      ]),
    ]),
    loading ? Row({ class: 'flex items-center gap-2 text-gray-500 px-6 py-4' }, [Spinner({ class: 'w-4 h-4' }), 'Loading...']) : Row({ class: 'flex-1 min-h-0 overflow-auto' }, [
      displayedLoans.length === 0
        ? Row({ class: 'text-gray-500 text-sm py-8 px-6' }, loans.length === 0 ? 'No cash loans receivable. Click "Create Loan" to lend to a partner.' : 'No loans match your search or filter.')
        : Table({ class: 'w-full text-sm', tableClass: 'table-fixed' }, [
            TableHeader({}, [
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setLoansSort('reference_no') }, [Row({ class: headerLabelWrapClass }, ['Ref #', sortIcon('reference_no')])]),
              TableHCell({ class: headerClass, onClick: () => vm.setLoansSort('partner_name') }, [Row({ class: headerLabelWrapClass }, ['Partner', sortIcon('partner_name')])]),
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setLoansSort('lent_date') }, [Row({ class: headerLabelWrapClass }, ['Lent', sortIcon('lent_date')])]),
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setLoansSort('expected_return_date') }, [Row({ class: headerLabelWrapClass }, ['Due', sortIcon('expected_return_date')])]),
              TableHCell({ class: `${headerClass} text-right w-24`, onClick: () => vm.setLoansSort('outstanding') }, [Row({ class: `${headerLabelWrapClass} justify-end` }, ['Outstanding', sortIcon('outstanding')])]),
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setLoansSort('status') }, [Row({ class: headerLabelWrapClass }, ['Status', sortIcon('status')])]),
              TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase w-24' }, 'Action')
            ]),
            TableBody({}, [
              ...paginatedLoans.map((loan) => {
                const outstanding = Math.max(0, Number(loan.amount || 0) - Number(loan.returned_amount || 0))
                const isReturned = (loan.status || '') === 'returned'
                const statusBadge = getLoanStatusBadge(loan.status)
                const loanActions = [
                  ActionItem({
                    label: 'View',
                    icon: 'eye-outline',
                    onClick: () => handleViewLoan(loan)
                  })
                ]
                if (!isReturned) {
                  loanActions.push(ActionItem({
                    label: 'Record Return',
                    icon: 'wallet-outline',
                    onClick: () => {
                      props.setLocalState('loansActionId', null)
                      openRecordReturnModal(loan)
                    }
                  }))
                }
                return TableRow({ key: loan.id, class: `hover:bg-indigo-50 ${highlightOverdue(loan.expected_return_date)}` }, [
                  TableDCell({ class: 'w-24' }, loan.reference_no || `LR${loan.id}`),
                  TableDCell({}, loan.partner_name || '—'),
                  TableDCell({ class: 'w-24' }, formatDateDDMMYYYY(loan.lent_date)),
                  TableDCell({ class: 'w-24' }, loan.expected_return_date ? formatDateDDMMYYYY(loan.expected_return_date) : '—'),
                  TableDCell({ class: 'text-right w-24' }, `Br ${financeFormat(outstanding)}`),
                  TableDCell({ class: 'w-24' }, Badge({ label: statusBadge.label, tone: statusBadge.tone, class: 'text-xs px-2 py-0.5' })),
                  TableDCell({ class: 'text-center w-24' }, ActionDropdown({
                    actionId: loan.id,
                    open: loan.id === actionId,
                    onToggle: () => props.setLocalState('loansActionId', actionId === loan.id ? null : loan.id),
                    class: 'text-center'
                  }, loanActions))
                ])
              }),
              TableRow({ class: 'bg-gray-100 font-semibold' }, [
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({}, ''),
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({ class: 'text-right w-24' }, `Br ${financeFormat(paginatedLoans.reduce((s, l) => s + Math.max(0, Number(l.amount || 0) - Number(l.returned_amount || 0)), 0))}`),
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({ class: 'w-24' }, '')
              ])
            ])
          ])
    ]),
    props.getLocalState('drawerLoanId') && loanDetailsDrawer({ ...props, openRecordReturnModal }),
    vm.getState('create-loan-modal-open') && Row({
      class: 'fixed inset-0 bg-gray-800/50 flex items-center justify-center p-4 z-50',
      attributes: { id: 'create-loan-overlay' },
      events: {
        click: (e) => {
          if (e.target?.id === 'create-loan-overlay') closeCreateLoanModal()
        }
      }
    }, [
      CreateLoanModalContent(vm, null, closeCreateLoanModal)
    ])
  ])
}

function loanDetailsDrawer(props) {
  const showLoanDrawer = props.getLocalState('showLoanDrawer')
  const selectedLoan = props.getLocalState('selectedLoan')
  const openRecordReturnModal = props.openRecordReturnModal

  const onCloseDrawer = () => {
    props.setLocalState('showLoanDrawer', false)
    setTimeout(() => {
      props.setLocalState('drawerLoanId', null)
      props.setLocalState('selectedLoan', null)
    }, DRAWER_CLOSE_MS)
  }

  return LoanDetailDrawer({
    ...props,
    loan: selectedLoan,
    showSlide: showLoanDrawer,
    onClose: onCloseDrawer,
    onRecordReturn: openRecordReturnModal ? () => openRecordReturnModal(selectedLoan) : undefined
  })
}

function LoanDetailDrawer(props) {
  const { loan, showSlide = true, onClose, onRecordReturn } = props
  if (!loan) return null
  const outstanding = Math.max(0, Number(loan.amount || 0) - Number(loan.returned_amount || 0))
  const isReturned = (loan.status || '') === 'returned'

  return Drawer({ class: 'flex flex-col h-full', openSlide: showSlide }, [
    Card({ class: 'flex flex-col h-full' }, [
      CardHeader({ class: 'flex items-center justify-between px-5 h-12 border-b border-gray-200 flex-shrink-0' }, [
        Row({ class: 'text-base font-semibold text-gray-900' }, `Loan ${loan.reference_no || `#${loan.id}`}`),
        IconButton({ onClick: onClose }, IonIcon({ name: 'close-outline', class: 'text-xl' }))
      ]),
      CardBody({ class: 'flex-1 overflow-y-auto min-h-0 px-5 py-4' }, [
        Row({ class: 'flex flex-col gap-4' }, [
          detailRow('Partner', loan.partner_name || '—'),
          detailRow('Lent date', formatDateDDMMYYYY(loan.lent_date)),
          detailRow('Due date', loan.expected_return_date ? formatDateDDMMYYYY(loan.expected_return_date) : '—'),
          detailRow('Amount', `Br ${financeFormat(loan.amount)}`),
          detailRow('Repaid', `Br ${financeFormat(loan.returned_amount)}`),
          detailRow('Outstanding', `Br ${financeFormat(outstanding)}`),
          Row({ class: 'flex flex-col gap-0.5' }, [
            Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500' }, 'Status'),
            Row({ class: 'text-sm' }, Badge({ label: getLoanStatusBadge(loan.status).label, tone: getLoanStatusBadge(loan.status).tone, class: 'text-xs px-2 py-0.5 w-fit' }))
          ]),
          loan.notes ? detailRow('Notes', loan.notes) : null
        ].filter(Boolean))
      ]),
      CardFooter({ class: 'flex justify-end gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0' }, [
        Button({ variant: 'secondary', onClick: onClose }, 'Close'),
        !isReturned && Button({ variant: 'primary', onClick: onRecordReturn }, 'Record Return')
      ].filter(Boolean))
    ])
  ])
}

function detailRow(label, value) {
  return Row({ class: 'flex flex-col gap-0.5' }, [
    Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500' }, label),
    Row({ class: 'text-sm text-gray-900' }, value)
  ])
}

function CreateLoanModalContent(vm, delegator, handleClose) {
  const form = vm.getState('loan-form') || {}
  const customerList = vm.getState('loan-customer-list') || []
  const loanCustomerDdLoading = vm.getState('loan-customer-dropdown-loading') === true
  const showPartnerDropdown = form.show_partner_dropdown === true
  const partnerDisplay = form.partner ? (form.partner.name || form.partner.full_name || '') : 'Select partner...'
  const partnerSearchValue = showPartnerDropdown ? (form.partner_search || '') : partnerDisplay
  const sortedCustomers = [...customerList].filter((c) => {
    const n = (c.name || c.full_name || '').trim().toLowerCase()
    return n !== 'walk-in'
  })

  const loanPartnerMenuRows = []
  if (loanCustomerDdLoading) {
    loanPartnerMenuRows.push(Row({ key: 'loan-dd-loading', class: 'px-3 py-2 text-xs text-gray-500 italic' }, 'Searching…'))
  } else if (sortedCustomers.length === 0) {
    loanPartnerMenuRows.push(
      Row(
        { key: 'loan-dd-empty', class: 'px-3 py-2 text-xs text-gray-500' },
        (form.partner_search || '').trim() ? 'No partners match your search.' : 'Type to search partners (retailer / both / other).'
      )
    )
  } else {
    loanPartnerMenuRows.push(
      ...sortedCustomers.map((c) => {
        const name = c.name || c.full_name || 'Unknown'
        const partnerChildren = [
          Row({ class: 'flex items-center justify-between gap-2' }, [
            Row({ class: 'font-semibold text-gray-900' }, name),
            Badge({
              label: capitalizeCustomerType(c.customer_type),
              tone: getCustomerTypeBadgeColor(c.customer_type),
              class: 'text-xs px-2 py-0.5',
            }),
          ]),
          Row({ class: 'flex items-center gap-2 text-xs text-gray-500' }, [
            ...(c.contact_person
              ? [Row({ class: 'flex items-center gap-1' }, [IonIcon({ name: 'person-outline', class: 'text-xs' }), c.contact_person])]
              : []),
            ...(c.contact_person ? [Row({}, '•')] : []),
            Row({}, c.phone || c.contact_number || 'N/A'),
          ]),
        ]
        return DropdownSearchItem(
          {
            ...(delegator ? { delegator } : {}),
            onSelect: () => {
              vm.selectLoanPartner(c)
              vm.updateLoanForm({ show_partner_dropdown: false })
            },
            key: c.id,
            class: 'py-3',
          },
          [Row({ class: 'flex flex-col gap-1' }, partnerChildren)]
        )
      })
    )
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!form.partner_id) {
      showAlert({ message: 'Partner is required.', variant: 'error' })
      return
    }
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      showAlert({ message: 'Amount must be positive.', variant: 'error' })
      return
    }
    if (!form.lent_date) {
      showAlert({ message: 'Lent date is required.', variant: 'error' })
      return
    }
    // Cash balance validation: ensure sufficient funds before creating loan
    try {
      const ledgerRes = await window.ipcRenderer?.invoke?.('dashboard:get-ledger-balances')
      const cashBalance = ledgerRes?.balances?.['1100'] != null ? Number(ledgerRes.balances['1100']) : 0
      if (cashBalance < amount) {
        showAlert({
          message: `Insufficient cash balance. Current cash: Br ${financeFormat(cashBalance)}. Required: Br ${financeFormat(amount)}.`,
          variant: 'error'
        })
        return
      }
    } catch (ledgerErr) {
      showAlert({ message: ledgerErr.message || 'Could not verify cash balance.', variant: 'error' })
      return
    }
    vm.updateState('create-loan-submitting', true)
    try {
      await vm.createCashLoanReceivable({
        partner_id: form.partner_id,
        amount,
        lent_date: form.lent_date,
        expected_return_date: form.expected_return_date || null,
        notes: form.notes || null,
        reference_no: form.reference_no || null
      })
      handleClose()
      showAlert({ message: 'Loan created successfully.', variant: 'success' })
    } catch (err) {
      showAlert({ message: err.message || 'Failed to create loan.', variant: 'error' })
    } finally {
      vm.updateState('create-loan-submitting', false)
    }
  }

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const fieldClass = 'w-full'

  return Row({ tagType: 'form', class: 'w-full max-w-lg bg-white rounded-xl shadow-xl p-6 space-y-4', events: { submit: handleSubmit }, ...(delegator ? { delegator } : {}) }, [
    Row({ class: 'text-lg font-semibold mb-4' }, 'Create Loan'),
    Row({}, [
      Row({ tagType: 'label', class: labelClass }, 'Partner'),
      DropdownSearch({
        ...(delegator ? { delegator } : {}),
        open: showPartnerDropdown,
        value: partnerSearchValue,
        placeholder: 'Search partners...',
        onInput: (v) => vm.updateLoanPartnerSearch(v),
        onFocus: () => {
          vm.loadLoanCustomers(form.partner_search || '')
          vm.updateLoanForm({ show_partner_dropdown: true })
        },
        getOpenState: () => (vm.getState('loan-form') || {}).show_partner_dropdown,
        setOpenState: () => vm.updateLoanForm({ show_partner_dropdown: false }),
        class: 'w-full relative'
      }, loanPartnerMenuRows)
    ]),
    Row({}, [
      Row({ tagType: 'label', class: labelClass }, 'Amount (Br)'),
      Input({ type: 'number', min: '0.01', step: '0.01', class: fieldClass, value: form.amount || '', onChange: (e) => vm.updateLoanForm({ amount: e.target.value }) }),
      vm.getState('create-loan-cash-balance') != null && Row({ class: 'text-xs text-gray-500 mt-1' }, `Available cash: Br ${financeFormat(vm.getState('create-loan-cash-balance'))}`)
    ]),
    Row({ class: 'grid grid-cols-2 gap-4' }, [
      Row({}, [
        Row({ tagType: 'label', class: labelClass }, 'Lent date'),
        Input({ type: 'date', class: fieldClass, value: form.lent_date || '', onChange: (e) => vm.updateLoanForm({ lent_date: e.target.value }) })
      ]),
      Row({}, [
        Row({ tagType: 'label', class: labelClass }, 'Due date (optional)'),
        Input({ type: 'date', class: fieldClass, value: form.expected_return_date || '', onChange: (e) => vm.updateLoanForm({ expected_return_date: e.target.value }) })
      ])
    ]),
    Row({}, [
      Row({ tagType: 'label', class: labelClass }, 'Notes (optional)'),
      Input({ type: 'text', class: fieldClass, value: form.notes || '', onChange: (e) => vm.updateLoanForm({ notes: e.target.value }), placeholder: 'Reference or notes' })
    ]),
    Row({ class: 'flex justify-end gap-2 pt-2' }, [
      Button({ type: 'button', variant: 'secondary', onClick: handleClose }, 'Cancel'),
      Button({
        type: 'button',
        variant: 'primary',
        disabled: vm.getState('create-loan-submitting'),
        onClick: (e) => { e.preventDefault(); e.target.closest('form')?.requestSubmit() }
      }, 'Create Loan')
    ])
  ])
}

function RecordReturnModalContent(vm, loan, handleClose, delegator) {
  const outstanding = Math.max(0, Number(loan.amount || 0) - Number(loan.returned_amount || 0))
  const defaultDate = new Date().toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const form = e.target
    const submitBtn = form.querySelector('.record-return-submit-btn')
    const amt = Number(form.querySelector('[name=return-amount]')?.value || 0)
    const dateVal = form.querySelector('[name=return-date]')?.value || ''
    if (!amt || amt <= 0) {
      showAlert({ message: 'Amount must be positive.', variant: 'error' })
      return
    }
    if (amt > outstanding) {
      showAlert({ message: `Amount cannot exceed outstanding (Br ${financeFormat(outstanding)}).`, variant: 'error' })
      return
    }
    if (!dateVal) {
      showAlert({ message: 'Return date is required.', variant: 'error' })
      return
    }
    if (submitBtn) submitBtn.disabled = true
    try {
      await vm.recordCashLoanReceivableReturn(loan.id, { amount: amt, return_date: dateVal })
      handleClose()
      showAlert({ message: 'Return recorded successfully.', variant: 'success' })
    } catch (err) {
      showAlert({ message: err.message || 'Failed to record return.', variant: 'error' })
      if (submitBtn) submitBtn.disabled = false
    }
  }

  return Row({
    tagType: 'form',
    class: 'w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4',
    events: { submit: handleSubmit },
    attributes: { name: 'record-return-form' },
    delegator
  }, [
    Row({ class: 'text-lg font-semibold mb-4' }, `Record Return – ${loan.partner_name || 'Partner'} (${loan.reference_no || `#${loan.id}`})`),
    Row({}, [
      Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'return-amount' } }, 'Amount (Br)'),
      Input({
        type: 'number',
        min: '0.01',
        step: '0.01',
        max: String(outstanding),
        class: 'w-full',
        name: 'return-amount',
        value: String(outstanding),
        delegator
      })
    ]),
    Row({}, [
      Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'return-date' } }, 'Return date'),
      Input({
        type: 'date',
        class: 'w-full',
        name: 'return-date',
        value: defaultDate,
        delegator
      })
    ]),
    Row({ class: 'text-sm text-gray-500' }, `Outstanding: Br ${financeFormat(outstanding)}`),
    Row({ class: 'flex justify-end gap-2' }, [
      Button({ type: 'button', variant: 'secondary', onClick: handleClose, delegator }, 'Cancel'),
      Button({
        type: 'button',
        variant: 'primary',
        class: 'record-return-submit-btn',
        onClick: (e) => { e.preventDefault(); e.target.closest('form')?.requestSubmit() },
        delegator
      }, 'Record Return')
    ])
  ])
}

const WITHHOLD_STATUS_OPTIONS = [
  { key: 'confirmed_unsettled', label: 'Ready to settle' },
  { key: 'unconfirmed', label: 'Unconfirmed' },
  { key: 'settled', label: 'Settled' },
  { key: '', label: 'All' }
]

function filterAndSortWithholdOrders(orders, search, sortBy, orderBy) {
  let list = [...(orders || [])]
  const searchLower = (search || '').trim().toLowerCase()
  if (searchLower) {
    list = list.filter((o) => {
      const receipt = (o.receipt_no || '').toLowerCase()
      const customer = (o.customer_name || '').toLowerCase()
      const ref = (o.withhold_ref || '').toLowerCase()
      const dateStr = formatDateDDMMYYYY(o.order_date) || ''
      const amtStr = financeFormat(o.withhold_amount)
      return `${receipt} ${customer} ${ref} ${dateStr} ${amtStr}`.includes(searchLower)
    })
  }
  const by = sortBy || 'order_date'
  const dir = orderBy === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let cmp = 0
    if (by === 'order_date') cmp = new Date(a.order_date || 0) - new Date(b.order_date || 0)
    else if (by === 'receipt_no') cmp = (a.receipt_no || '').localeCompare(b.receipt_no || '')
    else if (by === 'customer_name') cmp = (a.customer_name || '').localeCompare(b.customer_name || '')
    else if (by === 'withhold_ref') cmp = (a.withhold_ref || '').localeCompare(b.withhold_ref || '')
    else if (by === 'withhold_amount') cmp = Number(a.withhold_amount || 0) - Number(b.withhold_amount || 0)
    return cmp * dir
  })
  return list
}

function WithholdReceivables(props) {
  const vm = props.viewModel
  const router = props.router
  const navigationVM = props.navigationVM
  const withholdState = vm.getState('withhold-receivables') || { orders: [], total: 0, stats: {} }
  const orders = withholdState.orders || []
  const stats = withholdState.stats || {}
  const totalUnsettled = stats.total_unsettled ?? 0
  const countConfirmedUnsettled = stats.count_confirmed_unsettled ?? 0
  const countUnconfirmed = stats.count_unconfirmed ?? 0
  const countSettled = stats.count_settled ?? 0
  const loading = vm.getState('loading')
  const tableConfig = vm.getState('withhold-receivables-table-config') || { limit: 20, offset: 0, sortBy: 'order_date', orderBy: 'desc' }
  const search = vm.getState('withhold-search') || ''
  const statusFilter = vm.getState('withhold-status-filter') || 'confirmed_unsettled'
  const dateFrom = vm.getState('withhold-date-from') || ''
  const dateTo = vm.getState('withhold-date-to') || ''
  const sortBy = tableConfig.sortBy || 'order_date'
  const orderBy = tableConfig.orderBy || 'desc'
  const paginationLimit = tableConfig.limit || 20
  const paginationOffset = tableConfig.offset || 0
  const selectedOrders = vm.getState('withhold-selected-orders') || []

  const displayedOrders = filterAndSortWithholdOrders(orders, search, sortBy, orderBy)
  const totalItems = displayedOrders.length
  const initRow = totalItems > 0 ? paginationOffset + 1 : 0
  const endRow = totalItems > 0 ? Math.min(paginationOffset + paginationLimit, totalItems) : 0
  const paginatedOrders = displayedOrders.slice(paginationOffset, paginationOffset + paginationLimit)
  const settleableOrders = displayedOrders.filter((o) => o.withhold_confirmation && !o.withhold_settled)
  const selectedSettleable = selectedOrders.filter((o) => o.withhold_confirmation && !o.withhold_settled)

  const headerClass = 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer'
  const headerLabelWrapClass = 'inline-flex items-center gap-1 whitespace-nowrap'
  const sortIcon = (col) => (col !== sortBy ? null : IonIcon({ name: orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline', class: 'text-xs shrink-0 font-semibold' }))

  const handleSetLimit = (n) => vm.updateWithholdTableConfig({ limit: n, offset: 0 })
  const handlePrevPage = () => vm.updateWithholdTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) })
  const handleNextPage = () => vm.updateWithholdTableConfig({ offset: paginationOffset + paginationLimit })
  const withholdStatusLabelToKey = { 'Ready to settle': 'confirmed_unsettled', 'Unconfirmed': 'unconfirmed', 'Settled': 'settled', 'All': '' }
  const withholdStatusKeyToLabel = { confirmed_unsettled: 'Ready to settle', unconfirmed: 'Unconfirmed', settled: 'Settled', '': 'All' }
  const handleStatusFilter = (label) => vm.setWithholdStatusFilter(withholdStatusLabelToKey[label] ?? statusFilter)

  const navigateToSalesOrder = (orderId, contentType) => {
    if (navigationVM && router) {
      navigationVM.updateState('pending-sales-open', { orderId, contentType })
      navigationVM.updateState('active-menu', 'Sales')
      router.navigate('/sales')
    }
  }

  const openSettleModal = (ordersToSettle) => {
    vm.setWithholdSelectedOrders(ordersToSettle)
    vm.updateState('withhold-settlement-modal-open', true)
  }

  const closeSettleModal = () => {
    vm.updateState('withhold-settlement-modal-open', false)
    vm.setWithholdSelectedOrders([])
  }

  const handleSettleOne = (order) => {
    if (order.withhold_confirmation && !order.withhold_settled) {
      openSettleModal([order])
    }
  }

  const handleSettleSelected = () => {
    if (selectedSettleable.length === 0) {
      showAlert({ message: 'Select at least one confirmed order to settle.', variant: 'error' })
      return
    }
    openSettleModal(selectedSettleable)
  }

  const handleSettleAll = () => {
    if (settleableOrders.length === 0) {
      showAlert({ message: 'No orders ready to settle.', variant: 'error' })
      return
    }
    openSettleModal(settleableOrders)
  }

  const handleSelectByDateRange = () => {
    if (!dateFrom && !dateTo) {
      showAlert({ message: 'Select at least a From or To date.', variant: 'error' })
      return
    }
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Number.MAX_SAFE_INTEGER
    const inRange = settleableOrders.filter((o) => {
      const d = new Date(o.order_date || 0).getTime()
      return d >= fromTs && d <= toTs
    })
    vm.setWithholdSelectedOrders(inRange)
    if (inRange.length === 0) {
      showAlert({ message: 'No orders in the selected date range.', variant: 'info' })
    }
  }

  const isOrderSelected = (order) => selectedOrders.some((o) => o.id === order.id)
  const canSettle = (order) => order.withhold_confirmation && !order.withhold_settled
  const allSettleableSelected = settleableOrders.length > 0 && selectedSettleable.length === settleableOrders.length
  const toggleSelectAllSettleable = () => {
    if (allSettleableSelected) vm.setWithholdSelectedOrders([])
    else vm.setWithholdSelectedOrders(settleableOrders)
  }

  props.ensureLocalStateKey('withholdActionId', null)
  const actionId = props.getLocalState('withholdActionId')

  return Row({ class: 'w-full flex flex-col gap-4 flex-1 min-h-0 overflow-hidden' }, [
    Row({ class: 'px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-4 flex-wrap' }, [
      Row({ class: 'flex items-center gap-4 flex-wrap' }, [
        Row({ class: 'flex items-center gap-2' }, [
          Row({ tagType: 'span', class: 'text-sm font-semibold text-gray-700' }, 'Total unsettled:'),
          Row({ tagType: 'span', class: 'text-lg font-bold text-indigo-700' }, `Br ${financeFormat(totalUnsettled)}`),
        ]),
        Row({ tagType: 'span', class: 'text-sm text-gray-500' }, `${countConfirmedUnsettled} ready to settle`),
        countUnconfirmed > 0 ? Row({ tagType: 'span', class: 'text-sm font-medium text-amber-600' }, `${countUnconfirmed} unconfirmed`) : null,
        Row({ tagType: 'span', class: 'text-sm text-gray-500' }, `${countSettled} settled`),
      ]),
      Row({ class: 'flex items-center gap-2' }, [
        settleableOrders.length > 0 && Button({
          variant: 'primary',
          class: 'text-sm',
          onClick: handleSettleAll
        }, `Settle all (${settleableOrders.length})`),
        selectedSettleable.length > 0 && Button({
          variant: 'outline',
          class: 'text-sm',
          onClick: handleSettleSelected
        }, `Settle selected (${selectedSettleable.length})`),
      ].filter(Boolean)),
    ]),
    Row({ class: 'flex items-center justify-between gap-4 px-6 py-3 border-b border-gray-200 bg-gray-50' }, [
      SelectCompact({
        name: 'withhold-status',
        value: withholdStatusKeyToLabel[statusFilter] || 'Ready to settle',
        onChange: (e) => handleStatusFilter(e.target.value),
        containerClass: 'text-sm'
      }, SelectOptions({
        options: WITHHOLD_STATUS_OPTIONS.map((o) => o.label),
        selectedOption: withholdStatusKeyToLabel[statusFilter] || 'Ready to settle'
      })),
      Row({ class: 'flex items-center gap-3' }, [
        Row({ class: 'flex items-center gap-2' }, [
          Row({ tagType: 'label', class: 'text-sm text-gray-500 whitespace-nowrap' }, 'From:'),
          Input({
            type: 'date',
            class: 'w-36 text-sm py-1.5',
            value: dateFrom,
            onChange: (e) => vm.setWithholdDateFrom(e.target.value)
          })
        ]),
        Row({ class: 'flex items-center gap-2' }, [
          Row({ tagType: 'label', class: 'text-sm text-gray-500 whitespace-nowrap' }, 'To:'),
          Input({
            type: 'date',
            class: 'w-36 text-sm py-1.5',
            value: dateTo,
            onChange: (e) => vm.setWithholdDateTo(e.target.value)
          })
        ]),
        settleableOrders.length > 0 && Button({
          variant: 'outline',
          class: 'text-sm',
          onClick: handleSelectByDateRange
        }, 'Select by range')
      ].filter(Boolean)),
    ]),
    Row({ class: 'flex items-center justify-between gap-6 px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex-1 min-w-[200px] max-w-md' }, [
        Row({ class: 'relative w-full' }, [
          IonIcon({ name: 'search-outline', class: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none' }),
          Input({
            placeholder: 'Search receipt, customer, withhold ref...',
            class: 'pl-10 pr-4 w-full',
            value: search,
            onChange: (e) => vm.setWithholdSearch(e.target.value)
          })
        ])
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({
          name: 'withhold-limit',
          onChange: (e) => handleSetLimit(parseInt(e.target.value, 10)),
          value: paginationLimit
        }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, totalItems > 0 ? `${initRow}-${endRow} of ${totalItems}` : '0-0 of 0'),
          IconButton({ onClick: handlePrevPage, disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: handleNextPage, disabled: paginationOffset + paginationLimit >= totalItems || loading }, [IonIcon({ name: 'caret-forward-outline' })])
        ]),
      ]),
    ]),
    loading ? Row({ class: 'flex items-center gap-2 text-gray-500 px-6 py-4' }, [Spinner({ class: 'w-4 h-4' }), 'Loading...']) : Row({ class: 'flex-1 min-h-0 overflow-auto' }, [
      displayedOrders.length === 0
        ? Row({ class: 'text-gray-500 text-sm py-8 px-6' }, orders.length === 0 ? 'No withhold receivables. Sales with withhold appear here after they are confirmed in Sales.' : 'No orders match your search or filter.')
        : Table({ class: 'w-full text-sm', tableClass: 'table-fixed' }, [
            TableHeader({}, [
              TableHCell({ class: 'text-center w-12' }, settleableOrders.length > 0
                ? Row({
                    tagType: 'input',
                    attributes: { type: 'checkbox', checked: allSettleableSelected },
                    events: { click: (e) => { e.stopPropagation(); toggleSelectAllSettleable() } }
                  })
                : ''),
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setWithholdSort('receipt_no') }, [Row({ class: headerLabelWrapClass }, ['Receipt #', sortIcon('receipt_no')])]),
              TableHCell({ class: headerClass, onClick: () => vm.setWithholdSort('customer_name') }, [Row({ class: headerLabelWrapClass }, ['Customer', sortIcon('customer_name')])]),
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setWithholdSort('order_date') }, [Row({ class: headerLabelWrapClass }, ['Date', sortIcon('order_date')])]),
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setWithholdSort('withhold_ref') }, [Row({ class: headerLabelWrapClass }, ['Withhold Ref', sortIcon('withhold_ref')])]),
              TableHCell({ class: `${headerClass} text-right w-28`, onClick: () => vm.setWithholdSort('withhold_amount') }, [Row({ class: `${headerLabelWrapClass} justify-end` }, ['Withhold', sortIcon('withhold_amount')])]),
              TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase w-28' }, 'Status'),
              TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase w-28' }, 'Action')
            ]),
            TableBody({}, [
              ...paginatedOrders.map((order) => {
                const statusBadge = order.withhold_settled
                  ? { label: 'Settled', tone: 'success' }
                  : order.withhold_confirmation
                    ? { label: 'Ready', tone: 'info' }
                    : { label: 'Unconfirmed', tone: 'warning' }
                const settleable = canSettle(order)
                const orderActions = [
                  ActionItem({
                    label: 'View in Sales',
                    icon: 'eye-outline',
                    onClick: () => {
                      props.setLocalState('withholdActionId', null)
                      navigateToSalesOrder(order.id, 'details')
                    }
                  })
                ]
                if (settleable) {
                  orderActions.push(ActionItem({
                    label: 'Settle',
                    icon: 'checkmark-circle-outline',
                    onClick: () => {
                      props.setLocalState('withholdActionId', null)
                      handleSettleOne(order)
                    }
                  }))
                }
                return TableRow({ key: order.id, class: settleable ? 'hover:bg-indigo-50' : '' }, [
                  TableDCell({ class: 'text-center w-12' }, settleable
                    ? Row({
                        tagType: 'input',
                        attributes: {
                          type: 'checkbox',
                          checked: isOrderSelected(order)
                        },
                        events: { click: (e) => { e.stopPropagation(); vm.toggleWithholdOrderSelection(order) } }
                      })
                    : ''),
                  TableDCell({ class: 'w-28' }, order.receipt_no || '—'),
                  TableDCell({}, order.customer_name || '—'),
                  TableDCell({ class: 'w-28' }, formatDateDDMMYYYY(order.order_date)),
                  TableDCell({ class: 'w-24' }, order.withhold_ref || '—'),
                  TableDCell({ class: 'text-right w-28' }, `Br ${financeFormat(order.withhold_amount)}`),
                  TableDCell({ class: 'text-center w-28' }, Badge({ label: statusBadge.label, tone: statusBadge.tone, class: 'text-xs px-2 py-0.5' })),
                  TableDCell({ class: 'text-center w-28' }, ActionDropdown({
                    actionId: order.id,
                    open: order.id === actionId,
                    onToggle: () => props.setLocalState('withholdActionId', actionId === order.id ? null : order.id),
                    class: 'text-center'
                  }, orderActions))
                ])
              }),
              TableRow({ class: 'bg-gray-100 font-semibold' }, [
                TableDCell({ class: 'w-12' }, ''),
                TableDCell({ class: 'w-28' }, ''),
                TableDCell({}, ''),
                TableDCell({ class: 'w-28' }, ''),
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({ class: 'text-right w-28' }, `Br ${financeFormat(paginatedOrders.reduce((s, o) => s + Number(o.withhold_amount || 0), 0))}`),
                TableDCell({ class: 'w-28' }, ''),
                TableDCell({ class: 'w-28' }, '')
              ])
            ])
          ])
    ]),
    vm.getState('withhold-settlement-modal-open') && Row({
      class: 'fixed inset-0 bg-gray-800/50 flex items-center justify-center p-4 z-50',
      attributes: { id: 'withhold-settle-overlay' },
      events: {
        click: (e) => {
          if (e.target?.id === 'withhold-settle-overlay') closeSettleModal()
        }
      }
    }, [
      WithholdSettlementModalContent(vm, vm.getState('withhold-selected-orders') || [], closeSettleModal)
    ])
  ])
}

function WithholdSettlementModalContent(vm, ordersToSettle, handleClose) {
  const totalAmount = (ordersToSettle || []).reduce((s, o) => s + Number(o.withhold_amount || 0), 0)
  const defaultDate = new Date().toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const form = e.target
    const submitBtn = form?.querySelector('.withhold-settle-submit-btn')
    const dateVal = form?.querySelector('[name=settlement_date]')?.value || ''
    const refVal = form?.querySelector('[name=reference_no]')?.value?.trim() || null
    const notesVal = form?.querySelector('[name=notes]')?.value?.trim() || null
    if (!dateVal) {
      showAlert({ message: 'Settlement date is required.', variant: 'error' })
      return
    }
    if (ordersToSettle.length === 0) {
      showAlert({ message: 'No orders to settle.', variant: 'error' })
      return
    }
    if (submitBtn) submitBtn.disabled = true
    vm.updateState('withhold-settlement-submitting', true)
    try {
      await vm.createWithholdReceivableSettlement({
        settlement_date: dateVal,
        sales_order_ids: ordersToSettle.map((o) => o.id),
        reference_no: refVal,
        notes: notesVal
      })
      handleClose()
      showAlert({ message: 'Withhold settlement recorded successfully.', variant: 'success' })
    } catch (err) {
      showAlert({ message: err.message || 'Failed to settle withhold.', variant: 'error' })
      if (submitBtn) submitBtn.disabled = false
    } finally {
      vm.updateState('withhold-settlement-submitting', false)
    }
  }

  return Row({
    tagType: 'form',
    class: 'w-full max-w-lg bg-white rounded-xl shadow-xl p-6 space-y-4',
    events: { submit: handleSubmit },
    attributes: { name: 'withhold-settlement-form' }
  }, [
    Row({ class: 'text-lg font-semibold mb-4' }, 'Settle Withhold Receivables'),
    Row({ class: 'text-sm text-gray-600' }, `${ordersToSettle.length} order(s) · Br ${financeFormat(totalAmount)}`),
    Row({}, [
      Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'settlement_date' } }, 'Settlement date'),
      Input({
        type: 'date',
        class: 'w-full',
        name: 'settlement_date',
        value: defaultDate
      })
    ]),
    Row({}, [
      Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'reference_no' } }, 'Reference no. (optional)'),
      Input({
        type: 'text',
        class: 'w-full',
        name: 'reference_no',
        placeholder: 'Tax authority reference'
      })
    ]),
    Row({}, [
      Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'notes' } }, 'Notes (optional)'),
      Input({
        type: 'text',
        class: 'w-full',
        name: 'notes',
        placeholder: 'Notes'
      })
    ]),
    Row({ class: 'max-h-32 overflow-y-auto border border-gray-200 rounded p-2 text-sm' }, [
      Row({ class: 'font-medium text-gray-600 mb-2' }, 'Orders in this settlement:'),
      ...(ordersToSettle || []).slice(0, 10).map((o) => Row({ class: 'flex justify-between py-1' }, [
        Row({}, `${o.receipt_no || o.id} · ${o.customer_name || '—'}`),
        Row({}, `Br ${financeFormat(o.withhold_amount)}`)
      ])),
      ordersToSettle.length > 10 ? Row({ class: 'text-gray-500 py-1' }, `...and ${ordersToSettle.length - 10} more`) : null
    ].filter(Boolean)),
    Row({ class: 'flex justify-end gap-2 pt-2' }, [
      Button({ type: 'button', variant: 'secondary', onClick: handleClose }, 'Cancel'),
      Button({
        type: 'submit',
        variant: 'primary',
        class: 'withhold-settle-submit-btn',
        disabled: vm.getState('withhold-settlement-submitting')
      }, 'Settle')
    ])
  ])
}