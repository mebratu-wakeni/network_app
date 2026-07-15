const { Row, StatefulRow } = Liteframe
import { Button, Spinner } from '../utils/Button.js'
import { Input } from '../utils/Input.js'
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../utils/Table.js'
import { ActionDropdown, ActionItem } from '../utils/Action.js'
import { showAlert, showConfirmation } from '../utils/ModalHelpers.js'
import { formatDateDDMMYYYY } from '../utils/DateUtils.js'
import { IonIcon, IconButton } from '../utils/Icon.js'
import Drawer from '../shared/ExampleDrawer.js'
import { Card, CardHeader, CardBody } from '../utils/Card.js'
import { SettingsVM } from './SettingsVM.js'
import { navigationVM } from '../navigation/NavigationVM.js'
import { displayErrorText } from '../utils/userErrorMessage.js'

const SETTINGS_TABS = [
  { key: 'general', label: 'General', icon: 'settings-outline' },
  { key: 'fiscal-year', label: 'Fiscal Year', icon: 'calendar-outline' }
]

const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

function GeneralTab(props) {
  const vm = props.viewModel
  const form = vm.getState('form') || {}
  const loading = vm.getState('loading')
  const error = displayErrorText(vm.getState('error'))
  const success = vm.getState('success')

  const handleChange = (key) => (e) => vm.updateField(key, e.target?.value ?? '')
  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    await vm.saveSettings()
  }

  return Row({ class: 'flex flex-col flex-1 min-h-0 overflow-hidden border border-gray-200 rounded-lg bg-white' }, [
    Row({ tagType: 'form', class: 'flex flex-col flex-1 min-h-0 overflow-auto', events: { submit: handleSubmit } }, [
      Row({ class: 'flex-1 overflow-auto px-6 py-6' }, [
        Row({ class: 'max-w-2xl' }, [
          error ? Row({ class: 'mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100' }, error) : null,
          success ? Row({ class: 'mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-100' }, success) : null,

          // Withhold section
          Row({ class: 'mb-8' }, [
            Row({ class: 'text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2' }, [
              Row({ tagType: 'ion-icon', attributes: { name: 'pricetag-outline' }, class: 'text-lg text-indigo-600' }),
              'Withhold'
            ]),
            Row({ class: 'p-5 rounded-lg border border-gray-200 bg-gray-50/50' }, [
              Row({}, [
                Row({ tagType: 'label', attributes: { for: 'withhold_percentage' }, class: labelClass }, 'Withhold percentage (%)'),
                Input({
                  name: 'withhold_percentage',
                  type: 'number',
                  min: 0,
                  max: 100,
                  step: 0.01,
                  value: form.withhold_percentage,
                  onChange: handleChange('withhold_percentage'),
                  class: 'w-full max-w-[140px]',
                  placeholder: 'e.g. 2'
                })
              ])
            ])
          ]),

          // Company section
          Row({ class: 'mb-6' }, [
            Row({ class: 'text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2' }, [
              Row({ tagType: 'ion-icon', attributes: { name: 'business-outline' }, class: 'text-lg text-indigo-600' }),
              'Company information'
            ]),
            Row({ class: 'p-5 rounded-lg border border-gray-200 bg-gray-50/50 space-y-4' }, [
              Row({}, [
                Row({ tagType: 'label', attributes: { for: 'company_name' }, class: labelClass }, 'Company name'),
                Input({
                  name: 'company_name',
                  value: form.company_name,
                  onChange: handleChange('company_name'),
                  class: 'w-full max-w-md',
                  placeholder: 'Company name'
                })
              ]),
              Row({}, [
                Row({ tagType: 'label', attributes: { for: 'company_address' }, class: labelClass }, 'Address'),
                Input({
                  name: 'company_address',
                  value: form.company_address,
                  onChange: handleChange('company_address'),
                  class: 'w-full max-w-md',
                  placeholder: 'Street, city, region'
                })
              ]),
              Row({ class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' }, [
                Row({}, [
                  Row({ tagType: 'label', attributes: { for: 'company_phone' }, class: labelClass }, 'Phone'),
                  Input({
                    name: 'company_phone',
                    value: form.company_phone,
                    onChange: handleChange('company_phone'),
                    class: 'w-full',
                    placeholder: 'Phone'
                  })
                ]),
                Row({}, [
                  Row({ tagType: 'label', attributes: { for: 'company_email' }, class: labelClass }, 'Email'),
                  Input({
                    name: 'company_email',
                    type: 'email',
                    value: form.company_email,
                    onChange: handleChange('company_email'),
                    class: 'w-full',
                    placeholder: 'contact@company.com'
                  })
                ])
              ]),
              Row({}, [
                Row({ tagType: 'label', attributes: { for: 'company_tin' }, class: labelClass }, 'TIN (optional)'),
                Input({
                  name: 'company_tin',
                  value: form.company_tin,
                  onChange: handleChange('company_tin'),
                  class: 'w-full max-w-[200px]',
                  placeholder: 'Tax ID'
                })
              ])
            ])
          ])
        ])
      ]),
      Row({ class: 'flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end' }, [
        Button({
          variant: 'primary',
          disabled: !!loading,
          type: 'submit',
          class: 'px-6'
        }, loading ? 'Saving...' : 'Save settings')
      ])
    ])
  ])
}

function FiscalYearTab(props) {
  const vm = props.viewModel
  const fiscalYears = vm.getState('fiscal-years') || []
  const currentFy = vm.getState('current-fiscal-year')
  const loading = vm.getState('fiscal-years-loading')
  const closingYear = vm.getState('close-fiscal-year-loading')
  const reopeningYear = vm.getState('reopen-fiscal-year-loading')
  const creating = vm.getState('create-fiscal-year-loading')
  const error = displayErrorText(vm.getState('fiscal-years-error'))

  const currentYear = new Date().getFullYear()
  const defaultStart = `${currentYear}-01-01`
  const defaultEnd = `${currentYear}-12-31`
  props.ensureLocalStateKey('create-fy-form', {
    fiscal_year: currentYear,
    start_date: defaultStart,
    end_date: defaultEnd
  })
  const createForm = props.getLocalState('create-fy-form') || {
    fiscal_year: currentYear,
    start_date: defaultStart,
    end_date: defaultEnd
  }

  // Option A: only one open fiscal year at a time — derive from the list
  const openFy = fiscalYears.find((fy) => fy.status === 'open') || null
  const hasOpenYear = !!openFy

  const handleCreateYear = async () => {
    const year = Number(createForm.fiscal_year)
    const start = String(createForm.start_date || '').trim()
    const end = String(createForm.end_date || '').trim()
    if (!year || year < 1900 || year > 2100) {
      showAlert({ message: 'Please enter a valid year (1900–2100).', variant: 'error' })
      return
    }
    if (!start || !end) {
      showAlert({ message: 'Please enter start and end dates.', variant: 'error' })
      return
    }
    if (new Date(start) >= new Date(end)) {
      showAlert({ message: 'Start date must be before end date.', variant: 'error' })
      return
    }
    try {
      const ok = await vm.createFiscalYear({ fiscal_year: year, start_date: start, end_date: end })
      if (ok) {
        showAlert({ message: `Fiscal year ${year} created.`, variant: 'success' })
        const nextYear = year + 1
        props.setLocalState('create-fy-form', {
          fiscal_year: nextYear,
          start_date: `${nextYear}-01-01`,
          end_date: `${nextYear}-12-31`
        })
      } else {
        showAlert({ message: vm.getState('fiscal-years-error') || 'Failed to create fiscal year.', variant: 'error' })
      }
    } catch (e) {
      showAlert({ message: e.message || 'Failed to create fiscal year.', variant: 'error' })
    }
  }

  props.ensureLocalStateKey('fyActionId', null)
  const fyActionId = props.getLocalState('fyActionId')
  const reportFyYear = vm.getState('report-fy-year')
  const reportData = vm.getState('report-data')
  const reportLoading = vm.getState('report-loading')

  const handleCloseYear = async (year) => {
    try {
      const confirmed = await showConfirmation({
        title: 'Close Fiscal Year',
        message: `Close fiscal year ${year}? This will close Revenue and Expense to Retained Earnings and lock this year.`,
        variant: 'warning',
        confirmText: 'Close Year'
      })
      if (!confirmed) return
      const ok = await vm.closeFiscalYear(year)
      if (ok) {
        showAlert({ message: `Fiscal year ${year} closed successfully.`, variant: 'success' })
      } else {
        showAlert({ message: vm.getState('fiscal-years-error') || 'Failed to close fiscal year.', variant: 'error' })
      }
    } catch (e) {
      showAlert({ message: e.message || 'Failed to close fiscal year.', variant: 'error' })
    }
  }

  const handleReopenYear = async (year) => {
    props.setLocalState('fyActionId', null)
    try {
      const confirmed = await showConfirmation({
        title: 'Reopen Fiscal Year',
        message: `Reopen fiscal year ${year}? This will reverse the closing ledger entries and set the year back to open.`,
        variant: 'warning',
        confirmText: 'Reopen'
      })
      if (!confirmed) return
      const ok = await vm.reopenFiscalYear(year)
      if (ok) {
        showAlert({ message: `Fiscal year ${year} reopened.`, variant: 'success' })
      } else {
        showAlert({ message: vm.getState('fiscal-years-error') || 'Failed to reopen fiscal year.', variant: 'error' })
      }
    } catch (e) {
      showAlert({ message: e.message || 'Failed to reopen fiscal year.', variant: 'error' })
    }
  }

  const handleDeleteYear = async (fy, forceDelete = false) => {
    props.setLocalState('fyActionId', null)
    try {
      const confirmed = await showConfirmation({
        title: forceDelete ? 'Force Delete Fiscal Year' : 'Delete Fiscal Year',
        message: forceDelete
          ? `This fiscal year has transactions. Force delete will only remove the fiscal year record; transaction data stays. Continue?`
          : `Delete fiscal year ${fy.fiscal_year} (${formatDateDDMMYYYY(fy.start_date)} – ${formatDateDDMMYYYY(fy.end_date)})? Only allowed if it has no transactions.`,
        variant: 'warning',
        confirmText: forceDelete ? 'Force Delete' : 'Delete'
      })
      if (!confirmed) return
      const ok = await vm.deleteFiscalYear(fy.fiscal_year, forceDelete)
      if (ok) {
        showAlert({ message: `Fiscal year ${fy.fiscal_year} deleted.`, variant: 'success' })
      } else {
        const errMsg = vm.getState('fiscal-years-error') || 'Failed to delete fiscal year.'
        if (errMsg.includes('has transactions') && !forceDelete) {
          const forceOk = await showConfirmation({
            title: 'Force Delete Fiscal Year?',
            message: 'This fiscal year has transactions in its date range. Force delete will only remove the fiscal year record (e.g. if it was created with wrong dates). Your transaction data stays. Continue?',
            confirmText: 'Force Delete',
            variant: 'warning'
          })
          if (forceOk) handleDeleteYear(fy, true)
        } else {
          showAlert({ message: errMsg, variant: 'error' })
        }
      }
    } catch (e) {
      const errMsg = e.message || 'Failed to delete fiscal year.'
      if (errMsg.includes('has transactions') && !forceDelete) {
        const forceOk = await showConfirmation({
          title: 'Force Delete Fiscal Year?',
          message: 'This fiscal year has transactions in its date range. Force delete will only remove the fiscal year record (e.g. if it was created with wrong dates). Your transaction data stays. Continue?',
          confirmText: 'Force Delete',
          variant: 'warning'
        })
        if (forceOk) handleDeleteYear(fy, true)
      } else {
        showAlert({ message: errMsg, variant: 'error' })
      }
    }
  }

  const handleShowReport = async (fy) => {
    props.setLocalState('fyActionId', null)
    try {
      await vm.getFiscalYearReport(fy.fiscal_year)
    } catch (e) {
      showAlert({ message: e.message || 'Failed to load report.', variant: 'error' })
      vm.closeReportDrawer()
    }
  }

  const closeReportDrawer = () => vm.closeReportDrawer()

  const financeFmt = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return Row({ class: 'flex flex-col gap-4 flex-1 min-h-0 overflow-hidden border border-gray-200 rounded-lg bg-white' }, [
    Row({ class: 'px-6 py-5 overflow-auto flex flex-col gap-4' }, [
      error
        ? Row({ class: 'p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100' }, error)
        : null,

      currentFy
        ? Row({ class: 'p-4 rounded-lg border border-indigo-200 bg-indigo-50/50 flex items-center gap-3' }, [
            Row({ tagType: 'ion-icon', attributes: { name: 'calendar-outline' }, class: 'text-2xl text-indigo-600' }),
            Row({ class: 'flex-1' }, [
              Row({ class: 'text-sm font-medium text-indigo-900' }, 'Current fiscal year'),
              Row({ class: 'text-lg font-semibold text-indigo-800' }, `${currentFy.fiscal_year} (${formatDateDDMMYYYY(currentFy.start_date)} – ${formatDateDDMMYYYY(currentFy.end_date)})`)
            ])
          ])
        : !loading
          ? Row({ class: 'p-4 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-3' }, [
              Row({ tagType: 'ion-icon', attributes: { name: 'information-circle-outline' }, class: 'text-2xl text-amber-600 flex-shrink-0' }),
              Row({ class: 'flex-1 text-sm text-amber-900' }, [
                Row({ class: 'font-medium mb-1' }, 'No fiscal year is active yet'),
                'Create a fiscal year below before recording sales, purchases, or other transactions.'
              ])
            ])
          : null,

      Row({ class: 'flex flex-col flex-1 min-h-0' }, [
        Row({ class: 'flex flex-col gap-3 mb-3' }, [
          Row({ class: 'text-sm font-semibold text-gray-700 uppercase tracking-wide' }, 'All fiscal years'),
          Row({ class: 'flex flex-wrap items-end gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50/50' }, [
            Row({ class: 'flex flex-col gap-1' }, [
              Row({ tagType: 'label', attributes: { for: 'create-fy-year' }, class: 'text-xs font-medium text-gray-600' }, 'Year'),
              Input({
                id: 'create-fy-year',
                type: 'number',
                min: 1900,
                max: 2100,
                value: createForm.fiscal_year ?? '',
                onChange: (e) => {
                  const year = e.target?.value ? Number(e.target.value) : ''
                  const next = { ...createForm, fiscal_year: year }
                  if (year && year >= 1900 && year <= 2100) {
                    next.start_date = `${year}-01-01`
                    next.end_date = `${year}-12-31`
                  }
                  props.setLocalState('create-fy-form', next)
                },
                class: 'w-24'
              })
            ]),
            Row({ class: 'flex flex-col gap-1' }, [
              Row({ tagType: 'label', attributes: { for: 'create-fy-start' }, class: 'text-xs font-medium text-gray-600' }, 'Start date'),
              Input({
                id: 'create-fy-start',
                type: 'date',
                value: createForm.start_date ?? '',
                onChange: (e) => props.setLocalState('create-fy-form', { ...createForm, start_date: e.target?.value ?? '' }),
                class: 'w-40'
              })
            ]),
            Row({ class: 'flex flex-col gap-1' }, [
              Row({ tagType: 'label', attributes: { for: 'create-fy-end' }, class: 'text-xs font-medium text-gray-600' }, 'End date'),
              Input({
                id: 'create-fy-end',
                type: 'date',
                value: createForm.end_date ?? '',
                onChange: (e) => props.setLocalState('create-fy-form', { ...createForm, end_date: e.target?.value ?? '' }),
                class: 'w-40'
              })
            ]),
            Button({
              variant: 'primary',
              disabled: !!creating || !!loading || hasOpenYear,
              onClick: handleCreateYear
            }, creating ? 'Creating...' : 'Create')
          ]),
          hasOpenYear
            ? Row({ class: 'text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-center gap-2' }, [
                Row({ tagType: 'ion-icon', attributes: { name: 'warning-outline' }, class: 'text-base flex-shrink-0' }),
                `Close fiscal year ${openFy.fiscal_year} before creating a new one.`
              ])
            : null
        ]),
        loading
          ? Row({ class: 'flex items-center justify-center py-12' }, [Spinner({ class: 'w-8 h-8' })])
          : fiscalYears.length === 0
            ? Row({ class: 'py-12 text-center text-gray-600 flex flex-col gap-4 items-center' }, [
                Row({ class: 'text-sm mb-2' }, 'No fiscal years yet. Enter year and dates above to create one.'),
                Row({ class: 'text-xs text-gray-500' }, 'Works with any calendar (Gregorian, Ethiopian, etc.)'),
                
              ])
            : Row({ class: 'border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1 min-h-0' }, [
              Table({ class: 'flex-1' }, [
                TableHeader({}, [
                  TableRow({}, [
                    TableHCell({}, 'Year'),
                    TableHCell({}, 'Start'),
                    TableHCell({}, 'End'),
                    TableHCell({}, 'Status'),
                    TableHCell({}, 'Closed'),
                    TableHCell({ class: 'w-20' }, 'Actions')
                  ])
                ]),
                TableBody({}, [
                  ...fiscalYears.map((fy) =>
                    TableRow({}, [
                      TableDCell({ class: 'font-medium' }, String(fy.fiscal_year)),
                      TableDCell({}, formatDateDDMMYYYY(fy.start_date)),
                      TableDCell({}, formatDateDDMMYYYY(fy.end_date)),
                      TableDCell({}, [
                        Row({
                          class: `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            fy.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                          }`
                        }, fy.status === 'open' ? 'Open' : 'Closed')
                      ]),
                      TableDCell({}, fy.closed_at ? formatDateDDMMYYYY(fy.closed_at) : '-'),
                      TableDCell({}, [
                        ActionDropdown({
                          actionId: `fy-${fy.fiscal_year}`,
                          open: fyActionId === `fy-${fy.fiscal_year}`,
                          onToggle: () => props.setLocalState('fyActionId', fyActionId === `fy-${fy.fiscal_year}` ? null : `fy-${fy.fiscal_year}`)
                        }, [
                          fy.status === 'open'
                            ? ActionItem({
                                label: closingYear ? 'Closing...' : 'Close',
                                icon: 'lock-closed-outline',
                                disabled: !!closingYear,
                                onClick: () => handleCloseYear(fy.fiscal_year)
                              })
                            : null,
                          fy.status === 'open'
                            ? ActionItem({
                                label: 'Delete',
                                icon: 'trash-outline',
                                danger: true,
                                onClick: () => handleDeleteYear(fy)
                              })
                            : null,
                          fy.status === 'closed'
                            ? ActionItem({
                                label: reopeningYear ? 'Reopening...' : 'Reopen',
                                icon: 'lock-open-outline',
                                disabled: !!reopeningYear,
                                onClick: () => handleReopenYear(fy.fiscal_year)
                              })
                            : null,
                          fy.status === 'closed'
                            ? ActionItem({
                                label: 'Report',
                                icon: 'document-text-outline',
                                onClick: () => handleShowReport(fy)
                              })
                            : null
                        ].filter(Boolean))
                      ])
                    ])
                  )
                ])
              ])
            ])
      ])
    ]),
    reportFyYear && (
      Drawer({ openSlide: true, class: 'flex flex-col h-full' }, [
        Card({ class: 'flex flex-col h-full rounded-none border-0' }, [
          CardHeader({ class: 'flex items-center justify-between px-5 h-12 border-b border-gray-200 flex-shrink-0' }, [
            Row({ class: 'text-base font-semibold text-gray-900' }, `Fiscal Year ${reportFyYear} Report`),
            IconButton({ onClick: closeReportDrawer }, [IonIcon({ name: 'close-outline', class: 'text-xl' })])
          ]),
          CardBody({ class: 'flex-1 overflow-y-auto min-h-0 px-5 py-4' }, [
            reportLoading
              ? Row({ class: 'flex items-center justify-center py-12' }, [Spinner({ class: 'w-8 h-8' })])
              : reportData
                ? Row({ class: 'space-y-4' }, [
                    Row({ class: 'grid grid-cols-2 gap-4' }, [
                      Row({ class: 'p-3 rounded-lg bg-gray-50' }, [
                        Row({ class: 'text-xs font-medium text-gray-500' }, 'Deposits total'),
                        Row({ class: 'text-lg font-semibold' }, `Br ${financeFmt(reportData.deposits_total)}`)
                      ]),
                      Row({ class: 'p-3 rounded-lg bg-gray-50' }, [
                        Row({ class: 'text-xs font-medium text-gray-500' }, 'Expenses total'),
                        Row({ class: 'text-lg font-semibold' }, `Br ${financeFmt(reportData.expenses_total)}`)
                      ]),
                      Row({ class: 'p-3 rounded-lg bg-gray-50' }, [
                        Row({ class: 'text-xs font-medium text-gray-500' }, 'Purchases'),
                        Row({ class: 'text-lg font-semibold' }, `${reportData.purchases_count} orders, Br ${financeFmt(reportData.purchases_total)}`)
                      ]),
                      Row({ class: 'p-3 rounded-lg bg-gray-50' }, [
                        Row({ class: 'text-xs font-medium text-gray-500' }, 'Sales'),
                        Row({ class: 'text-lg font-semibold' }, `${reportData.sales_count} orders, Br ${financeFmt(reportData.sales_total)}`)
                      ])
                    ]),
                    Row({ class: 'text-sm font-medium text-gray-700' }, 'Ledger entries'),
                    Row({ class: 'text-sm text-gray-600' }, `${reportData.ledger_entries_count} entries`),
                    reportData.closing_balances?.length > 0
                      ? Row({ class: 'space-y-2' }, [
                          Row({ class: 'text-sm font-medium text-gray-700' }, 'Closing balances (by account)'),
                          Row({ class: 'text-xs text-gray-500 space-y-1' }, reportData.closing_balances.slice(0, 15).map((b) =>
                            Row({}, `${b.account_code} ${b.account_name}: Br ${financeFmt(b.balance)}`)
                          ))
                        ])
                      : null
                  ])
                : null
          ])
        ])
      ])
    )
  ])
}

export function SettingsUI() {
  const viewModel = new SettingsVM()

  const render = (props) => {
    const auth = navigationVM.getState('auth') || {}
    const userRules = (auth.user && auth.user.rules) ? auth.user.rules : []
    const canEdit = Array.isArray(userRules) && userRules.includes('CanEditSettings')

    if (!canEdit) {
      return Row({ class: 'w-full h-full flex items-center justify-center p-8' }, [
        Row({ class: 'text-center max-w-md' }, [
          Row({ tagType: 'ion-icon', attributes: { name: 'lock-closed-outline' }, class: 'text-6xl text-gray-400 mx-auto mb-4' }),
          Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-700 mb-2' }, 'Access denied'),
          Row({ tagType: 'p', class: 'text-gray-500' }, 'Only administrators can view and edit system settings.')
        ])
      ])
    }

    const activeTab = props.viewModel.getSettingsTab()

    return Row({ class: 'w-full h-full flex flex-col overflow-hidden' }, [
      CardHeader({
        class: 'px-6 py-2 text-gray-900 text-md font-semibold flex items-center justify-between flex-shrink-0'
      }, [
        'System Settings',
        Row({ class: 'flex gap-2' }, [
          ...SETTINGS_TABS.map((opt) =>
            Button({
              variant: activeTab === opt.key ? 'primary' : 'outline',
              class: 'w-35 flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition',
              onClick: () => props.viewModel.setSettingsTab(opt.key)
            }, [
              Row({ tagType: 'ion-icon', attributes: { name: opt.icon, class: 'text-lg' } }),
              opt.label
            ])
          ),
        ]),
      ]),
      CardBody({ class: 'flex flex-col overflow-hidden flex-1 min-h-0' }, [
        activeTab === 'general' && GeneralTab(props),
        activeTab === 'fiscal-year' && FiscalYearTab(props)
      ])
    ])
  }

  return StatefulRow({
    id: 'SettingsUI',
    class: 'w-full h-full overflow-hidden',
    viewModel,
    stateKeys: ['loading', 'settings-active-tab', 'form', 'error', 'success', 'fiscal-years', 'current-fiscal-year', 'fiscal-years-loading', 'fiscal-years-error', 'close-fiscal-year-loading', 'reopen-fiscal-year-loading', 'create-fiscal-year-loading', 'report-fy-year', 'report-data', 'report-loading']
  }, (props) => {
    const auth = navigationVM.getState('auth') || {}
    const userRules = (auth.user && auth.user.rules) ? auth.user.rules : []
    const canEdit = Array.isArray(userRules) && userRules.includes('CanEditSettings')
    if (canEdit && props.viewModel.getState('form') === undefined && !props.viewModel.getState('loading')) {
      props.viewModel.loadSettings()
    }
    return render(props)
  })
}
