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
import { Card, CardBody, CardHeader, CardFooter } from '../../../utils/Card'
import Badge from '../../../utils/Badge'
import { DropdownSearch, DropdownSearchItem } from '../../../utils/DropdownSearch'
import Drawer from '../../../shared/ExampleDrawer'

const DRAWER_CLOSE_MS = 350
const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function getLoanPayableStatusBadge(status) {
  const s = (status || 'active').toLowerCase()
  if (s === 'repaid') return { label: 'Repaid', tone: 'success' }
  if (s === 'partially_repaid') return { label: 'Partially Repaid', tone: 'warning' }
  return { label: 'Active', tone: 'info' }
}

function filterAndSortTradePayables(orders, search, sortBy, orderBy) {
  let list = [...(orders || [])]
  const searchLower = (search || '').trim().toLowerCase()
  if (searchLower) {
    list = list.filter((o) => {
      const receipt = (o.receipt_no || '').toLowerCase()
      const supplier = (o.supplier_name || '').toLowerCase()
      const dateStr = formatDateDDMMYYYY(o.order_date) || ''
      const amtStr = financeFormat(o.outstanding_balance)
      return `${receipt} ${supplier} ${dateStr} ${amtStr}`.includes(searchLower)
    })
  }
  const by = sortBy || 'order_date'
  const dir = orderBy === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let cmp = 0
    if (by === 'order_date') cmp = new Date(a.order_date || 0) - new Date(b.order_date || 0)
    else if (by === 'receipt_no') cmp = (a.receipt_no || '').localeCompare(b.receipt_no || '')
    else if (by === 'supplier_name') cmp = (a.supplier_name || '').localeCompare(b.supplier_name || '')
    else if (by === 'outstanding_balance') cmp = Number(a.outstanding_balance || 0) - Number(b.outstanding_balance || 0)
    return cmp * dir
  })
  return list
}

function filterAndSortLoansPayable(loans, search, sortBy, orderBy) {
  let list = [...(loans || [])]
  const searchLower = (search || '').trim().toLowerCase()
  if (searchLower) {
    list = list.filter((l) => {
      const ref = (l.reference_no || '').toLowerCase()
      const partner = (l.partner_name || '').toLowerCase()
      const dateStr = formatDateDDMMYYYY(l.borrowed_date) || ''
      const dueStr = formatDateDDMMYYYY(l.expected_repay_date) || ''
      const amtStr = financeFormat(l.amount)
      return `${ref} ${partner} ${dateStr} ${dueStr} ${amtStr}`.includes(searchLower)
    })
  }
  const by = sortBy || 'borrowed_date'
  const dir = orderBy === 'asc' ? 1 : -1
  list.sort((a, b) => {
    const oa = Math.max(0, Number(a.amount || 0) - Number(a.repaid_amount || 0))
    const ob = Math.max(0, Number(b.amount || 0) - Number(b.repaid_amount || 0))
    let cmp = 0
    if (by === 'borrowed_date') cmp = new Date(a.borrowed_date || 0) - new Date(b.borrowed_date || 0)
    else if (by === 'expected_repay_date') cmp = new Date(a.expected_repay_date || 0) - new Date(b.expected_repay_date || 0)
    else if (by === 'partner_name') cmp = (a.partner_name || '').localeCompare(b.partner_name || '')
    else if (by === 'outstanding') cmp = oa - ob
    else if (by === 'status') cmp = (a.status || '').localeCompare(b.status || '')
    return cmp * dir
  })
  return list
}

function filterAndSortWithholdPayables(orders, search, sortBy, orderBy) {
  let list = [...(orders || [])]
  const searchLower = (search || '').trim().toLowerCase()
  if (searchLower) {
    list = list.filter((o) => {
      const receipt = (o.receipt_no || '').toLowerCase()
      const supplier = (o.supplier_name || '').toLowerCase()
      const invoice = (o.invoice_no || '').toLowerCase()
      const dateStr = formatDateDDMMYYYY(o.order_date) || ''
      const amtStr = financeFormat(o.withhold_amount)
      return `${receipt} ${supplier} ${invoice} ${dateStr} ${amtStr}`.includes(searchLower)
    })
  }
  const by = sortBy || 'order_date'
  const dir = orderBy === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let cmp = 0
    if (by === 'order_date') cmp = new Date(a.order_date || 0) - new Date(b.order_date || 0)
    else if (by === 'receipt_no') cmp = (a.receipt_no || '').localeCompare(b.receipt_no || '')
    else if (by === 'supplier_name') cmp = (a.supplier_name || '').localeCompare(b.supplier_name || '')
    else if (by === 'withhold_amount') cmp = Number(a.withhold_amount || 0) - Number(b.withhold_amount || 0)
    return cmp * dir
  })
  return list
}

const TAB_OPTIONS = [
  { key: 'trade', label: 'Trade', icon: 'arrow-down-circle-outline' },
  { key: 'loans', label: 'Loans', icon: 'cash-outline' },
  { key: 'withhold', label: 'Withhold', icon: 'arrow-up-circle-outline' },
]

export function PayablesTab(props) {
  const activeTab = props.viewModel.getState('payables-tab')

  return Row({ class: 'flex flex-col gap-6 flex-1 min-h-0 overflow-hidden bg-white border border-gray-200 rounded-lg' }, [
    CardHeader({ class: 'h-12 bg-gray-100 text-gray-900 text-md font-semibold flex items-center justify-between flex-shrink-0 mb-4' }, [
      Row({ class: 'flex items-center h-full' }, [
        ...TAB_OPTIONS.map((opt) =>
          Row({
            tagType: 'button',
            class: `w-35 h-full flex items-center justify-center gap-2 text-sm font-medium transition ${activeTab === opt.key ? 'border-t-3 border-indigo-600' : 'border-transparent hover:bg-gray-50'}`,
            events: { click: () => props.viewModel.setPayablesTab(opt.key) }
          }, [
            Row({ tagType: 'ion-icon', attributes: { name: opt.icon, class: 'text-lg' } }),
            opt.label
          ])
        ),
      ])
    ]),
    activeTab === 'trade' && TradePayables(props),
    activeTab === 'loans' && LoansPayables(props),
    activeTab === 'withhold' && WithholdPayables(props),
  ])
}

function TradePayables(props) {
  const vm = props.viewModel
  const router = props.router
  const navigationVM = props.navigationVM
  const tradePayables = vm.getState('trade-payables') || { orders: [], total_outstanding: 0 }
  const orders = tradePayables.orders || []
  const totalOutstanding = tradePayables.total_outstanding ?? 0
  const loading = vm.getState('loading')
  const tableConfig = vm.getState('trade-payables-table-config') || { limit: 20, offset: 0, sortBy: 'order_date', orderBy: 'desc' }
  const search = vm.getState('trade-payables-search') || ''
  const sortBy = tableConfig.sortBy || 'order_date'
  const orderBy = tableConfig.orderBy || 'desc'
  const paginationLimit = tableConfig.limit || 20
  const paginationOffset = tableConfig.offset || 0

  const displayedOrders = filterAndSortTradePayables(orders, search, sortBy, orderBy)
  const totalItems = displayedOrders.length
  const initRow = totalItems > 0 ? paginationOffset + 1 : 0
  const endRow = totalItems > 0 ? Math.min(paginationOffset + paginationLimit, totalItems) : 0
  const paginatedOrders = displayedOrders.slice(paginationOffset, paginationOffset + paginationLimit)

  const headerClass = 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer'
  const headerLabelWrapClass = 'inline-flex items-center gap-1 whitespace-nowrap'
  const sortIcon = (col) => (col !== sortBy ? null : IonIcon({ name: orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline', class: 'text-xs shrink-0 font-semibold' }))

  const navigateToPurchaseOrder = (orderId, contentType) => {
    if (!navigationVM || !router) return;
    navigationVM.updateState('pending-purchase-open', { orderId, contentType });
    navigationVM.updateState('active-menu', 'Purchase');
    if (typeof router.navigate === 'function') {
      router.navigate('/purchase');
    } else {
      window.location.hash = '#/purchase';
    }
  }

  props.ensureLocalStateKey('tradePayablesActionId', null)
  const actionId = props.getLocalState('tradePayablesActionId')

  return Row({ class: 'w-full flex flex-col gap-4 flex-1 min-h-0 overflow-hidden' }, [
    Row({ class: 'px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2' }, [
      Row({ tagType: 'span', class: 'text-sm font-semibold text-gray-700' }, 'Total trade payables:'),
      Row({ tagType: 'span', class: 'text-lg font-bold text-indigo-700' }, `Br ${financeFormat(totalOutstanding)}`),
      Row({ tagType: 'span', class: 'text-sm text-gray-500' }, `(${orders.length} order${orders.length !== 1 ? 's' : ''} with outstanding balance)`),
    ]),
    Row({ class: 'flex items-center justify-between gap-6 px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex-1 min-w-[280px] max-w-md' }, [
        Row({ class: 'relative w-full' }, [
          IonIcon({ name: 'search-outline', class: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none' }),
          Input({
            placeholder: 'Search receipt #, supplier, date...',
            class: 'pl-10 pr-4 w-full',
            value: search,
            onChange: (e) => vm.setTradePayablesSearch(e.target.value)
          })
        ])
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({
          name: 'trade-payables-limit',
          onChange: (e) => vm.updateTradePayablesTableConfig({ limit: parseInt(e.target.value, 10), offset: 0 }),
          value: paginationLimit
        }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, totalItems > 0 ? `${initRow}-${endRow} of ${totalItems}` : '0-0 of 0'),
          IconButton({ onClick: () => vm.updateTradePayablesTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) }), disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: () => vm.updateTradePayablesTableConfig({ offset: paginationOffset + paginationLimit }), disabled: paginationOffset + paginationLimit >= totalItems || loading }, [IonIcon({ name: 'caret-forward-outline' })])
        ]),
      ]),
    ]),
    loading ? Row({ class: 'flex items-center gap-2 text-gray-500 px-6 py-4' }, [Spinner({ class: 'w-4 h-4' }), 'Loading...']) : Row({ class: 'flex-1 min-h-0 overflow-auto' }, [
      displayedOrders.length === 0
        ? Row({ class: 'text-gray-500 text-sm py-8 px-6' }, orders.length === 0 ? 'No trade payables. Outstanding balances from purchases appear here.' : 'No orders match your search.')
        : Table({ class: 'w-full text-sm', tableClass: 'table-fixed' }, [
            TableHeader({}, [
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setTradePayablesSort('receipt_no') }, [Row({ class: headerLabelWrapClass }, ['Receipt #', sortIcon('receipt_no')])]),
              TableHCell({ class: headerClass, onClick: () => vm.setTradePayablesSort('supplier_name') }, [Row({ class: headerLabelWrapClass }, ['Supplier', sortIcon('supplier_name')])]),
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setTradePayablesSort('order_date') }, [Row({ class: headerLabelWrapClass }, ['Date', sortIcon('order_date')])]),
              TableHCell({ class: `${headerClass} text-right w-28`, onClick: () => vm.setTradePayablesSort('outstanding_balance') }, [Row({ class: `${headerLabelWrapClass} justify-end` }, ['Outstanding', sortIcon('outstanding_balance')])]),
              TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase w-24' }, 'Action')
            ]),
            TableBody({}, [
              ...paginatedOrders.map((order) =>
                TableRow({ key: order.id }, [
                  TableDCell({ class: 'w-28' }, order.receipt_no),
                  TableDCell({}, order.supplier_name || '—'),
                  TableDCell({ class: 'w-28' }, formatDateDDMMYYYY(order.order_date)),
                  TableDCell({ class: 'text-right w-28' }, `Br ${financeFormat(order.outstanding_balance)}`),
                  TableDCell({ class: 'text-center w-24' }, ActionDropdown({
                    actionId: order.id,
                    open: order.id === actionId,
                    onToggle: () => props.setLocalState('tradePayablesActionId', actionId === order.id ? null : order.id),
                    class: 'text-center'
                  }, [
                    ActionItem({ 
                      label: 'View in Purchase', 
                      icon: 'eye-outline', 
                      onClick: () => { 
                        props.setLocalState('tradePayablesActionId', null); 
                        navigateToPurchaseOrder(order.id, 'details');
                       } 
                    }),
                    ActionItem({ label: 'Make Payment', icon: 'wallet-outline', onClick: () => { props.setLocalState('tradePayablesActionId', null); navigateToPurchaseOrder(order.id, 'payment'); } })
                  ]))
                ])
              ),
              TableRow({ class: 'bg-gray-100 font-semibold' }, [
                TableDCell({ class: 'w-28' }, ''),
                TableDCell({}, ''),
                TableDCell({ class: 'w-28' }, ''),
                TableDCell({ class: 'text-right w-28' }, `Br ${financeFormat(paginatedOrders.reduce((s, o) => s + Number(o.outstanding_balance || 0), 0))}`),
                TableDCell({ class: 'w-24' }, '')
              ])
            ])
          ])
    ])
  ])
}

const LOANS_PAYABLE_STATUS_OPTIONS = ['All', 'Active', 'Partially Repaid', 'Repaid']

function LoansPayables(props) {
  const vm = props.viewModel
  const loansState = vm.getState('loans-payable') || { loans: [], total: 0 }
  const loans = loansState.loans || []
  const loading = vm.getState('loading')
  const tableConfig = vm.getState('loans-payable-table-config') || { limit: 20, offset: 0, sortBy: 'borrowed_date', orderBy: 'desc' }
  const search = vm.getState('loans-payable-search') || ''
  const statusFilter = vm.getState('loans-payable-status-filter') || ''
  const sortBy = tableConfig.sortBy || 'borrowed_date'
  const orderBy = tableConfig.orderBy || 'desc'
  const paginationLimit = tableConfig.limit || 20
  const paginationOffset = tableConfig.offset || 0

  const statusFilterValue = statusFilter === 'active' ? 'Active' : statusFilter === 'partially_repaid' ? 'Partially Repaid' : statusFilter === 'repaid' ? 'Repaid' : 'All'

  const displayedLoans = filterAndSortLoansPayable(loans, search, sortBy, orderBy)
  const totalItems = displayedLoans.length
  const initRow = totalItems > 0 ? paginationOffset + 1 : 0
  const endRow = totalItems > 0 ? Math.min(paginationOffset + paginationLimit, totalItems) : 0
  const paginatedLoans = displayedLoans.slice(paginationOffset, paginationOffset + paginationLimit)

  const totalOutstanding = loans.reduce((s, l) => s + Math.max(0, Number(l.amount || 0) - Number(l.repaid_amount || 0)), 0)
  const activeCount = loans.filter((l) => (l.status || 'active') !== 'repaid').length
  const overdueCount = loans.filter((l) => {
    const due = l.expected_repay_date
    if (!due || (l.status || '') === 'repaid') return false
    return new Date(due) < new Date()
  }).length

  const headerClass = 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer'
  const headerLabelWrapClass = 'inline-flex items-center gap-1 whitespace-nowrap'
  const sortIcon = (col) => (col !== sortBy ? null : IonIcon({ name: orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline', class: 'text-xs shrink-0 font-semibold' }))

  const handleStatusFilter = (v) => vm.setLoansPayableStatusFilter(v === 'All' ? '' : v === 'Active' ? 'active' : v === 'Partially Repaid' ? 'partially_repaid' : 'repaid')

  const openRecordRepaymentModal = (loan) => {
    props.setLocalState('showLoanPayableDrawer', false)
    props.setLocalState('drawerLoanPayableId', null)
    props.setLocalState('selectedLoanPayable', null)
    Modal({}, (delegator, handleClose) => RecordRepaymentModalContent(vm, loan, handleClose, delegator))
  }

  const handleViewLoanPayable = (loan) => {
    props.setLocalState('loansPayableActionId', null)
    props.setLocalState('selectedLoanPayable', loan)
    props.setLocalState('drawerLoanPayableId', loan.id)
    requestAnimationFrame(() => props.setLocalState('showLoanPayableDrawer', true))
  }

  const openCreateLoanPayable = async () => {
    vm.resetLoanPayableForm()
    const list = vm.getState('loan-payable-customer-list') || []
    if (list.length === 0) await vm.loadLoanPayablePartners('')
    vm.updateState('create-loan-payable-modal-open', true)
  }

  const closeCreateLoanPayableModal = () => {
    vm.updateState('create-loan-payable-modal-open', false)
  }

  props.ensureLocalStateKey('loansPayableActionId', null)
  props.ensureLocalStateKey('drawerLoanPayableId', null)
  props.ensureLocalStateKey('showLoanPayableDrawer', false)
  props.ensureLocalStateKey('selectedLoanPayable', null)
  const actionId = props.getLocalState('loansPayableActionId')

  const highlightOverdue = (due) => (!due ? '' : new Date(due) < new Date() ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600')

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
      Button({ variant: 'primary', class: 'text-sm', onClick: openCreateLoanPayable }, 'Create Loan'),
    ]),
    Row({ class: 'flex items-center justify-between gap-6 px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex items-center gap-4 flex-1 flex-wrap' }, [
        Row({ class: 'flex-1 min-w-[200px] max-w-md' }, [
          Row({ class: 'relative w-full' }, [
            IonIcon({ name: 'search-outline', class: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none' }),
            Input({ placeholder: 'Search reference, partner...', class: 'pl-10 pr-4 w-full', value: search, onChange: (e) => vm.setLoansPayableSearch(e.target.value) })
          ])
        ]),
        SelectFluid({ value: statusFilterValue, onChange: (e) => handleStatusFilter(e.target.value), class: 'min-w-[160px] text-sm' }, SelectOptions({ options: LOANS_PAYABLE_STATUS_OPTIONS, selectedOption: statusFilterValue })),
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({ name: 'loans-payable-limit', onChange: (e) => vm.updateLoansPayableTableConfig({ limit: parseInt(e.target.value, 10), offset: 0 }), value: paginationLimit }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, totalItems > 0 ? `${initRow}-${endRow} of ${totalItems}` : '0-0 of 0'),
          IconButton({ onClick: () => vm.updateLoansPayableTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) }), disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: () => vm.updateLoansPayableTableConfig({ offset: paginationOffset + paginationLimit }), disabled: paginationOffset + paginationLimit >= totalItems || loading }, [IonIcon({ name: 'caret-forward-outline' })])
        ]),
      ]),
    ]),
    loading ? Row({ class: 'flex items-center gap-2 text-gray-500 px-6 py-4' }, [Spinner({ class: 'w-4 h-4' }), 'Loading...']) : Row({ class: 'flex-1 min-h-0 overflow-auto' }, [
      displayedLoans.length === 0
        ? Row({ class: 'text-gray-500 text-sm py-8 px-6' }, loans.length === 0 ? 'No cash loans payable.' : 'No loans match your search or filter.')
        : Table({ class: 'w-full text-sm', tableClass: 'table-fixed' }, [
            TableHeader({}, [
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setLoansPayableSort('partner_name') }, [Row({ class: headerLabelWrapClass }, ['Partner', sortIcon('partner_name')])]),
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setLoansPayableSort('borrowed_date') }, [Row({ class: headerLabelWrapClass }, ['Borrowed', sortIcon('borrowed_date')])]),
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setLoansPayableSort('expected_repay_date') }, [Row({ class: headerLabelWrapClass }, ['Due', sortIcon('expected_repay_date')])]),
              TableHCell({ class: `${headerClass} text-right w-24`, onClick: () => vm.setLoansPayableSort('outstanding') }, [Row({ class: `${headerLabelWrapClass} justify-end` }, ['Outstanding', sortIcon('outstanding')])]),
              TableHCell({ class: `${headerClass} w-24`, onClick: () => vm.setLoansPayableSort('status') }, [Row({ class: headerLabelWrapClass }, ['Status', sortIcon('status')])]),
              TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase w-24' }, 'Action')
            ]),
            TableBody({}, [
              ...paginatedLoans.map((loan) => {
                const outstanding = Math.max(0, Number(loan.amount || 0) - Number(loan.repaid_amount || 0))
                const isRepaid = (loan.status || '') === 'repaid'
                const statusBadge = getLoanPayableStatusBadge(loan.status)
                const actions = [ActionItem({ label: 'View', icon: 'eye-outline', onClick: () => handleViewLoanPayable(loan) })]
                if (!isRepaid) actions.push(ActionItem({ label: 'Record Repayment', icon: 'wallet-outline', onClick: () => { props.setLocalState('loansPayableActionId', null); openRecordRepaymentModal(loan) } }))
                return TableRow({ key: loan.id, class: `hover:bg-indigo-50 ${highlightOverdue(loan.expected_repay_date)}` }, [
                  TableDCell({ class: 'w-24' }, loan.partner_name || '—'),
                  TableDCell({ class: 'w-24' }, formatDateDDMMYYYY(loan.borrowed_date)),
                  TableDCell({ class: 'w-24' }, loan.expected_repay_date ? formatDateDDMMYYYY(loan.expected_repay_date) : '—'),
                  TableDCell({ class: 'text-right w-24' }, `Br ${financeFormat(outstanding)}`),
                  TableDCell({ class: 'w-24' }, Badge({ label: statusBadge.label, tone: statusBadge.tone, class: 'text-xs px-2 py-0.5' })),
                  TableDCell({ class: 'text-center w-24' }, ActionDropdown({ actionId: loan.id, open: loan.id === actionId, onToggle: () => props.setLocalState('loansPayableActionId', actionId === loan.id ? null : loan.id), class: 'text-center' }, actions))
                ])
              }),
              TableRow({ class: 'bg-gray-100 font-semibold' }, [
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({ class: 'text-right w-24' }, `Br ${financeFormat(paginatedLoans.reduce((s, l) => s + Math.max(0, Number(l.amount || 0) - Number(l.repaid_amount || 0)), 0))}`),
                TableDCell({ class: 'w-24' }, ''),
                TableDCell({ class: 'w-24' }, '')
              ])
            ])
          ])
    ]),
    props.getLocalState('drawerLoanPayableId') && loanPayableDetailsDrawer({ ...props, openRecordRepaymentModal }),
    vm.getState('create-loan-payable-modal-open') && Row({ class: 'fixed inset-0 bg-gray-800/50 flex items-center justify-center p-4 z-50', attributes: { id: 'create-loan-payable-overlay' }, events: { click: (e) => { if (e.target?.id === 'create-loan-payable-overlay') closeCreateLoanPayableModal() } } }, [CreateLoanPayableModalContent(vm, closeCreateLoanPayableModal)])
  ])
}

function loanPayableDetailsDrawer(props) {
  const showLoanPayableDrawer = props.getLocalState('showLoanPayableDrawer')
  const selectedLoanPayable = props.getLocalState('selectedLoanPayable')
  const openRecordRepaymentModal = props.openRecordRepaymentModal

  const onCloseDrawer = () => {
    props.setLocalState('showLoanPayableDrawer', false)
    setTimeout(() => {
      props.setLocalState('drawerLoanPayableId', null)
      props.setLocalState('selectedLoanPayable', null)
    }, DRAWER_CLOSE_MS)
  }

  return LoanPayableDetailDrawer({
    ...props,
    loan: selectedLoanPayable,
    showSlide: showLoanPayableDrawer,
    onClose: onCloseDrawer,
    onRecordRepayment: openRecordRepaymentModal ? () => openRecordRepaymentModal(selectedLoanPayable) : undefined
  })
}

function LoanPayableDetailDrawer(props) {
  const { loan, showSlide = true, onClose, onRecordRepayment } = props
  if (!loan) return null
  const outstanding = Math.max(0, Number(loan.amount || 0) - Number(loan.repaid_amount || 0))
  const isRepaid = (loan.status || '') === 'repaid'

  return Drawer({ class: 'flex flex-col h-full', openSlide: showSlide }, [
    Card({ class: 'flex flex-col h-full' }, [
      CardHeader({ class: 'flex items-center justify-between px-5 h-12 border-b border-gray-200 flex-shrink-0' }, [
        Row({ class: 'text-base font-semibold text-gray-900' }, `Loan ${loan.reference_no || '—'}`),
        IconButton({ onClick: onClose }, IonIcon({ name: 'close-outline', class: 'text-xl' }))
      ]),
      CardBody({ class: 'flex-1 overflow-y-auto min-h-0 px-5 py-4' }, [
        Row({ class: 'flex flex-col gap-4' }, [
          loanPayableDetailRow('Partner', loan.partner_name || '—'),
          loanPayableDetailRow('Borrowed date', formatDateDDMMYYYY(loan.borrowed_date)),
          loanPayableDetailRow('Due date', loan.expected_repay_date ? formatDateDDMMYYYY(loan.expected_repay_date) : '—'),
          loanPayableDetailRow('Amount', `Br ${financeFormat(loan.amount)}`),
          loanPayableDetailRow('Repaid', `Br ${financeFormat(loan.repaid_amount)}`),
          loanPayableDetailRow('Outstanding', `Br ${financeFormat(outstanding)}`),
          Row({ class: 'flex flex-col gap-0.5' }, [
            Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500' }, 'Status'),
            Row({ class: 'text-sm' }, Badge({ label: getLoanPayableStatusBadge(loan.status).label, tone: getLoanPayableStatusBadge(loan.status).tone, class: 'text-xs px-2 py-0.5 w-fit' }))
          ]),
          loan.notes ? loanPayableDetailRow('Notes', loan.notes) : null
        ].filter(Boolean))
      ]),
      CardFooter({ class: 'flex justify-end gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0' }, [
        Button({ variant: 'secondary', onClick: onClose }, 'Close'),
        !isRepaid && Button({ variant: 'primary', onClick: onRecordRepayment }, 'Record Repayment')
      ].filter(Boolean))
    ])
  ])
}

function loanPayableDetailRow(label, value) {
  return Row({ class: 'flex flex-col gap-0.5' }, [
    Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500' }, label),
    Row({ class: 'text-sm text-gray-900' }, value)
  ])
}

function CreateLoanPayableModalContent(vm, handleClose) {
  const form = vm.getState('loan-payable-form') || {}
  const customerList = vm.getState('loan-payable-customer-list') || []
  const loanPayableDdLoading = vm.getState('loan-payable-partner-dropdown-loading') === true
  const showPartnerDropdown = form.show_partner_dropdown === true
  const partnerDisplay = form.partner ? (form.partner.name || form.partner.full_name || '') : 'Select partner...'
  const partnerSearchValue = showPartnerDropdown ? (form.partner_search || '') : partnerDisplay
  const sortedPartners = [...customerList].filter((c) => (c.name || c.full_name || '').trim().toLowerCase() !== 'walk-in')

  const loanPayableMenuRows = []
  if (loanPayableDdLoading) {
    loanPayableMenuRows.push(Row({ key: 'lp-dd-loading', class: 'px-3 py-2 text-xs text-gray-500 italic' }, 'Searching…'))
  } else if (sortedPartners.length === 0) {
    loanPayableMenuRows.push(
      Row(
        { key: 'lp-dd-empty', class: 'px-3 py-2 text-xs text-gray-500' },
        (form.partner_search || '').trim() ? 'No partners match your search.' : 'Type to search suppliers and both-type partners.'
      )
    )
  } else {
    loanPayableMenuRows.push(
      ...sortedPartners.map((c) =>
        DropdownSearchItem(
          {
            onSelect: () => {
              vm.selectLoanPayablePartner(c)
              vm.updateLoanPayableForm({ show_partner_dropdown: false })
            },
            key: c.id,
            class: 'py-3',
          },
          [Row({ class: 'font-semibold text-gray-900' }, c.name || c.full_name || 'Unknown')]
        )
      )
    )
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!form.partner_id) { showAlert({ message: 'Partner is required.', variant: 'error' }); return }
    const amount = Number(form.amount)
    if (!amount || amount <= 0) { showAlert({ message: 'Amount must be positive.', variant: 'error' }); return }
    if (!form.borrowed_date) { showAlert({ message: 'Borrowed date is required.', variant: 'error' }); return }
    try {
      await vm.createCashLoanPayable({ partner_id: form.partner_id, amount, borrowed_date: form.borrowed_date, expected_repay_date: form.expected_repay_date || null, notes: form.notes || null })
      handleClose()
      showAlert({ message: 'Loan created successfully.', variant: 'success' })
    } catch (err) {
      showAlert({ message: err.message || 'Failed to create loan.', variant: 'error' })
    }
  }

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const fieldClass = 'w-full'

  return Row({ tagType: 'form', class: 'w-full max-w-lg bg-white rounded-xl shadow-xl p-6 space-y-4', events: { submit: handleSubmit } }, [
    Row({ class: 'text-lg font-semibold mb-4' }, 'Create Loan (Borrow from Partner)'),
    Row({}, [
      Row({ tagType: 'label', class: labelClass }, 'Partner'),
      DropdownSearch({
        open: showPartnerDropdown,
        value: partnerSearchValue,
        placeholder: 'Search partners...',
        onInput: (v) => vm.updateLoanPayablePartnerSearch(v),
        onFocus: () => {
          vm.loadLoanPayablePartners(form.partner_search || '')
          vm.updateLoanPayableForm({ show_partner_dropdown: true })
        },
        getOpenState: () => !!(vm.getState('loan-payable-form') || {}).show_partner_dropdown,
        setOpenState: () => vm.updateLoanPayableForm({ show_partner_dropdown: false }),
        class: 'w-full relative'
      }, loanPayableMenuRows)
    ]),
    Row({}, [Row({ tagType: 'label', class: labelClass }, 'Amount (Br)'), Input({ type: 'number', min: '0.01', step: '0.01', class: fieldClass, value: form.amount || '', onChange: (e) => vm.updateLoanPayableForm({ amount: e.target.value }) })]),
    Row({ class: 'grid grid-cols-2 gap-4' }, [
      Row({}, [Row({ tagType: 'label', class: labelClass }, 'Borrowed date'), Input({ type: 'date', class: fieldClass, value: form.borrowed_date || '', onChange: (e) => vm.updateLoanPayableForm({ borrowed_date: e.target.value }) })]),
      Row({}, [Row({ tagType: 'label', class: labelClass }, 'Due date (optional)'), Input({ type: 'date', class: fieldClass, value: form.expected_repay_date || '', onChange: (e) => vm.updateLoanPayableForm({ expected_repay_date: e.target.value }) })]),
    ]),
    Row({}, [Row({ tagType: 'label', class: labelClass }, 'Notes (optional)'), Input({ type: 'text', class: fieldClass, value: form.notes || '', onChange: (e) => vm.updateLoanPayableForm({ notes: e.target.value }), placeholder: 'Reference or notes' })]),
    Row({ class: 'flex justify-end gap-2 pt-2' }, [Button({ type: 'button', variant: 'secondary', onClick: handleClose }, 'Cancel'), Button({ type: 'submit', variant: 'primary' }, 'Create Loan')])
  ])
}

function RecordRepaymentModalContent(vm, loan, handleClose, delegator) {
  const outstanding = Math.max(0, Number(loan.amount || 0) - Number(loan.repaid_amount || 0))
  const defaultDate = new Date().toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const form = e.target
    const amt = Number(form.querySelector('[name=repay-amount]')?.value || 0)
    const dateVal = form.querySelector('[name=repay-date]')?.value || ''
    if (!amt || amt <= 0) { showAlert({ message: 'Amount must be positive.', variant: 'error' }); return }
    if (amt > outstanding) { showAlert({ message: `Amount cannot exceed outstanding (Br ${financeFormat(outstanding)}).`, variant: 'error' }); return }
    if (!dateVal) { showAlert({ message: 'Repayment date is required.', variant: 'error' }); return }
    const submitBtn = form.querySelector('.repay-submit-btn')
    if (submitBtn) submitBtn.disabled = true
    try {
      await vm.recordCashLoanPayableRepayment(loan.id, { amount: amt, repay_date: dateVal })
      handleClose()
      showAlert({ message: 'Repayment recorded successfully.', variant: 'success' })
    } catch (err) {
      showAlert({ message: err.message || 'Failed to record repayment.', variant: 'error' })
      if (submitBtn) submitBtn.disabled = false
    }
  }

  return Row({ tagType: 'form', class: 'w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4', events: { submit: handleSubmit }, attributes: { name: 'record-repay-form' }, delegator }, [
    Row({ class: 'text-lg font-semibold mb-4' }, `Record Repayment – ${loan.partner_name || 'Partner'}`),
    Row({}, [Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'repay-amount' } }, 'Amount (Br)'), Input({ type: 'number', min: '0.01', step: '0.01', max: String(outstanding), class: 'w-full', name: 'repay-amount', value: String(outstanding), delegator })]),
    Row({}, [Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'repay-date' } }, 'Repayment date'), Input({ type: 'date', class: 'w-full', name: 'repay-date', value: defaultDate, delegator })]),
    Row({ class: 'text-sm text-gray-500' }, `Outstanding: Br ${financeFormat(outstanding)}`),
    Row({ class: 'flex justify-end gap-2' }, [
      Button({ type: 'button', variant: 'secondary', onClick: handleClose, delegator }, 'Cancel'),
      Button({
        type: 'button',
        variant: 'primary',
        class: 'repay-submit-btn',
        onClick: (e) => { e.preventDefault(); e.target.closest('form')?.requestSubmit() },
        delegator
      }, 'Record Repayment')
    ])
  ])
}

const WITHHOLD_PAYABLES_STATUS_OPTIONS = [
  { key: 'unsettled', label: 'Ready to settle' },
  { key: 'settled', label: 'Settled' },
  { key: '', label: 'All' }
]

function WithholdPayables(props) {
  const vm = props.viewModel
  const router = props.router
  const navigationVM = props.navigationVM
  const withholdState = vm.getState('withhold-payables') || { orders: [], total: 0, stats: {} }
  const orders = withholdState.orders || []
  const stats = withholdState.stats || {}
  const totalUnsettled = stats.total_unsettled ?? 0
  const countUnsettled = stats.count_unsettled ?? 0
  const countSettled = stats.count_settled ?? 0
  const loading = vm.getState('loading')
  const tableConfig = vm.getState('withhold-payables-table-config') || { limit: 20, offset: 0, sortBy: 'order_date', orderBy: 'desc' }
  const search = vm.getState('withhold-payables-search') || ''
  const statusFilter = vm.getState('withhold-payables-status-filter') || 'unsettled'
  const dateFrom = vm.getState('withhold-payables-date-from') || ''
  const dateTo = vm.getState('withhold-payables-date-to') || ''
  const sortBy = tableConfig.sortBy || 'order_date'
  const orderBy = tableConfig.orderBy || 'desc'
  const paginationLimit = tableConfig.limit || 20
  const paginationOffset = tableConfig.offset || 0
  const selectedOrders = vm.getState('withhold-payables-selected-orders') || []

  const displayedOrders = filterAndSortWithholdPayables(orders, search, sortBy, orderBy)
  const totalItems = displayedOrders.length
  const initRow = totalItems > 0 ? paginationOffset + 1 : 0
  const endRow = totalItems > 0 ? Math.min(paginationOffset + paginationLimit, totalItems) : 0
  const paginatedOrders = displayedOrders.slice(paginationOffset, paginationOffset + paginationLimit)
  const settleableOrders = displayedOrders.filter((o) => !o.withhold_settled)
  const selectedSettleable = selectedOrders.filter((o) => !o.withhold_settled)

  const headerClass = 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer'
  const headerLabelWrapClass = 'inline-flex items-center gap-1 whitespace-nowrap'
  const sortIcon = (col) => (col !== sortBy ? null : IonIcon({ name: orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline', class: 'text-xs shrink-0 font-semibold' }))

  const statusLabelToKey = { 'Ready to settle': 'unsettled', 'Settled': 'settled', 'All': '' }
  const statusKeyToLabel = { unsettled: 'Ready to settle', settled: 'Settled', '': 'All' }
  const handleStatusFilter = (label) => vm.setWithholdPayablesStatusFilter(statusLabelToKey[label] ?? statusFilter)

  const openSettleModal = (ordersToSettle) => {
    vm.setWithholdPayablesSelectedOrders(ordersToSettle)
    vm.updateState('withhold-payables-settlement-modal-open', true)
  }

  const closeSettleModal = () => {
    vm.updateState('withhold-payables-settlement-modal-open', false)
    vm.setWithholdPayablesSelectedOrders([])
  }

  const handleSettleOne = (order) => {
    if (!order.withhold_settled) openSettleModal([order])
  }

  const handleSettleSelected = () => {
    if (selectedSettleable.length === 0) { showAlert({ message: 'Select at least one order to settle.', variant: 'error' }); return }
    openSettleModal(selectedSettleable)
  }

  const handleSettleAll = () => {
    if (settleableOrders.length === 0) { showAlert({ message: 'No orders ready to settle.', variant: 'error' }); return }
    openSettleModal(settleableOrders)
  }

  const handleSelectByDateRange = () => {
    if (!dateFrom && !dateTo) { showAlert({ message: 'Select at least a From or To date.', variant: 'error' }); return }
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : Number.MAX_SAFE_INTEGER
    const inRange = settleableOrders.filter((o) => { const d = new Date(o.order_date || 0).getTime(); return d >= fromTs && d <= toTs })
    vm.setWithholdPayablesSelectedOrders(inRange)
    if (inRange.length === 0) showAlert({ message: 'No orders in the selected date range.', variant: 'info' })
  }

  const isOrderSelected = (order) => selectedOrders.some((o) => o.id === order.id)
  const canSettle = (order) => !order.withhold_settled
  const allSettleableSelected = settleableOrders.length > 0 && selectedSettleable.length === settleableOrders.length
  const toggleSelectAllSettleable = () => { if (allSettleableSelected) vm.setWithholdPayablesSelectedOrders([]); else vm.setWithholdPayablesSelectedOrders(settleableOrders) }

  props.ensureLocalStateKey('withholdPayablesActionId', null)
  const actionId = props.getLocalState('withholdPayablesActionId')

  return Row({ class: 'w-full flex flex-col gap-4 flex-1 min-h-0 overflow-hidden' }, [
    Row({ class: 'px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-4 flex-wrap' }, [
      Row({ class: 'flex items-center gap-4 flex-wrap' }, [
        Row({ class: 'flex items-center gap-2' }, [
          Row({ tagType: 'span', class: 'text-sm font-semibold text-gray-700' }, 'Total unsettled:'),
          Row({ tagType: 'span', class: 'text-lg font-bold text-indigo-700' }, `Br ${financeFormat(totalUnsettled)}`),
        ]),
        Row({ tagType: 'span', class: 'text-sm text-gray-500' }, `${countUnsettled} ready to settle`),
        Row({ tagType: 'span', class: 'text-sm text-gray-500' }, `${countSettled} settled`),
      ]),
      Row({ class: 'flex items-center gap-2' }, [
        settleableOrders.length > 0 && Button({ variant: 'primary', class: 'text-sm', onClick: handleSettleAll }, `Settle all (${settleableOrders.length})`),
        selectedSettleable.length > 0 && Button({ variant: 'outline', class: 'text-sm', onClick: handleSettleSelected }, `Settle selected (${selectedSettleable.length})`)
      ].filter(Boolean)),
    ]),
    Row({ class: 'flex items-center justify-between gap-4 px-6 py-3 border-b border-gray-200 bg-gray-50' }, [
      SelectCompact({ name: 'withhold-payables-status', value: statusKeyToLabel[statusFilter] || 'Ready to settle', onChange: (e) => handleStatusFilter(e.target.value), containerClass: 'text-sm' }, SelectOptions({ options: WITHHOLD_PAYABLES_STATUS_OPTIONS.map((o) => o.label), selectedOption: statusKeyToLabel[statusFilter] || 'Ready to settle' })),
      Row({ class: 'flex items-center gap-3' }, [
        Row({ class: 'flex items-center gap-2' }, [Row({ tagType: 'label', class: 'text-sm text-gray-500 whitespace-nowrap' }, 'From:'), Input({ type: 'date', class: 'w-36 text-sm py-1.5', value: dateFrom, onChange: (e) => vm.setWithholdPayablesDateFrom(e.target.value) })]),
        Row({ class: 'flex items-center gap-2' }, [Row({ tagType: 'label', class: 'text-sm text-gray-500 whitespace-nowrap' }, 'To:'), Input({ type: 'date', class: 'w-36 text-sm py-1.5', value: dateTo, onChange: (e) => vm.setWithholdPayablesDateTo(e.target.value) })]),
        settleableOrders.length > 0 && Button({ variant: 'outline', class: 'text-sm', onClick: handleSelectByDateRange }, 'Select by range')
      ].filter(Boolean)),
    ]),
    Row({ class: 'flex items-center justify-between gap-6 px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex-1 min-w-[200px] max-w-md' }, [
        Row({ class: 'relative w-full' }, [IonIcon({ name: 'search-outline', class: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none' }), Input({ placeholder: 'Search receipt, supplier, invoice...', class: 'pl-10 pr-4 w-full', value: search, onChange: (e) => vm.setWithholdPayablesSearch(e.target.value) })])
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({ name: 'withhold-payables-limit', onChange: (e) => vm.updateWithholdPayablesTableConfig({ limit: parseInt(e.target.value, 10), offset: 0 }), value: paginationLimit }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, totalItems > 0 ? `${initRow}-${endRow} of ${totalItems}` : '0-0 of 0'), IconButton({ onClick: () => vm.updateWithholdPayablesTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) }), disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]), IconButton({ onClick: () => vm.updateWithholdPayablesTableConfig({ offset: paginationOffset + paginationLimit }), disabled: paginationOffset + paginationLimit >= totalItems || loading }, [IonIcon({ name: 'caret-forward-outline' })])]),
      ]),
    ]),
    loading ? Row({ class: 'flex items-center gap-2 text-gray-500 px-6 py-4' }, [Spinner({ class: 'w-4 h-4' }), 'Loading...']) : Row({ class: 'flex-1 min-h-0 overflow-auto' }, [
      displayedOrders.length === 0
        ? Row({ class: 'text-gray-500 text-sm py-8 px-6' }, orders.length === 0 ? 'No withhold payables. Purchases with withhold appear here.' : 'No orders match your search or filter.')
        : Table({ class: 'w-full text-sm', tableClass: 'table-fixed' }, [
            TableHeader({}, [
              TableHCell({ class: 'text-center w-12' }, settleableOrders.length > 0 ? Row({ tagType: 'input', attributes: { type: 'checkbox', checked: allSettleableSelected }, events: { click: (e) => { e.stopPropagation(); toggleSelectAllSettleable() } } }) : ''),
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setWithholdPayablesSort('receipt_no') }, [Row({ class: headerLabelWrapClass }, ['Receipt #', sortIcon('receipt_no')])]),
              TableHCell({ class: headerClass, onClick: () => vm.setWithholdPayablesSort('supplier_name') }, [Row({ class: headerLabelWrapClass }, ['Supplier', sortIcon('supplier_name')])]),
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setWithholdPayablesSort('order_date') }, [Row({ class: headerLabelWrapClass }, ['Date', sortIcon('order_date')])]),
              TableHCell({ class: `${headerClass} w-24` }, 'Invoice #'),
              TableHCell({ class: `${headerClass} text-right w-28`, onClick: () => vm.setWithholdPayablesSort('withhold_amount') }, [Row({ class: `${headerLabelWrapClass} justify-end` }, ['Withhold', sortIcon('withhold_amount')])]),
              TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase w-28' }, 'Status'),
              TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase w-28' }, 'Action')
            ]),
            TableBody({}, [
              ...paginatedOrders.map((order) => {
                const statusBadge = order.withhold_settled ? { label: 'Settled', tone: 'success' } : { label: 'Ready', tone: 'info' }
                const settleable = canSettle(order)
                const orderActions = [ActionItem({ label: 'View in Purchase', icon: 'eye-outline', onClick: () => { props.setLocalState('withholdPayablesActionId', null); if (navigationVM && router) { navigationVM.updateState('pending-purchase-open', { orderId: order.id, contentType: 'details' }); navigationVM.updateState('active-menu', 'Purchase'); router.navigate('/purchase'); } } })]
                if (settleable) orderActions.push(ActionItem({ label: 'Settle', icon: 'checkmark-circle-outline', onClick: () => { props.setLocalState('withholdPayablesActionId', null); handleSettleOne(order) } }))
                return TableRow({ key: order.id, class: settleable ? 'hover:bg-indigo-50' : '' }, [
                  TableDCell({ class: 'text-center w-12' }, settleable ? Row({ tagType: 'input', attributes: { type: 'checkbox', checked: isOrderSelected(order) }, events: { click: (e) => { e.stopPropagation(); vm.toggleWithholdPayablesOrderSelection(order) } } }) : ''),
                  TableDCell({ class: 'w-28' }, order.receipt_no || '—'),
                  TableDCell({}, order.supplier_name || '—'),
                  TableDCell({ class: 'w-28' }, formatDateDDMMYYYY(order.order_date)),
                  TableDCell({ class: 'w-24' }, order.invoice_no || '—'),
                  TableDCell({ class: 'text-right w-28' }, `Br ${financeFormat(order.withhold_amount)}`),
                  TableDCell({ class: 'text-center w-28' }, Badge({ label: statusBadge.label, tone: statusBadge.tone, class: 'text-xs px-2 py-0.5' })),
                  TableDCell({ class: 'text-center w-28' }, ActionDropdown({ actionId: order.id, open: order.id === actionId, onToggle: () => props.setLocalState('withholdPayablesActionId', actionId === order.id ? null : order.id), class: 'text-center' }, orderActions))
                ])
              }),
              TableRow({ class: 'bg-gray-100 font-semibold' }, [TableDCell({ class: 'w-12' }, ''), TableDCell({ class: 'w-28' }, ''), TableDCell({}, ''), TableDCell({ class: 'w-28' }, ''), TableDCell({ class: 'w-24' }, ''), TableDCell({ class: 'text-right w-28' }, `Br ${financeFormat(paginatedOrders.reduce((s, o) => s + Number(o.withhold_amount || 0), 0))}`), TableDCell({ class: 'w-28' }, ''), TableDCell({ class: 'w-28' }, '')])
            ])
          ])
    ]),
    vm.getState('withhold-payables-settlement-modal-open') && Row({ class: 'fixed inset-0 bg-gray-800/50 flex items-center justify-center p-4 z-50', attributes: { id: 'withhold-pay-settle-overlay' }, events: { click: (e) => { if (e.target?.id === 'withhold-pay-settle-overlay') closeSettleModal() } } }, [WithholdPayableSettlementModalContent(vm, vm.getState('withhold-payables-selected-orders') || [], closeSettleModal)])
  ])
}

function WithholdPayableSettlementModalContent(vm, ordersToSettle, handleClose) {
  const totalAmount = (ordersToSettle || []).reduce((s, o) => s + Number(o.withhold_amount || 0), 0)
  const defaultDate = new Date().toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const form = e.target
    const dateVal = form?.querySelector('[name=settlement_date]')?.value || ''
    const refVal = form?.querySelector('[name=reference_no]')?.value?.trim() || null
    const notesVal = form?.querySelector('[name=notes]')?.value?.trim() || null
    if (!dateVal) { showAlert({ message: 'Settlement date is required.', variant: 'error' }); return }
    if (ordersToSettle.length === 0) { showAlert({ message: 'No orders to settle.', variant: 'error' }); return }
    const submitBtn = form?.querySelector('.withhold-pay-settle-submit-btn')
    if (submitBtn) submitBtn.disabled = true
    vm.updateState('withhold-payables-settlement-submitting', true)
    try {
      await vm.createWithholdPayableSettlement({ settlement_date: dateVal, purchase_order_ids: ordersToSettle.map((o) => o.id), reference_no: refVal, notes: notesVal })
      handleClose()
      showAlert({ message: 'Withhold payable settlement recorded successfully.', variant: 'success' })
    } catch (err) {
      showAlert({ message: err.message || 'Failed to settle withhold.', variant: 'error' })
      if (submitBtn) submitBtn.disabled = false
    } finally {
      vm.updateState('withhold-payables-settlement-submitting', false)
    }
  }

  return Row({ tagType: 'form', class: 'w-full max-w-lg bg-white rounded-xl shadow-xl p-6 space-y-4', events: { submit: handleSubmit }, attributes: { name: 'withhold-payable-settlement-form' } }, [
    Row({ class: 'text-lg font-semibold mb-4' }, 'Settle Withhold Payables'),
    Row({ class: 'text-sm text-gray-600' }, `${ordersToSettle.length} order(s) · Br ${financeFormat(totalAmount)}`),
    Row({}, [Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'settlement_date' } }, 'Settlement date'), Input({ type: 'date', class: 'w-full', name: 'settlement_date', value: defaultDate })]),
    Row({}, [Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'reference_no' } }, 'Reference no. (optional)'), Input({ type: 'text', class: 'w-full', name: 'reference_no', placeholder: 'Tax authority reference' })]),
    Row({}, [Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-1', attributes: { for: 'notes' } }, 'Notes (optional)'), Input({ type: 'text', class: 'w-full', name: 'notes', placeholder: 'Notes' })]),
    Row({ class: 'max-h-32 overflow-y-auto border border-gray-200 rounded p-2 text-sm' }, [Row({ class: 'font-medium text-gray-600 mb-2' }, 'Orders in this settlement:'), ...(ordersToSettle || []).slice(0, 10).map((o) => Row({ class: 'flex justify-between py-1' }, [Row({}, `${o.receipt_no || '—'} · ${o.supplier_name || '—'}`), Row({}, `Br ${financeFormat(o.withhold_amount)}`)])), ordersToSettle.length > 10 ? Row({ class: 'text-gray-500 py-1' }, `...and ${ordersToSettle.length - 10} more`) : null].filter(Boolean)),
    Row({ class: 'flex justify-end gap-2 pt-2' }, [Button({ type: 'button', variant: 'secondary', onClick: handleClose }, 'Cancel'), Button({ type: 'submit', variant: 'primary', class: 'withhold-pay-settle-submit-btn', disabled: vm.getState('withhold-payables-settlement-submitting') }, 'Settle')])
  ])
}
