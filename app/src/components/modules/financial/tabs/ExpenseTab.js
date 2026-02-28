const { Row, StatefulRow } = Liteframe
import { Button, Spinner } from '../../../utils/Button'
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table'
import Modal from '../../../shared/Modal'
import { Input } from '../../../utils/Input'
import { SelectFluid, SelectOptions, SelectRelative } from '../../../utils/Select'
import { showAlert, showConfirmation } from '../../../utils/ModalHelpers'
import { DropdownSearch, DropdownSearchItem } from '../../../utils/DropdownSearch'
import { IonIcon } from '../../../utils/Icon'
import Badge from '../../../utils/Badge'
import { ActionDropdown, ActionItem } from '../../../utils/Action'
import { formatDateDDMMYYYY } from '../../../utils/DateUtils'
import Drawer from '../../../shared/ExampleDrawer'
import { Card, CardHeader, CardBody, CardFooter } from '../../../utils/Card'
import { IconButton } from '../../../utils/Icon'

const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function capitalizeCustomerType(type) {
  if (!type) return 'Customer'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function getCustomerTypeBadgeColor(type) {
  if (type === 'supplier') return 'info'
  if (type === 'retailer') return 'success'
  if (type === 'both') return 'warning'
  return 'default'
}

// Same categories as in Create Expense form (form uses this with '-- Select Category --' first)
const EXPENSE_CATEGORIES = ['-- Select Category --', 'Salaries', 'Rent', 'Utilities', 'Supplies', 'Transport', 'Maintenance', 'Income taxes', 'Penalties', 'Other']
// Category filter: 'All' default then same options as create expense (no placeholder)
const EXPENSE_CATEGORY_FILTER_OPTIONS = ['All', ...EXPENSE_CATEGORIES.filter((c) => c !== '-- Select Category --')]

function filterAndSortExpenses(expenses, search, categoryFilter, sortBy, orderBy) {
  let list = [...(expenses || [])]
  const searchLower = (search || '').trim().toLowerCase()
  if (searchLower) {
    list = list.filter((e) => {
      const dateStr = formatDateDDMMYYYY(e.paid_on) || ''
      const payee = (e.customer_name || 'Walk-in') || ''
      const cat = (e.category || '') || ''
      const amountStr = financeFormat(e.amount)
      const payment = (e.payment_method || '') || ''
      const desc = (e.description || '') || ''
      const combined = `${dateStr} ${payee} ${cat} ${amountStr} ${payment} ${desc}`.toLowerCase()
      return combined.includes(searchLower)
    })
  }
  if (categoryFilter && categoryFilter.trim()) {
    list = list.filter((e) => (e.category || '').toLowerCase() === categoryFilter.trim().toLowerCase())
  }
  const by = sortBy || 'paid_on'
  const dir = orderBy === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let cmp = 0
    if (by === 'paid_on') cmp = new Date(a.paid_on) - new Date(b.paid_on)
    else if (by === 'category') cmp = (a.category || '').localeCompare(b.category || '')
    else if (by === 'amount') cmp = Number(a.amount) - Number(b.amount)
    else if (by === 'customer_name') cmp = (a.customer_name || 'Walk-in').localeCompare(b.customer_name || 'Walk-in')
    else if (by === 'payment_method') cmp = (a.payment_method || '').localeCompare(b.payment_method || '')
    return cmp * dir
  })
  return list
}

export function ExpenseTab(props) {
  const vm = props.viewModel
  const expenses = vm.getState('expenses') || []
  const total = vm.getState('expense-total') ?? 0
  const tableConfig = vm.getState('expense-table-config') || { limit: 20, offset: 0 }
  const paginationLimit = tableConfig.limit || 20
  const paginationOffset = tableConfig.offset || 0
  const initRow = total > 0 ? paginationOffset + 1 : 0
  const endRow = total > 0 ? Math.min(paginationOffset + paginationLimit, total) : 0
  const search = vm.getState('expense-search') || ''
  const categoryFilter = vm.getState('expense-category-filter') || ''
  const sortBy = tableConfig.sortBy || 'paid_on'
  const orderBy = tableConfig.orderBy || 'desc'
  const loading = vm.getState('loading')
  const error = vm.getState('error')
  const drawerOpen = vm.getState('expense-drawer-open') === true
  const selectedExpense = vm.getState('selected-expense')

  const displayedExpenses = filterAndSortExpenses(expenses, search, categoryFilter, sortBy, orderBy)

  const sortIcon = (column) => {
    if (column !== sortBy) return null
    return IonIcon({ name: orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline', class: 'text-xs shrink-0 font-semibold' })
  }
  const headerClass = 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer'
  const headerLabelWrapClass = 'inline-flex items-center gap-1 whitespace-nowrap'

  const handleSetLimit = (newLimit) => vm.updateExpenseTableConfig({ limit: newLimit, offset: 0 })
  const handlePreviousPage = () => vm.updateExpenseTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) })
  const handleNextPage = () => vm.updateExpenseTableConfig({ offset: paginationOffset + paginationLimit })

  props.ensureLocalStateKey('actionId', null)
  const actionId = props.getLocalState('actionId')

  const openCreateExpenseModal = async () => {
    if (vm.getState('withhold-percentage') === null) vm.loadWithholdPercentage()
    vm.resetExpenseForm()
    const list = vm.getState('expense-customer-list') || []
    if (list.length === 0) await vm.loadExpenseCustomers('')
    Modal({}, (delegator, handleClose) => CreateExpenseModalContent(props.viewModel, delegator, handleClose))
  }

  return Row({ class: 'flex flex-col gap-4 flex-1 min-h-0 overflow-hidden border border-gray-200 rounded-lg' }, [
    Row({ class: 'flex justify-between items-center px-4 py-4 gap-2' }, [
      Row({}, [
        SelectFluid({
          value: categoryFilter || 'All',
          onChange: (e) => vm.setExpenseCategoryFilter(e.target.value === 'All' ? '' : e.target.value),
          class: 'min-w-[200px] max-w-[140px] text-sm'
        }, SelectOptions({
          options: EXPENSE_CATEGORY_FILTER_OPTIONS,
          selectedOption: categoryFilter || 'All'
        }))
      ]),
      Button({ variant: 'primary', onClick: openCreateExpenseModal, class: 'text-sm' }, 'Add Expense')
    ]),
    Row({ class: 'flex items-center justify-between gap-6 px-4 py-4 border-b border-gray-200 bg-gray-50' }, [
        Row({ class: 'flex-1 min-w-[280px] max-w-md' }, [
          Row({ class: 'relative w-full' }, [
            IonIcon({
              name: 'search-outline',
              class: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl pointer-events-none'
            }),
            Input({
              placeholder: 'Search by date, payee, category, amount...',
              value: search,
              class: 'pl-10 pr-4 w-full',
              onChange: (e) => vm.setExpenseSearch(e.target.value),
            })
          ])
        ]),
      Row({ class: 'flex items-center gap-2 ml-auto' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({
          name: 'expense-limit',
          onChange: (e) => handleSetLimit(parseInt(e.target.value, 10)),
          value: paginationLimit
        }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, total > 0 ? `${initRow}-${endRow} of ${total}` : '0-0 of 0'),
          IconButton({ onClick: handlePreviousPage, disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: handleNextPage, disabled: paginationOffset + paginationLimit >= total || loading }, [IonIcon({ name: 'caret-forward-outline' })])
        ])
      ])
    ]),
    error && Row({ class: 'text-sm text-red-600 bg-red-50 px-3 py-2 rounded mx-4' }, error),
    loading ? Row({ class: 'flex items-center gap-2 text-gray-500 px-4' }, [Spinner({ class: 'w-4 h-4' }), 'Loading...']) : Row({ class: 'flex-1 min-h-0 overflow-auto' }, [
      displayedExpenses.length === 0
        ? Row({ class: 'text-gray-500 text-sm py-8' }, expenses.length === 0 ? 'No expenses yet. Click "Add Expense" to create one.' : 'No expenses match your search or filter.')
        : Table({ class: 'w-full text-sm', tableClass: 'table-fixed' }, [
            TableHeader({}, [
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setExpenseSort('paid_on') }, [Row({ class: headerLabelWrapClass }, ['Date', sortIcon('paid_on')])]),
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setExpenseSort('category') }, [Row({ class: headerLabelWrapClass }, ['Category', sortIcon('category')])]),
              TableHCell({ class: `${headerClass} text-right w-32`, onClick: () => vm.setExpenseSort('amount') }, [Row({ class: headerLabelWrapClass }, ['Amount', sortIcon('amount')])]),
              TableHCell({ class: headerClass, onClick: () => vm.setExpenseSort('customer_name') }, [Row({ class: headerLabelWrapClass }, ['Payee', sortIcon('customer_name')])]),
              TableHCell({ class: `${headerClass} w-28`, onClick: () => vm.setExpenseSort('payment_method') }, [Row({ class: headerLabelWrapClass }, ['Payment', sortIcon('payment_method')])]),
              TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase w-24 pr-4' }, 'Action')
            ]),
            TableBody({}, displayedExpenses.map((e) =>
              TableRow({ key: e.id }, [
                TableDCell({ class: 'w-28' }, formatDateDDMMYYYY(e.paid_on)),
                TableDCell({ class: 'capitalize w-28' }, e.category),
                TableDCell({ class: 'text-right w-32' }, `Br ${financeFormat(e.amount)}`),
                TableDCell({}, e.customer_name || 'Walk-in'),
                TableDCell({ class: 'capitalize w-28' }, e.payment_method || 'cash'),
                TableDCell({ class: 'text-center w-24' }, ActionDropdown({
                  actionId: e.id,
                  open: e.id === actionId,
                  onToggle: () => props.setLocalState('actionId', actionId === e.id ? null : e.id),
                  class: 'text-center'
                }, [
                  ActionItem({
                    label: 'View',
                    icon: 'eye-outline',
                    onClick: () => {
                      vm.openExpenseDrawer(e)
                      props.setLocalState('actionId', null)
                    }
                  }),
                  ActionItem({
                    label: 'Reverse',
                    icon: 'arrow-undo-outline',
                    danger: true,
                    onClick: async () => {
                      props.setLocalState('actionId', null)
                      await handleReverseExpense(vm, e)
                    }
                  })
                ]))
              ])
            ))
          ])
    ]),
    drawerOpen && selectedExpense ? ExpenseDetailDrawer({ viewModel: vm, expense: selectedExpense, onClose: () => vm.closeExpenseDrawer() }) : null
  ])
}

async function handleReverseExpense(vm, expense) {
  try {
    const confirmed = await showConfirmation({
      title: 'Reverse Expense',
      message: `Reverse expense #${expense.id} (${expense.category}, Br ${financeFormat(expense.amount)})? This action cannot be undone.`,
      variant: 'warning'
    })
    if (!confirmed) return
    showAlert({ message: 'Reverse expense is not yet implemented. It will create a reversing ledger entry and mark the expense as reversed.', variant: 'info' })
  } catch (e) {
    showAlert({ message: e.message || 'Failed to reverse expense', variant: 'error' })
  }
}

function ExpenseDetailDrawer(props) {
  const { viewModel, expense, onClose } = props
  const title = `Expense #${expense.id}`

  return Drawer({ class: 'flex flex-col h-full', openSlide: true }, [
    Card({ class: 'flex flex-col h-full' }, [
      CardHeader({ class: 'flex items-center justify-between px-5 h-12 border-b border-gray-200 flex-shrink-0' }, [
        Row({ class: 'text-base font-semibold text-gray-900' }, title),
        IconButton({ onClick: onClose }, IonIcon({ name: 'close-outline', class: 'text-xl' }))
      ]),
      CardBody({ class: 'flex-1 overflow-y-auto min-h-0 px-5 py-4' }, [
        Row({ class: 'flex flex-col gap-4' }, [
          detailRow('Date', formatDateDDMMYYYY(expense.paid_on)),
          detailRow('Category', expense.category || '—'),
          detailRow('Amount', `Br ${financeFormat(expense.amount)}`),
          detailRow('Payee', expense.customer_name || 'Walk-in'),
          detailRow('Payment method', (expense.payment_method || 'cash').replace(/_/g, ' ')),
          expense.invoice_no ? detailRow('Invoice no.', expense.invoice_no) : null,
          expense.description ? detailRow('Description', expense.description) : null,
          expense.payment_method === 'cheque' && (expense.cheque_no || expense.cheque_date || expense.bank_name) ? Row({ class: 'border-t border-gray-100 pt-3 mt-2' }, [
            Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-2' }, 'Cheque details'),
            detailRow('Cheque no.', expense.cheque_no || '—'),
            detailRow('Cheque date', expense.cheque_date ? formatDateDDMMYYYY(expense.cheque_date) : '—'),
            detailRow('Bank', expense.bank_name || '—')
          ]) : null,
          expense.payment_method === 'bank_transfer' && expense.bank_transfer_ref ? detailRow('Bank transfer ref.', expense.bank_transfer_ref) : null,
          expense.withhold_percentage != null && Number(expense.withhold_percentage) > 0 ? detailRow('Withhold %', `${expense.withhold_percentage}%`) : null
        ].filter(Boolean))
      ]),
      CardFooter({ class: 'flex justify-end gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0' }, [
        Button({ variant: 'secondary', onClick: onClose }, 'Close'),
        Button({ variant: 'danger', onClick: () => handleReverseExpense(viewModel, expense) }, 'Reverse')
      ])
    ])
  ])
}

function detailRow(label, value) {
  return Row({ class: 'flex flex-col gap-0.5' }, [
    Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500' }, label),
    Row({ class: 'text-sm text-gray-900' }, value)
  ])
}

function CreateExpenseModalContent(viewModel, delegator, handleClose) {
  const render = (props) => {
    const vm = props.viewModel
    const form = vm.getState('expense-form') || {}
    const customerList = vm.getState('expense-customer-list') || []

    const update = (key, value) => vm.updateExpenseForm({ [key]: value })

  const showCustomerDropdown = form.show_customer_dropdown === true
  const customerDisplay = form.customer
    ? (form.customer.name || form.customer.full_name || '')
    : 'Select customer...'
  // DB-registered Walk-in appears in customerList; show it first with same styling
  const customerSearchValue = showCustomerDropdown ? (form.customer_search || '') : customerDisplay
  const sortedCustomerList = [...customerList].sort((a, b) => {
    const an = (a.name || a.full_name || '').trim().toLowerCase()
    const bn = (b.name || b.full_name || '').trim().toLowerCase()
    if (an === 'walk-in') return -1
    if (bn === 'walk-in') return 1
    return 0
  })

    const gross = Number(form.amount) || 0
    const applyWithhold = form.apply_withhold === true
    const withholdPct = vm.getState('withhold-percentage')
    const withholdAmount = applyWithhold && withholdPct != null ? gross * (Number(withholdPct) / 100) : 0
    const net = gross - withholdAmount

  const handleCustomerSearch = (value) => {
    vm.updateExpenseForm({ customer_search: value })
    vm.loadExpenseCustomers(value)
  }

  const handleCustomerSelect = (customer) => {
    vm.selectExpenseCustomer(customer)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!form.paid_on || !form.category) {
      showAlert({ message: 'Paid on date and category are required.', variant: 'error' })
      return
    }
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      showAlert({ message: 'Amount (positive) is required.', variant: 'error' })
      return
    }
    const paymentMethod =
      form.payment_method === 'Cheque' ? 'cheque'
        : form.payment_method === 'Bank Transfer' ? 'bank_transfer'
          : 'cash'
    if (paymentMethod === 'cheque' && (!form.cheque_number || !form.cheque_date || !form.bank_name)) {
      showAlert({ message: 'Cheque number, date, and bank name are required when payment method is Cheque.', variant: 'error' })
      return
    }
    try {
      await vm.createExpense({
        customer_id: form.customer_id ?? null,
        category: form.category,
        paid_on: form.paid_on,
        invoice_no: form.invoice_no || null,
        amount: net,
        description: form.description || null,
        payment_method: paymentMethod,
        withhold_percentage: applyWithhold && withholdPct != null ? Number(withholdPct) : null,
        cheque_no: paymentMethod === 'cheque' ? (form.cheque_number || null) : null,
        cheque_date: paymentMethod === 'cheque' ? (form.cheque_date || null) : null,
        bank_name: paymentMethod === 'cheque' ? (form.bank_name || null) : null,
        bank_transfer_ref: paymentMethod === 'bank_transfer' ? (form.bank_transfer_reference || null) : null,
      })
      handleClose()
      showAlert({ message: 'Expense created successfully.', variant: 'success' })
    } catch (err) {
      showAlert({ message: err.message || 'Failed to create expense.', variant: 'error' })
    }
  }

    const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
    const fieldClass = 'w-full'

    return Row({ class: 'w-full max-w-2xl bg-white rounded-xl shadow-xl p-6' }, [
    Row({ class: 'text-lg font-semibold mb-4' }, 'Add Expense'),
    Row({ tagType: 'form', class: 'space-y-4', events: { submit: handleSubmit }, delegator }, [
      // 1. Customer selection (SearchDropdown for all types)
      Row({}, [
        Row({ tagType: 'label', class: labelClass }, 'Customer'),
        DropdownSearch({
          delegator,
          open: showCustomerDropdown,
          value: customerSearchValue,
          placeholder: 'Search customers...',
          onInput: handleCustomerSearch,
          onFocus: () => {
            vm.loadExpenseCustomers(form.customer_search || '')
            vm.updateExpenseForm({ show_customer_dropdown: true })
          },
          getOpenState: () => (vm.getState('expense-form') || {}).show_customer_dropdown,
          setOpenState: () => vm.updateExpenseForm({ show_customer_dropdown: false }),
          class: 'w-full relative',
        }, [
          ...sortedCustomerList.map((customer) => {
            const name = customer.name || customer.full_name || 'Unknown'
            const isWalkIn = (customer.name || customer.full_name || '').trim().toLowerCase() === 'walk-in'
            return DropdownSearchItem({
              delegator,
              onSelect: () => handleCustomerSelect(customer),
              key: customer.id,
              class: isWalkIn ? 'py-3 border-b border-gray-100' : 'py-3',
            }, [
              Row({ class: 'flex items-center justify-between gap-2' }, [
                isWalkIn
                  ? Row({ class: 'flex items-center gap-2 font-semibold text-gray-900' }, [
                      IonIcon({ name: 'walk-outline', class: 'text-lg' }),
                      'Walk-in',
                    ])
                  : Row({ class: 'font-semibold text-gray-900' }, name),
                isWalkIn
                  ? Row({ class: 'text-xs text-gray-500' }, 'One-off / no customer record')
                  : Badge({
                      label: capitalizeCustomerType(customer.customer_type),
                      tone: getCustomerTypeBadgeColor(customer.customer_type),
                      class: 'text-xs px-2 py-0.5',
                    }),
              ]),
            ])
          }),
        ]),
      ]),

      // 2. Category + Invoice No.
      Row({ class: 'grid grid-cols-2 gap-4' }, [
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Category'),
          SelectFluid({
            delegator,
            value: form.category,
            onChange: (e) => update('category', e.target.value),
            class: fieldClass,
          }, 
          SelectOptions({
            options: EXPENSE_CATEGORIES,
            selectedOption: form.category,
            delegator,
          })),
        ]),
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Invoice No.'),
          Input({
            delegator,
            value: form.invoice_no || '',
            onChange: (e) => update('invoice_no', e.target.value),
            placeholder: 'Optional',
            class: fieldClass,
          }),
        ]),
      ]),

      // 3. Paid On + Amount
      Row({ class: 'grid grid-cols-2 gap-4' }, [
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Paid On'),
          Input({
            delegator,
            type: 'date',
            value: form.paid_on || '',
            onChange: (e) => update('paid_on', e.target.value),
            class: fieldClass,
          }),
        ]),
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Amount (Br)'),
          Input({
            delegator,
            type: 'number',
            step: '0.01',
            value: form.amount ?? '',
            onChange: (e) => update('amount', e.target.value),
            placeholder: '0.00',
            class: fieldClass,
          }),
        ]),
      ]),

      // 4. Description
      Row({}, [
        Row({ tagType: 'label', class: labelClass }, 'Description'),
        Input({
          delegator,
          value: form.description || '',
          onChange: (e) => update('description', e.target.value),
          placeholder: 'Optional',
          class: fieldClass,
        }),
      ]),

      // 5. Payment method (Cash / Cheque) + cheque details when Cheque
      Row({}, [
        Row({ tagType: 'label', class: labelClass }, 'Payment method'),
        SelectFluid({
          delegator,
          value: form.payment_method || 'Cash',
          onChange: (e) => update('payment_method', e.target.value),
          // options: [{ value: 'Cash', label: 'Cash' }, { value: 'Cheque', label: 'Cheque' }],
          class: fieldClass,
        },
        SelectOptions({
          options: ['-- Select Method --', 'Cash', 'Cheque', 'Bank Transfer'],
          selectedOption: form.payment_method,
          delegator,
        })),
      ]),
      form.payment_method === 'Cheque' && Row({ class: 'grid grid-cols-3 gap-4 pl-0' }, [
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Cheque No.'),
          Input({
            delegator,
            value: form.cheque_number || '',
            onChange: (e) => update('cheque_number', e.target.value),
            placeholder: 'Number',
            class: fieldClass,
          }),
        ]),
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Cheque Date'),
          Input({
            delegator,
            type: 'date',
            value: form.cheque_date || '',
            onChange: (e) => update('cheque_date', e.target.value),
            class: fieldClass,
          }),
        ]),
        Row({}, [
          Row({ tagType: 'label', class: labelClass }, 'Bank Name'),
          Input({
            delegator,
            value: form.bank_name || '',
            onChange: (e) => update('bank_name', e.target.value),
            placeholder: 'Bank name',
            class: fieldClass,
          }),
        ]),
      ]),
      form.payment_method === 'Bank Transfer' && Row({}, [
        Row({ tagType: 'label', class: labelClass }, 'Transfer reference'),
        Input({
          delegator,
          value: form.bank_transfer_reference || '',
          onChange: (e) => update('bank_transfer_reference', e.target.value),
          placeholder: 'Optional',
          class: fieldClass,
        }),
      ]),

      // 6. Withhold checkbox
      Row({ class: 'flex gap-4 items-center', events: { click: () => update('apply_withhold', !form.apply_withhold) }, delegator }, [
        IonIcon({ name: form.apply_withhold ? 'checkbox' : 'square-outline', class: 'text-3xl select-none' }),
        Row({ tagType: 'label', class: 'text-sm text-gray-500 font-medium cursor-pointer' }, 'Apply withhold'),
      ]),

      // 7. Summary: only when withhold applies (net differs from gross)
      applyWithhold && Row({ class: 'rounded-lg border border-gray-200 bg-gray-50 p-4 mt-4 space-y-3' }, [
        Row({ class: 'text-sm font-semibold text-gray-800 pb-1 border-b border-gray-200' }, 'Summary'),
        Row({ class: 'flex justify-between items-center gap-4 text-sm text-gray-600' }, [
          Row({}, 'Gross'),
          Row({ class: 'font-medium tabular-nums' }, `Br ${financeFormat(gross)}`),
        ]),
        Row({ class: 'flex justify-between items-center gap-4 text-sm text-gray-600' }, [
          Row({}, `Withhold (${withholdPct != null ? Number(withholdPct) + '%' : '—'})`),
          Row({ class: 'font-medium tabular-nums' }, `Br ${financeFormat(withholdAmount)}`),
        ]),
        Row({ class: 'flex justify-between items-center gap-4 text-sm font-semibold text-gray-900 pt-1 border-t border-gray-200' }, [
          Row({}, 'Net'),
          Row({ class: 'tabular-nums' }, `Br ${financeFormat(net)}`),
        ]),
      ]),

      Row({ class: 'flex justify-end gap-2 pt-4' }, [
        Button({ delegator, type: 'button', variant: 'secondary', onClick: handleClose }, 'Cancel'),
        Button({ delegator, type: 'submit', variant: 'primary' }, 'Create'),
      ]),
    ]),
  ])
  }

  return StatefulRow({
    class: 'w-full max-w-2xl',
    viewModel,
    stateKeys: ['loading', 'expense-form', 'expense-customer-list', 'withhold-percentage'],
  }, render)
}
