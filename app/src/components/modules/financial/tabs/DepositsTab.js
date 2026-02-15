const { Row } = Liteframe
import { Button, Spinner } from '../../../utils/Button'
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table'
import { Input } from '../../../utils/Input'
import { SelectFluid, SelectOptions, SelectRelative, SelectCompact } from '../../../utils/Select'
import { showAlert, showConfirmation } from '../../../utils/ModalHelpers'
import { IonIcon, IconButton } from '../../../utils/Icon'
import { ActionDropdown, ActionItem } from '../../../utils/Action'
import { formatDateDDMMYYYY } from '../../../utils/DateUtils'
import Drawer from '../../../shared/ExampleDrawer'
import { Card, CardBody, CardHeader, CardFooter } from '../../../utils/Card'

const DRAWER_CLOSE_MS = 350
const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const DEPOSIT_TYPES = [
  { value: 'contribution', label: 'Contribution' },
  { value: 'initial_seed', label: 'Initial Seed' },
  { value: 'capital_injection', label: 'Capital Injection' },
  { value: 'donation', label: 'Donation' },
  { value: 'grant', label: 'Grant' },
  { value: 'interest_income', label: 'Interest Income' },
  { value: 'other_revenue', label: 'Other Revenue' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'other', label: 'Other' }
]

const DEPOSIT_TYPE_LABELS = Object.fromEntries(DEPOSIT_TYPES.map((t) => [t.value, t.label]))
const DEPOSIT_LABEL_TO_VALUE = { 'All types': '', ...Object.fromEntries(DEPOSIT_TYPES.map((t) => [t.label, t.value])) }

function filterAndSortDeposits(deposits, search, typeFilter, sortBy, orderBy) {
  let list = [...(deposits || [])]
  const searchLower = (search || '').trim().toLowerCase()
  if (searchLower) {
    list = list.filter((d) => {
      const dateStr = formatDateDDMMYYYY(d.deposit_date) || ''
      const typeStr = (DEPOSIT_TYPE_LABELS[d.type] || d.type || '').toLowerCase()
      const amtStr = financeFormat(d.amount)
      const sourceStr = (d.source || '').toLowerCase()
      const descStr = (d.description || '').toLowerCase()
      const refStr = (d.reference_no || '').toLowerCase()
      return `${dateStr} ${typeStr} ${amtStr} ${sourceStr} ${descStr} ${refStr}`.includes(searchLower)
    })
  }
  if (typeFilter && typeFilter.trim()) {
    list = list.filter((d) => (d.type || '') === typeFilter.trim())
  }
  const by = sortBy || 'deposit_date'
  const dir = orderBy === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let cmp = 0
    if (by === 'deposit_date') cmp = new Date(a.deposit_date || 0) - new Date(b.deposit_date || 0)
    else if (by === 'type') cmp = (a.type || '').localeCompare(b.type || '')
    else if (by === 'amount') cmp = Number(a.amount || 0) - Number(b.amount || 0)
    else if (by === 'source') cmp = (a.source || '').localeCompare(b.source || '')
    else if (by === 'description') cmp = (a.description || '').localeCompare(b.description || '')
    return cmp * dir
  })
  return list
}

export function DepositsTab(props) {
  const vm = props.viewModel
  const deposits = vm.getState('deposits') || []
  const total = vm.getState('deposit-total') ?? 0
  const depositStats = vm.getState('deposit-stats') || {}
  const tableConfig = vm.getState('deposit-table-config') || { limit: 20, offset: 0, sortBy: 'deposit_date', orderBy: 'desc' }
  const search = vm.getState('deposit-search') || ''
  const typeFilter = vm.getState('deposit-type-filter') || ''
  const dateFrom = vm.getState('deposit-date-from') || ''
  const dateTo = vm.getState('deposit-date-to') || ''
  const statsCollapsed = vm.getState('deposit-stats-collapsed') === true
  const sortBy = tableConfig.sortBy || 'deposit_date'
  const orderBy = tableConfig.orderBy || 'desc'
  const paginationLimit = tableConfig.limit || 20
  const paginationOffset = tableConfig.offset || 0
  const loading = vm.getState('loading')
  const error = vm.getState('error')
  const drawerDepositId = vm.getState('drawer-deposit-id')
  const showDepositDrawer = vm.getState('show-deposit-drawer')
  const selectedDeposit = vm.getState('selected-deposit')
  const createDepositModalOpen = vm.getState('create-deposit-modal-open') === true
  const createDepositSubmitting = vm.getState('create-deposit-submitting') === true

  const displayedDeposits = filterAndSortDeposits(deposits, search, typeFilter, sortBy, orderBy)
  const initRow = total > 0 ? paginationOffset + 1 : 0
  const endRow = total > 0 ? Math.min(paginationOffset + paginationLimit, total) : 0

  const sortIcon = (col) => (col !== sortBy ? null : IonIcon({ name: orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline', class: 'text-xs shrink-0 font-semibold' }))
  const headerClass = 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer'
  const headerLabelWrapClass = 'inline-flex items-center gap-1 whitespace-nowrap'

  const handleSetLimit = (n) => vm.updateDepositTableConfig({ limit: n, offset: 0 })
  const handlePrevPage = () => vm.updateDepositTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) })
  const handleNextPage = () => vm.updateDepositTableConfig({ offset: paginationOffset + paginationLimit })
  const hasNextPage = paginationOffset + paginationLimit < total

  const openCreateDepositModal = () => {
    vm.updateState('deposit-form', {
      deposit_date: new Date().toISOString().split('T')[0],
      type: 'contribution',
      amount: '',
      description: '',
      source: '',
      reference_no: ''
    })
    vm.updateState('create-deposit-submitting', false)
    vm.updateState('create-deposit-modal-open', true)
  }

  const closeCreateDepositModal = () => {
    vm.updateState('create-deposit-modal-open', false)
    vm.updateState('create-deposit-submitting', false)
  }

  const handleViewDeposit = (d) => {
    vm.openDepositDrawer(d)
  }

  const handleReverseDeposit = async (d) => {
    props.setLocalState('depositActionId', null)
    try {
      const confirmed = await showConfirmation({
        title: 'Reverse Deposit',
        message: `Reverse deposit #${d.id} (${DEPOSIT_TYPE_LABELS[d.type] || d.type}, Br ${financeFormat(d.amount)})? This will create reversing ledger entries.`,
        variant: 'warning'
      })
      if (!confirmed) return
      await vm.reverseDeposit(d.id)
      showAlert({ message: 'Deposit reversed successfully.', variant: 'success' })
    } catch (e) {
      showAlert({ message: e.message || 'Failed to reverse deposit.', variant: 'error' })
    }
  }

  const statCards = buildStatCards(depositStats, typeFilter, (type) => vm.setDepositTypeFilter(type))

  props.ensureLocalStateKey('depositActionId', null)
  const actionId = props.getLocalState('depositActionId')

  const depositDetailsDrawer = drawerDepositId && selectedDeposit ? (
    Drawer({ openSlide: showDepositDrawer, class: 'flex flex-col h-full' }, [
      Card({ class: 'flex flex-col h-full rounded-none border-0' }, [
        CardHeader({ class: 'flex items-center justify-between px-5 h-12 border-b border-gray-200 flex-shrink-0' }, [
          Row({ class: 'text-base font-semibold text-gray-900' }, 'Deposit Details'),
          IconButton({ onClick: () => vm.closeDepositDrawer() }, [IonIcon({ name: 'close-outline', class: 'text-xl' })])
        ]),
        CardBody({ class: 'flex-1 overflow-y-auto min-h-0 px-5 py-4' }, [
          DepositDetailContent({ deposit: selectedDeposit })
        ])
      ])
    ])
  ) : null

  return Row({ class: 'flex flex-col gap-1 flex-1 min-h-0 overflow-hidden border border-gray-200 rounded-lg bg-white' }, [
    // Stats section (collapsible)
    Row({ class: 'border-b border-gray-200 flex-shrink-0' }, [
      Row({
        class: 'flex items-center justify-between px-4 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100',
        events: { click: () => vm.toggleDepositStatsCollapsed() }
      }, [
        Row({ class: 'flex items-center gap-2' }, [
          Row({ class: 'text-sm font-semibold text-gray-700' }, 'Deposit Stats by Source'),
          IconButton({ onClick: (e) => { e.stopPropagation(); vm.toggleDepositStatsCollapsed() } }, [
            IonIcon({ name: statsCollapsed ? 'chevron-down-outline' : 'chevron-up-outline', class: 'text-lg' })
          ])
        ]),
      ]),
      statsCollapsed ? null : Row({ class: 'px-4 py-2 flex flex-wrap gap-2' }, statCards)
    ]),
    // Toolbar: type filter + add button
    Row({ class: 'flex justify-between items-center px-4 py-2 gap-2 flex-shrink-0' }, [
      SelectCompact({
        value: typeFilter === '' ? 'All types' : (DEPOSIT_TYPE_LABELS[typeFilter] || typeFilter),
        onChange: (e) => vm.setDepositTypeFilter(DEPOSIT_LABEL_TO_VALUE[e.target.value] ?? ''),
        containerClass: 'text-sm'
      }, SelectOptions({
        options: ['All types', ...DEPOSIT_TYPES.map((t) => t.label)],
        selectedOption: typeFilter === '' ? 'All types' : (DEPOSIT_TYPE_LABELS[typeFilter] || typeFilter)
      })),
      Button({ variant: 'primary', onClick: openCreateDepositModal, class: 'text-sm' }, 'Add Deposit')
    ]),
    // Date range filter row
    Row({ class: 'flex items-center justify-between gap-4 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0' }, [
      Row({ class: 'flex items-center gap-4' }, [
        Row({ class: 'flex items-center gap-2' }, [
          Row({ tagType: 'label', class: 'text-sm text-gray-500 whitespace-nowrap' }, 'From:'),
          Input({
            type: 'date',
            class: 'w-36 text-sm py-1.5',
            value: dateFrom,
            onChange: (e) => vm.setDepositDateFrom(e.target.value)
          })
        ]),
        Row({ class: 'flex items-center gap-2' }, [
          Row({ tagType: 'label', class: 'text-sm text-gray-500 whitespace-nowrap' }, 'To:'),
          Input({
            type: 'date',
            class: 'w-36 text-sm py-1.5',
            value: dateTo,
            onChange: (e) => vm.setDepositDateTo(e.target.value)
          })
        ])
      ])
    ]),
    error && Row({ class: 'text-sm text-red-600 bg-red-50 px-4 py-1.5 flex-shrink-0' }, error),
    Row({ class: 'flex items-center justify-between gap-4 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0' }, [
      Row({ class: 'flex-1 min-w-[200px] max-w-md' }, [
        Row({ class: 'relative w-full' }, [
          IonIcon({ name: 'search-outline', class: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none' }),
          Input({
            placeholder: 'Search date, type, amount, source...',
            value: search,
            class: 'pl-10 pr-4 w-full',
            onChange: (e) => vm.setDepositSearch(e.target.value)
          })
        ])
      ]),
      Row({ class: 'flex items-center gap-2' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({
          name: 'deposit-limit',
          onChange: (e) => handleSetLimit(parseInt(e.target.value, 10)),
          value: paginationLimit
        }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400' }, total > 0 ? `${initRow}-${endRow} of ${total}` : '0-0 of 0'),
          IconButton({ onClick: handlePrevPage, disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: handleNextPage, disabled: !hasNextPage || loading }, [IonIcon({ name: 'caret-forward-outline' })])
        ])
      ])
    ]),
    loading ? Row({ class: 'flex items-center gap-2 px-4 py-4 text-gray-500' }, [Spinner({ class: 'w-5 h-5' }), 'Loading...']) : (
      displayedDeposits.length === 0
        ? Row({ class: 'text-gray-500 text-sm py-8 text-center px-4' }, 'No deposits found. Click "Add Deposit" to create one.')
        : Row({ class: 'flex-1 min-h-0 overflow-auto px-4' }, [
            Table({ class: 'w-full text-sm' }, [
              TableHeader({}, [
                TableHCell({ class: headerClass, events: { click: () => vm.setDepositSort('deposit_date') } }, [
                  Row({ class: headerLabelWrapClass }, ['Date', sortIcon('deposit_date')])
                ]),
                TableHCell({ class: headerClass, events: { click: () => vm.setDepositSort('type') } }, [
                  Row({ class: headerLabelWrapClass }, ['Type', sortIcon('type')])
                ]),
                TableHCell({ class: headerClass, events: { click: () => vm.setDepositSort('amount') } }, [
                  Row({ class: headerLabelWrapClass }, ['Amount', sortIcon('amount')])
                ]),
                TableHCell({}, 'Source'),
                TableHCell({}, 'Reference'),
                TableHCell({ class: 'max-w-xs truncate' }, 'Description'),
                TableHCell({}, '')
              ]),
              TableBody({}, displayedDeposits.map((d) =>
                TableRow({ key: d.id }, [
                  TableDCell({}, formatDateDDMMYYYY(d.deposit_date) || d.deposit_date || '—'),
                  TableDCell({}, DEPOSIT_TYPE_LABELS[d.type] || d.type?.replace(/_/g, ' ') || '—'),
                  TableDCell({}, `Br ${financeFormat(d.amount)}`),
                  TableDCell({}, d.source || '—'),
                  TableDCell({}, d.reference_no || '—'),
                  TableDCell({ class: 'max-w-xs truncate' }, d.description || '—'),
                  TableDCell({ class: 'w-12' }, [
                    ActionDropdown({
                      actionId: d.id,
                      open: actionId === d.id,
                      onToggle: () => props.setLocalState('depositActionId', actionId === d.id ? null : d.id),
                      class: 'text-center'
                    }, [
                      ActionItem({ label: 'View', icon: 'eye-outline', onClick: () => { props.setLocalState('depositActionId', null); handleViewDeposit(d) } }),
                      ActionItem({ label: 'Reverse', icon: 'arrow-undo-outline', danger: true, onClick: () => handleReverseDeposit(d) })
                    ])
                  ])
                ])
              ))
            ])
          ])
    ),
    depositDetailsDrawer,
    createDepositModalOpen && Row({
      class: 'fixed inset-0 bg-gray-800/50 flex items-center justify-center p-4 z-50',
      attributes: { id: 'create-deposit-modal-backdrop' },
      events: {
        click: (e) => { if (e.target.id === 'create-deposit-modal-backdrop') closeCreateDepositModal() }
      }
    }, [
      CreateDepositModalContent({
        ...props,
        handleClose: closeCreateDepositModal,
        createDepositSubmitting
      })
    ])
  ])
}

function buildStatCards(stats, activeType, onSelectType) {
  const allStat = stats.all || { count: 0, value: 0 }
  const cards = []
  cards.push({
    key: 'all',
    label: 'Total',
    count: allStat.count,
    value: allStat.value,
    active: !activeType
  })
  const typeOrder = ['contribution', 'initial_seed', 'capital_injection', 'donation', 'grant', 'interest_income', 'other_revenue', 'deposit', 'other']
  for (const t of typeOrder) {
    const s = stats[t]
    if (!s || (Number(s.count) === 0 && Number(s.value) === 0)) continue
    cards.push({
      key: t,
      label: DEPOSIT_TYPE_LABELS[t] || t.replace(/_/g, ' '),
      count: s.count,
      value: s.value,
      active: activeType === t
    })
  }
  return cards.map((c) =>
    Row({
      key: c.key,
      tagType: 'button',
      class: `px-3 py-2 rounded-lg border text-left transition ${c.active ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`,
      events: { click: () => onSelectType(c.key === 'all' ? '' : c.key) }
    }, [
      Row({ class: 'text-sm font-medium' }, c.label),
      Row({ class: 'text-xs text-gray-500 mt-0.5' }, `${c.count} deposit${c.count !== 1 ? 's' : ''}`),
      Row({ class: 'text-sm font-semibold mt-1' }, `Br ${financeFormat(c.value)}`)
    ])
  )
}

function DepositDetailContent({ deposit }) {
  if (!deposit) return null
  const row = (label, value) =>
    Row({ class: 'flex justify-between gap-4 py-2 border-b border-gray-100' }, [
      Row({ class: 'text-sm text-gray-500' }, label),
      Row({ class: 'text-sm font-medium text-gray-900 text-right' }, value || '—')
    ])
  return Row({ class: 'space-y-0' }, [
    row('Date', formatDateDDMMYYYY(deposit.deposit_date) || deposit.deposit_date),
    row('Type', DEPOSIT_TYPE_LABELS[deposit.type] || deposit.type?.replace(/_/g, ' ')),
    row('Amount', `Br ${financeFormat(deposit.amount)}`),
    row('Source', deposit.source),
    row('Reference', deposit.reference_no),
    row('Description', deposit.description)
  ])
}

function CreateDepositModalContent(props) {
  const { handleClose, createDepositSubmitting } = props
  const vm = props.viewModel
  const form = vm.getState('deposit-form') || {}

  const update = (key, value) => {
    const f = vm.getState('deposit-form') || {}
    vm.updateState('deposit-form', { ...f, [key]: value })
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const currentForm = vm.getState('deposit-form') || {}
    const amount = Number(currentForm.amount)
    if (!currentForm.deposit_date || !amount || amount <= 0) {
      showAlert({ message: 'Date and amount (positive) are required.', variant: 'error' })
      return
    }
    vm.updateState('create-deposit-submitting', true)
    try {
      await vm.createDeposit({
        deposit_date: currentForm.deposit_date,
        type: currentForm.type || 'contribution',
        amount,
        description: currentForm.description || null,
        source: currentForm.source || null,
        reference_no: currentForm.reference_no || null
      })
      handleClose()
      showAlert({ message: 'Deposit created successfully.', variant: 'success' })
    } catch (err) {
      showAlert({ message: err.message || 'Failed to create deposit.', variant: 'error' })
    } finally {
      vm.updateState('create-deposit-submitting', false)
    }
  }

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const fieldClass = 'w-full'

  return Row({ class: 'w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden flex flex-col' }, [
    CardHeader({ class: 'flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0' }, [
      Row({ class: 'flex items-center gap-2' }, [
        IonIcon({ name: 'wallet-outline', class: 'text-2xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-900' }, 'Add Deposit')
      ]),
      IconButton({ onClick: handleClose, class: 'text-gray-400 hover:text-gray-600' }, [IonIcon({ name: 'close-outline', class: 'text-xl' })])
    ]),
    Row({
      tagType: 'form',
      class: 'flex flex-col flex-1 min-h-0',
      events: { submit: handleSubmit },
      attributes: { name: 'create-deposit-form' }
    }, [
      CardBody({ class: 'px-6 py-5 space-y-4 flex-1 overflow-y-auto' }, [
        Row({ class: 'grid grid-cols-2 gap-4' }, [
          Row({}, [
            Row({ tagType: 'label', class: labelClass }, 'Date *'),
            Input({ type: 'date', value: form.deposit_date, onChange: (e) => update('deposit_date', e.target.value), class: fieldClass })
          ]),
          Row({}, [
            Row({ tagType: 'label', class: labelClass }, 'Type'),
            SelectFluid({
              value: form.type,
              onChange: (e) => update('type', e.target.value),
              class: fieldClass
            }, [
              ...DEPOSIT_TYPES.map((t) => Row({ tagType: 'option', attributes: { value: t.value } }, t.label))
            ])
          ])
        ]),
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Amount (Br) *'),
          Input({ type: 'number', step: '0.01', value: form.amount, onChange: (e) => update('amount', e.target.value), placeholder: '0.00', class: fieldClass })
        ]),
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Source (optional)'),
          Input({ value: form.source, onChange: (e) => update('source', e.target.value), placeholder: 'e.g. Member name or organization', class: fieldClass })
        ]),
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Reference no. (optional)'),
          Input({ value: form.reference_no, onChange: (e) => update('reference_no', e.target.value), placeholder: 'Reference or receipt number', class: fieldClass })
        ]),
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Description (optional)'),
          Input({ value: form.description, onChange: (e) => update('description', e.target.value), placeholder: 'Additional notes', class: fieldClass })
        ])
      ]),
      CardFooter({ class: 'flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0' }, [
        Button({ type: 'button', variant: 'secondary', onClick: handleClose }, 'Cancel'),
        Button({
          type: 'button',
          variant: 'primary',
          disabled: createDepositSubmitting,
          onClick: (e) => { e.preventDefault(); e.target.closest('form')?.requestSubmit() }
        }, createDepositSubmitting ? [Spinner({ class: 'w-4 h-4' }), 'Creating...'] : 'Create')
      ])
    ])
  ])
}
