import { Button } from '../../../utils/Button';
import { Input } from '../../../utils/Input';
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table';
import { ActionDropdown, ActionItem } from '../../../utils/Action';
import { IconButton, IonIcon } from '../../../utils/Icon';
import { SelectFluid, SelectOptions, SelectRelative } from '../../../utils/Select';
import { showAlert } from '../../../utils/ModalHelpers';
import { formatDateDDMMYYYY } from '../../../utils/DateUtils';
import { openReceiptModal } from '../ReceiptModal';
import { SalesOrderDetailsDrawer } from '../SalesOrderDetailsDrawer';

const { Row } = Liteframe;

const DRAWER_CLOSE_MS = 350;
const FILTER_SMALL_CLASS = 'text-xs py-1 px-2 min-h-0';
const SELECT_SMALL_CLASS = 'text-xs py-1 pl-2 pr-6 min-h-0';

export function SalesHistory(props) {
  const { pendingSalesOpen, navigationVM } = props
  props.ensureLocalStateKey('pendingSalesOpenProcessed', false)
  const processed = props.getLocalState('pendingSalesOpenProcessed')

  // Cross-module: open drawer when navigated from ReceivablesTab (View in Sales / Make Payment)
  props.ensureLocalStateKey('drawerOrderId', null)
  props.ensureLocalStateKey('showOrderDrawer', false)

  if (pendingSalesOpen && !processed) {
    props.setLocalState('pendingSalesOpenProcessed', true)
    const openFromPending = async () => {
      try {
        await props.viewModel.loadOrderDetails(pendingSalesOpen.orderId)
        props.setLocalState('drawerOrderId', pendingSalesOpen.orderId)
        props.setLocalState('drawerContentType', pendingSalesOpen.contentType === 'payment' ? 'payment' : 'details')
        requestAnimationFrame(() => props.setLocalState('showOrderDrawer', true))
      } catch (error) {
        await showAlert({ message: error.message || 'Failed to load order details', variant: 'error' })
        props.setLocalState('pendingSalesOpenProcessed', false)
      } finally {
        if (navigationVM) navigationVM.updateState('pending-sales-open', null)
      }
    }
    openFromPending()
  } else if (!pendingSalesOpen && processed) {
    props.setLocalState('pendingSalesOpenProcessed', false)
  }

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }, [
    SalesHistoryStatsAndFilters(props),
    SalesHistoryTableSection(props),
    props.getLocalState('drawerOrderId') && salesOrderDetailsDrawer(props),
  ])
}

function SalesHistoryStatsAndFilters(props) {
  props.ensureLocalStateKey('showStatsCards', true);
  props.ensureLocalStateKey('searchInput', (props.viewModel.getState('sales-order-table-config') || {}).search || '');
  props.ensureLocalStateKey('statusFilter', (props.viewModel.getState('sales-order-table-config') || {}).status || 'completed');
  props.ensureLocalStateKey('paymentModeFilter', (props.viewModel.getState('sales-order-table-config') || {}).payment_type || (props.viewModel.getState('sales-order-table-config') || {}).payment_mode || '');
  props.ensureLocalStateKey('dateFrom', (props.viewModel.getState('sales-order-table-config') || {}).date_from || '');
  props.ensureLocalStateKey('dateTo', (props.viewModel.getState('sales-order-table-config') || {}).date_to || '');

  const showCards = props.getLocalState('showStatsCards');
  const tableConfig = props.viewModel.getState('sales-order-table-config') || {};
  const statFilter = tableConfig.stat_filter || 'all';
  const salesOrderList = props.viewModel.getSalesOrderList();
  const stats = salesOrderList.stats || {};

  const handleFilterChange = (filterName, value) => {
    props.viewModel.updateSalesOrderTableConfig({ [filterName]: value || null, offset: 0 });
  };

  

  const statusOptions = ['All Status', 'Completed', 'Archived', 'Reversed'];
  const modeOptions = ['All Modes', 'Cash', 'Credit', 'Cheque'];

  function evaluateStatusValue(v) {
    if (v === 'All Status') return null;
    if (v === 'Completed') return 'completed';
    if (v === 'Archived') return 'archived';
    if (v === 'Reversed') return 'reversed';
    return null;
  }
  function evaluatePaymentModeValue(v) {
    if (v === 'All Modes') return null;
    if (v === 'Cash') return 'cash';
    if (v === 'Credit') return 'credit';
    if (v === 'Cheque') return 'cheque';
    return null;
  }
  function getStatusLabel(configVal) {
    if (configVal == null || configVal === '') return 'All Status';
    if (configVal === 'completed') return 'Completed';
    if (configVal === 'archived') return 'Archived';
    if (configVal === 'reversed') return 'Reversed';
    return 'All Status';
  }
  function getPaymentModeLabel(configVal) {
    if (configVal == null || configVal === '') return 'All Modes';
    if (configVal === 'cash') return 'Cash';
    if (configVal === 'credit') return 'Credit';
    if (configVal === 'cheque') return 'Cheque';
    return 'All Modes';
  }

  const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const statsArray = [
    { key: 'all', title: 'All', icon: 'document-text-outline', value: (stats.all?.count ?? 0).toLocaleString(), subtitle: 'Total sales (excl. reversed/archived)', primary: stats.all?.value != null ? `Br ${financeFormat(stats.all.value)}` : null, color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', hoverBg: 'hover:bg-gray-100' },
    { key: 'withhold_unconfirmed', title: 'Withhold Unconfirmed', icon: 'time-outline', value: (stats.withhold_unconfirmed?.count ?? 0).toLocaleString(), subtitle: 'Withhold not confirmed, unsettled', primary: stats.withhold_unconfirmed?.value != null ? `Br ${financeFormat(stats.withhold_unconfirmed.value)}` : null, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', hoverBg: 'hover:bg-amber-100' },
    { key: 'withhold_confirmed', title: 'Withhold Confirmed', icon: 'checkmark-circle-outline', value: (stats.withhold_confirmed?.count ?? 0).toLocaleString(), subtitle: 'Confirmed, unsettled', primary: stats.withhold_confirmed?.value != null ? `Br ${financeFormat(stats.withhold_confirmed.value)}` : null, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', hoverBg: 'hover:bg-blue-100' },
    { key: 'settled', title: 'Settled', icon: 'checkmark-done-outline', value: (stats.settled?.count ?? 0).toLocaleString(), subtitle: 'Withhold confirmed and settled', primary: stats.settled?.value != null ? `Br ${financeFormat(stats.settled.value)}` : null, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', hoverBg: 'hover:bg-green-100' },
    { key: 'unsettled', title: 'Unsettled', icon: 'hourglass-outline', value: (stats.unsettled?.count ?? 0).toLocaleString(), subtitle: 'Withhold not settled', primary: stats.unsettled?.value != null ? `Br ${financeFormat(stats.unsettled.value)}` : null, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', hoverBg: 'hover:bg-orange-100' },
    { key: 'outstanding', title: 'Outstanding', icon: 'alert-circle-outline', value: (stats.outstanding?.count ?? 0).toLocaleString(), subtitle: 'Balance due', primary: stats.outstanding?.value != null ? `Br ${financeFormat(stats.outstanding.value)}` : null, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', hoverBg: 'hover:bg-red-100' },
  ];

  return Row({ class: 'flex flex-col flex-shrink-0' }, [
    Row({ class: 'flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0 flex-wrap' }, [
      Button({ variant: 'outline', class: 'text-xs px-2 py-1 min-h-0', onClick: () => props.setLocalState('showStatsCards', !showCards) }, showCards ? 'Hide stats' : 'Show stats'),
      Row({ class: 'flex items-center gap-2' }, [
        ...['all', 'withhold_unconfirmed', 'withhold_confirmed', 'settled', 'unsettled', 'outstanding'].map((key) =>
          Button({
            variant: statFilter === key ? 'primary' : 'outline',
            class: 'text-xs px-2 py-1 min-h-0',
            onClick: () => props.viewModel.updateOrderStatFilter(key),
          }, key === 'all' ? 'All' : key === 'withhold_unconfirmed' ? 'Unconfirmed' : key === 'withhold_confirmed' ? 'Confirmed' : key === 'outstanding' ? 'Outstanding' : key.charAt(0).toUpperCase() + key.slice(1))
        ),
      Row({ class: 'w-24' }, [
        SelectFluid({
          value: getStatusLabel(props.getLocalState('statusFilter')),
          selectClass: SELECT_SMALL_CLASS,
          containerClass: 'w-full',
          onChange: (e) => {
            const label = e.target.value;
            const configVal = evaluateStatusValue(label);
            props.setLocalState('statusFilter', configVal);
            handleFilterChange('status', configVal);
          },
        }, [SelectOptions({ options: statusOptions, selectedOption: getStatusLabel(props.getLocalState('statusFilter')) })]),
      ]),
      Row({ class: 'w-24' }, [
        SelectFluid({
          value: getPaymentModeLabel(props.getLocalState('paymentModeFilter')),
          selectClass: SELECT_SMALL_CLASS,
          containerClass: 'w-full',
          onChange: (e) => {
            const label = e.target.value;
            const configVal = evaluatePaymentModeValue(label);
            props.setLocalState('paymentModeFilter', configVal);
            handleFilterChange('payment_type', configVal);
          },
        }, [SelectOptions({ options: modeOptions, selectedOption: getPaymentModeLabel(props.getLocalState('paymentModeFilter')) })]),
      ]),
      Row({}, [
        Input({
          type: 'date',
          placeholder: 'From',
          class: `${FILTER_SMALL_CLASS} w-28`,
          value: props.getLocalState('dateFrom') || '',
          onChange: (e) => {
            props.setLocalState('dateFrom', e.target.value);
            handleFilterChange('date_from', e.target.value || null);
          },
        }),
      ]),
      Row({}, [
        Input({
          type: 'date',
          placeholder: 'To',
          class: `${FILTER_SMALL_CLASS} w-28`,
          value: props.getLocalState('dateTo') || '',
          onChange: (e) => {
            props.setLocalState('dateTo', e.target.value);
            handleFilterChange('date_to', e.target.value || null);
          },
        }),
      ]),
    ]),
    ]),
    showCards && Row({ class: 'w-full px-4 py-4 flex-shrink-0' }, [
      Row({ class: 'flex items-center justify-between mb-3' }, [Row({ class: 'text-base font-semibold text-gray-800' }, 'Sales overview')]),
      Row({ class: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3' }, [
        ...statsArray.map((stat) => SalesHistoryCard({ ...stat, isSelected: statFilter === stat.key, onClick: () => props.viewModel.updateOrderStatFilter(stat.key) })),
      ]),
    ]),
  ]);
}

function SalesHistoryCard({ title, icon, value, subtitle, primary, color, bgColor, borderColor, hoverBg, isSelected, onClick }) {
  const selectedClasses = isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-md' : '';
  return Row(
    {
      class: `flex flex-col gap-2 p-3 rounded-lg border ${bgColor} ${borderColor} ${hoverBg} ${color} cursor-pointer transition-all duration-200 ${selectedClasses}`,
      events: onClick ? { click: onClick } : {},
    },
    [
      Row({ class: 'flex items-center justify-between' }, [
        Row({ class: 'text-xs font-medium opacity-80 truncate flex-1' }, title),
        IonIcon({ name: icon, class: `text-xl opacity-80 ${color} flex-shrink-0 ml-2` }),
      ]),
      primary
        ? Row({ class: 'flex flex-col gap-1' }, [Row({ class: 'text-lg font-bold' }, primary), Row({ class: 'text-xs opacity-70' }, value)])
        : Row({ class: 'text-xl font-bold' }, value),
      Row({ class: 'text-xs opacity-70 leading-tight' }, subtitle),
    ]
  );
}

function SalesHistoryTableSection(props) {
  props.ensureLocalStateKey('actionId', null);
  props.ensureLocalStateKey('drawerOrderId', null);
  props.ensureLocalStateKey('drawerContentType', 'details');
  props.ensureLocalStateKey('showOrderDrawer', false);

  const salesOrderList = props.viewModel.getSalesOrderList();
  const orders = salesOrderList.orders || [];
  const total = salesOrderList.total || 0;
  const loading = props.viewModel.getState('loading');
  const tableConfig = props.viewModel.getState('sales-order-table-config') || {};
  props.ensureLocalStateKey('searchInput', tableConfig.search || '');

  const drawerOrderId = props.getLocalState('drawerOrderId');
  const showOrderDrawer = props.getLocalState('showOrderDrawer');
  const drawerContentType = props.getLocalState('drawerContentType');

  const handleViewOrder = async (orderId) => {
    try {
      await props.viewModel.loadOrderDetails(orderId);
      props.setLocalState('drawerOrderId', orderId);
      props.setLocalState('drawerContentType', 'details');
      setTimeout(() => props.setLocalState('showOrderDrawer', true), 0);
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to load order details', variant: 'error' });
    }
  };

  const handlePayOrder = async (orderId) => {
    try {
      await props.viewModel.loadOrderDetails(orderId);
      props.setLocalState('drawerOrderId', orderId);
      props.setLocalState('drawerContentType', 'payment');
      setTimeout(() => props.setLocalState('showOrderDrawer', true), 0);
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to load order', variant: 'error' });
    }
  };

  const handleConfirmWithhold = async (orderId) => {
    try {
      await props.viewModel.loadOrderDetails(orderId);
      props.setLocalState('drawerOrderId', orderId);
      props.setLocalState('drawerContentType', 'confirm-withhold');
      setTimeout(() => props.setLocalState('showOrderDrawer', true), 0);
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to load order', variant: 'error' });
    }
  };

  const handleRollbackWithhold = async (orderId) => {
    try {
      await props.viewModel.loadOrderDetails(orderId);
      props.setLocalState('drawerOrderId', orderId);
      props.setLocalState('drawerContentType', 'rollback-withhold');
      setTimeout(() => props.setLocalState('showOrderDrawer', true), 0);
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to load order', variant: 'error' });
    }
  };

  const handleReverseOrder = async (orderId) => {
    try {
      await props.viewModel.loadOrderDetails(orderId);
      props.setLocalState('drawerOrderId', orderId);
      props.setLocalState('drawerContentType', 'reverse');
      setTimeout(() => props.setLocalState('showOrderDrawer', true), 0);
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to load order', variant: 'error' });
    }
  };

  const onCloseDrawer = () => {
    props.setLocalState('showOrderDrawer', false);
    setTimeout(() => {
      props.setLocalState('drawerOrderId', null);
      props.setLocalState('drawerContentType', 'details');
    }, DRAWER_CLOSE_MS);
    props.viewModel.closeOrderDrawer();
  };

  const setDrawerContentType = (type) => props.setLocalState('drawerContentType', type);

  const paginationLimit = tableConfig.limit || 20;
  const paginationOffset = tableConfig.offset || 0;
  const initRow = total > 0 ? paginationOffset + 1 : 0;
  const endRow = total > 0 ? Math.min(paginationOffset + paginationLimit, total) : 0;

  const handleSearchChange = (e) => {
    const value = e.target.value;
    props.setLocalState('searchInput', value);
    clearTimeout(props.getLocalState('searchTimeout'));
    const timeout = setTimeout(() => props.viewModel.updateSalesOrderTableConfig({ search: value, offset: 0 }), 500);
    props.setLocalState('searchTimeout', timeout);
  };

  const handleSetLimit = (newLimit) => props.viewModel.updateSalesOrderTableConfig({ limit: newLimit, offset: 0 });
  const handlePreviousPage = () => props.viewModel.updateSalesOrderTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) });
  const handleNextPage = () => props.viewModel.updateSalesOrderTableConfig({ offset: paginationOffset + paginationLimit });

  const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const actionId = props.getLocalState('actionId');
  const getStatusBadge = (order) => {
    if (order.is_reversed) return Row({ class: 'px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800' }, 'Reversed');
    return Row({ class: 'px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800' }, order.status || 'Completed');
  };
  const getOutstandingBadge = (outstanding) => {
    const val = Number(outstanding ?? 0);
    if (val <= 0.01) return Row({ class: 'px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800' }, 'Paid');
    return Row({ class: 'px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800' }, 'Outstanding');
  };

  const handleSortChange = (column) => {
    const currentSortBy = tableConfig.sort_by || 'id';
    const currentOrderBy = tableConfig.order_by || 'desc';

    const newOrderBy = currentSortBy === column ? (currentOrderBy === 'asc' ? 'desc' : 'asc') : 'asc';
    props.viewModel.updateSalesOrderTableConfig({ sort_by: column, order_by: newOrderBy, offset: 0 });
  };

  const sortIcon = (column) => {
    const orderBy = tableConfig.order_by;
    const sortBy = tableConfig.sort_by;
    if (column === sortBy) {
      return IonIcon({ 
        name: orderBy === 'asc' ? 'chevron-up-outline' : 'chevron-down-outline', 
        class: 'text-sm text-indigo-600 ml-1',
      });
    }
    return null;
  };

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden py-4' }, [
    Row({ class: 'flex items-center justify-between gap-4 px-4 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0' }, [
      Row({ class: 'flex-1 min-w-[200px] max-w-md' }, [
        Row({ class: 'relative' }, [
          IonIcon({ name: 'search-outline', class: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none' }),
          Input({ type: 'text', placeholder: 'Search receipt #, customer...', class: 'pl-10 pr-4 w-full', value: props.getLocalState('searchInput') || '', onInput: handleSearchChange }),
        ]),
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({ name: 'sales-limit', onChange: (e) => handleSetLimit(parseInt(e.target.value, 10)), value: paginationLimit }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, total > 0 ? `${initRow}-${endRow} of ${total}` : '0-0 of 0'),
          IconButton({ onClick: handlePreviousPage, disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: handleNextPage, disabled: paginationOffset + paginationLimit >= total || loading }, [IonIcon({ name: 'caret-forward-outline' })]),
        ]),
      ]),
    ]),
    loading
      ? Row({ class: 'p-8 text-center text-gray-500' }, 'Loading sales...')
      : orders.length === 0
        ? Row({ class: 'p-8 text-center text-gray-500' }, 'No sales found')
        : Row({ class: 'flex-1 flex flex-col min-h-0 border border-gray-200 rounded-lg overflow-hidden px-4 py-4' }, [
            Table({ class: 'flex-1 min-w-full overflow-hidden' }, [
              TableHeader({}, [
                TableRow({}, [
                  TableHCell({ class: 'text-nowrap', onClick: () => handleSortChange('receipt_no') }, [
                    'Receipt #',
                    sortIcon('receipt_no')
                  ]),
                  TableHCell({ onClick: () => handleSortChange('customer_name') }, [
                    'Customer',
                    sortIcon('customer_name')
                  ]),
                  TableHCell({ class: 'text-nowrap', onClick: () => handleSortChange('order_date') }, [
                    'Date',
                    sortIcon('order_date')
                  ]),
                  TableHCell({ class: 'text-nowrap', onClick: () => handleSortChange('net_amount') }, [
                    'Amount',
                    sortIcon('net_amount')
                  ]),
                  TableHCell({ class: 'text-nowrap', onClick: () => handleSortChange('payment_type') }, [
                    'Payment',
                    sortIcon('payment_type')
                  ]),
                  TableHCell({ class: 'text-nowrap' }, 'Status'),
                  TableHCell({ class: 'text-nowrap' }, 'Outstanding'),
                  TableHCell({ class: 'w-24' }, 'Actions'),
                ]),
              ]),
              TableBody({ class: 'flex-1 min-h-0 overflow-y-auto' }, orders.map((order) =>
                TableRow({ key: order.id }, [
                  TableDCell({ class: 'font-medium' }, order.receipt_no || `SO${order.id}`),
                  TableDCell({}, order.customer_name || 'Walk-in'),
                  TableDCell({}, formatDateDDMMYYYY(order.order_date)),
                  TableDCell({ class: 'font-medium' }, `Br ${financeFormat(order.net_amount)}`),
                  TableDCell({}, (order.payment_type || 'cash').toLowerCase()),
                  TableDCell({}, getStatusBadge(order)),
                  TableDCell({}, getOutstandingBadge(order.outstanding_balance)),
                  TableDCell({ class: 'text-center px-4 py-3' }, [
                    ActionDropdown({
                      actionId: order.id,
                      open: order.id === actionId,
                      onToggle: () => props.setLocalState('actionId', actionId === order.id ? null : order.id),
                      class: 'text-center',
                    }, [
                      ActionItem({
                        label: 'View',
                        icon: 'eye-outline',
                        onClick: () => {
                          props.setLocalState('actionId', null);
                          handleViewOrder(order.id);
                        },
                      }),
                      ActionItem({
                        label: 'View receipt',
                        icon: 'receipt-outline',
                        onClick: () => {
                          props.setLocalState('actionId', null);
                          openReceiptModal({ orderId: order.id });
                        },
                      }),
                      Number(order.outstanding_balance ?? 0) > 0.01
                        ? ActionItem({
                            label: 'Make payment',
                            icon: 'cash-outline',
                            onClick: () => {
                              props.setLocalState('actionId', null);
                              handlePayOrder(order.id);
                            },
                          })
                        : null,
                      Number(order.withhold_amount ?? 0) > 0.009 && !order.withhold_confirmation
                        ? ActionItem({
                            label: 'Confirm withhold',
                            icon: 'checkmark-circle-outline',
                            onClick: () => {
                              props.setLocalState('actionId', null);
                              handleConfirmWithhold(order.id);
                            },
                          })
                        : null,
                      order.withhold_confirmation
                        ? ActionItem({
                            label: 'Rollback withhold',
                            icon: 'arrow-undo-outline',
                            onClick: () => {
                              props.setLocalState('actionId', null);
                              handleRollbackWithhold(order.id);
                            },
                          })
                        : null,
                      !order.is_reversed
                        ? ActionItem({
                            label: 'Reverse order',
                            icon: 'close-circle-outline',
                            onClick: () => {
                              props.setLocalState('actionId', null);
                              handleReverseOrder(order.id);
                            },
                          })
                        : null,
                    ].filter(Boolean)),
                  ]),
                ])
              )),
            ]),
          ]),
  ]);
}

function salesOrderDetailsDrawer(props) {
  const drawerOrderId = props.getLocalState('drawerOrderId');
  const showOrderDrawer = props.getLocalState('showOrderDrawer');
  const drawerContentType = props.getLocalState('drawerContentType') || 'details';

  const onCloseDrawer = () => {
    props.setLocalState('showOrderDrawer', false);
    setTimeout(() => {
      props.setLocalState('drawerOrderId', null);
      props.setLocalState('drawerContentType', 'details');
    }, DRAWER_CLOSE_MS);
    props.viewModel.closeOrderDrawer();
  };

  const setDrawerContentType = (type) => props.setLocalState('drawerContentType', type);

  return SalesOrderDetailsDrawer({
    ...props,
    showSlide: showOrderDrawer,
    drawerContentType,
    setDrawerContentType,
    onClose: onCloseDrawer,
  });
}
