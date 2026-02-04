import { Button } from '../../../utils/Button';
import { Input } from '../../../utils/Input';
import { SelectFluid, SelectOptions, SelectRelative } from '../../../utils/Select';
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table';
import { ActionDropdown, ActionItem } from '../../../utils/Action';
import { IconButton, IonIcon } from '../../../utils/Icon';
import { showAlert } from '../../../utils/ModalHelpers';
import { formatDateDDMMYYYY } from '../../../utils/DateUtils';
import { openReceiptModal } from '../ReceiptModal';
import { OrderDetailsDrawer } from '../OrderDetailsDrawer';

const { Row } = Liteframe;

const DRAWER_CLOSE_MS = 350;

const FILTER_SMALL_CLASS = 'text-xs py-1 px-2 min-h-0';
const SELECT_SMALL_CLASS = 'text-xs py-1 pl-2 pr-6 min-h-0';

export function OrderHistory(props) {
  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }, [
    OrderHistoryStatsAndFilters(props),
    OrderHistoryTableSection(props),
    props.getLocalState('drawerOrderId') && orderDetailsDrawer(props),
  ]);
}

function OrderHistoryStatsAndFilters(props) {
  props.ensureLocalStateKey('showStatsCards', true);
  props.ensureLocalStateKey('searchInput', (props.viewModel.getState('order-table-config') || {}).search || '');
  props.ensureLocalStateKey('statusFilter', (props.viewModel.getState('order-table-config') || {}).status || 'completed');
  props.ensureLocalStateKey('paymentModeFilter', (props.viewModel.getState('order-table-config') || {}).payment_mode || '');
  props.ensureLocalStateKey('dateFrom', (props.viewModel.getState('order-table-config') || {}).date_from || '');
  props.ensureLocalStateKey('dateTo', (props.viewModel.getState('order-table-config') || {}).date_to || '');

  const showCards = props.getLocalState('showStatsCards');
  const tableConfig = props.viewModel.getState('order-table-config') || {};
  const statFilter = tableConfig.stat_filter || 'all';
  const orderList = props.viewModel.getOrderList();
  const stats = orderList.stats || {};

  const handleFilterChange = (filterName, value) => {
    props.viewModel.updateOrderTableConfig({ [filterName]: value || null, offset: 0 });
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

  const financeFormat = (v) =>
    (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statsArray = [
    { key: 'all', title: 'Total Orders', icon: 'document-text-outline', value: (stats.total_orders?.count ?? 0).toLocaleString(), subtitle: 'All completed orders', primary: stats.total_orders?.value != null ? `Br ${financeFormat(stats.total_orders.value)}` : null, color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', hoverBg: 'hover:bg-gray-100' },
    { key: 'cash', title: 'Cash Orders', icon: 'cash-outline', value: (stats.cash_orders?.count ?? 0).toLocaleString(), subtitle: 'Paid in cash', primary: stats.cash_orders?.value != null ? `Br ${financeFormat(stats.cash_orders.value)}` : null, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', hoverBg: 'hover:bg-blue-100' },
    { key: 'credit', title: 'Credit Orders', icon: 'card-outline', value: (stats.credit_orders?.count ?? 0).toLocaleString(), subtitle: 'Credit / cheque', primary: stats.credit_orders?.value != null ? `Br ${financeFormat(stats.credit_orders.value)}` : null, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', hoverBg: 'hover:bg-orange-100' },
    { key: 'outstanding', title: 'Outstanding', icon: 'alert-circle-outline', value: (stats.outstanding_balance?.count ?? 0).toLocaleString(), subtitle: 'With balance due', primary: stats.outstanding_balance?.value != null ? `Br ${financeFormat(stats.outstanding_balance.value)}` : null, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', hoverBg: 'hover:bg-red-100' },
  ];

  return Row({ class: 'flex flex-col flex-shrink-0' }, [
    Row({ class: 'flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0 flex-wrap' }, [
      Button({ variant: 'outline', class: 'text-xs px-2 py-1 min-h-0', onClick: () => props.setLocalState('showStatsCards', !showCards) }, showCards ? 'Hide stats' : 'Show stats'),
      Row({ class: 'flex items-center  gap-2' }, [
        ...['all', 'cash', 'credit', 'outstanding'].map((key) =>
          Button({
            variant: statFilter === key ? 'primary' : 'outline',
            class: 'text-xs px-2 py-1 min-h-0',
            onClick: () => props.viewModel.updateOrderStatFilter(key),
          }, key === 'all' ? 'All' : key === 'outstanding' ? 'Outstanding' : key.charAt(0).toUpperCase() + key.slice(1))
        ),
      // ]),
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
            handleFilterChange('payment_mode', configVal);
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
      Row({ class: 'flex items-center justify-between mb-3' }, [Row({ class: 'text-base font-semibold text-gray-800' }, 'Order overview')]),
      Row({ class: 'grid grid-cols-2 md:grid-cols-4 gap-3' }, [
        ...statsArray.map((stat) => OrderHistoryCard({ ...stat, isSelected: statFilter === stat.key, onClick: () => props.viewModel.updateOrderStatFilter(stat.key) })),
      ]),
    ]),
  ]);
}

function OrderHistoryTableSection(props) {
  const orderList = props.viewModel.getOrderList();
  const orders = orderList.orders || [];
  const total = orderList.total || 0;
  const loading = props.viewModel.getState('loading');
  const tableConfig = props.viewModel.getState('order-table-config') || {};

  props.ensureLocalStateKey('searchInput', tableConfig.search || '');
  props.ensureLocalStateKey('actionId', null);
  props.ensureLocalStateKey('drawerOrderId', null);
  props.ensureLocalStateKey('drawerContentType', 'details');
  props.ensureLocalStateKey('showOrderDrawer', false);

  const actionId = props.getLocalState('actionId');

  const handleSearchChange = (e) => {
    const value = e.target.value;
    props.setLocalState('searchInput', value);
    clearTimeout(props.getLocalState('searchTimeout'));
    const timeout = setTimeout(() => {
      props.viewModel.updateOrderTableConfig({ search: value, offset: 0 });
    }, 500);
    props.setLocalState('searchTimeout', timeout);
  };

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
      await props.viewModel.preparePaymentForOrder(orderId);
      props.setLocalState('drawerOrderId', orderId);
      props.setLocalState('drawerContentType', 'payment');
      setTimeout(() => props.setLocalState('showOrderDrawer', true), 0);
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to load payment', variant: 'error' });
    }
  };

  const handleShowReceipt = (orderId) => {
    openReceiptModal({ orderId });
  };

  const getStatusBadge = (status) => {
    const badges = { completed: { class: 'bg-green-100 text-green-800', label: 'Completed' }, archived: { class: 'bg-gray-100 text-gray-800', label: 'Archived' }, reversed: { class: 'bg-red-100 text-red-800', label: 'Reversed' } };
    const b = badges[status] || badges.completed;
    return Row({ class: `px-2 py-1 rounded text-xs font-medium ${b.class}` }, b.label);
  };

  const getPaymentStatusBadge = (outstanding) => {
    const value = Number(outstanding ?? 0);
    if (value <= 0.01) return Row({ class: 'px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800' }, 'Paid');
    return Row({ class: 'px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800' }, 'Outstanding');
  };

  const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const paginationLimit = tableConfig.limit || 20;
  const paginationOffset = tableConfig.offset || 0;
  const initRow = total > 0 ? paginationOffset + 1 : 0;
  const endRow = total > 0 ? Math.min(paginationOffset + paginationLimit, total) : 0;

  const handleSortChange = (column) => {
    const currentSortBy = tableConfig.sort_by || 'order_date';
    const currentOrderBy = tableConfig.order_by || 'desc';
    const newOrderBy = currentSortBy === column ? (currentOrderBy === 'asc' ? 'desc' : 'asc') : 'asc';
    props.viewModel.updateOrderTableConfig({ sort_by: column, order_by: newOrderBy, offset: 0 });
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

  const handleSetLimit = (newLimit) => {
    props.viewModel.updateOrderTableConfig({ limit: newLimit, offset: 0 });
  };
  const handlePreviousPage = () => {
    props.viewModel.updateOrderTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) });
  };
  const handleNextPage = () => {
    props.viewModel.updateOrderTableConfig({ offset: paginationOffset + paginationLimit });
  };

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden py-4' }, [
    Row({ class: 'flex items-center justify-between gap-4 px-4 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0' }, [
      Row({ class: 'flex-1 min-w-[200px] max-w-md' }, [
        Row({ class: 'relative' }, [
          IonIcon({ name: 'search-outline', class: 'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none' }),
          Input({
            type: 'text',
            placeholder: 'Search receipt #, supplier...',
            class: 'pl-10 pr-4 w-full',
            value: props.getLocalState('searchInput') || '',
            onInput: handleSearchChange,
          }),
        ]),
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({
          name: 'order-limit',
          onChange: (e) => handleSetLimit(parseInt(e.target.value, 10)),
          value: paginationLimit,
        }, SelectOptions({
          options: ['10', '25', '50', '100'],
          selectedOption: String(paginationLimit),
        })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' },
            total > 0 ? `${initRow}-${endRow} of ${total}` : '0-0 of 0'
          ),
          IconButton({
            onClick: handlePreviousPage,
            disabled: paginationOffset === 0 || loading,
          }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({
            onClick: handleNextPage,
            disabled: paginationOffset + paginationLimit >= total || loading,
          }, [IonIcon({ name: 'caret-forward-outline' })])
        ]),
      ]),
    ]),
    loading
      ? Row({ class: 'p-8 text-center text-gray-500' }, 'Loading orders...')
      : orders.length === 0
        ? Row({ class: 'p-8 text-center text-gray-500' }, 'No orders found')
        : Row({ class: 'flex-1 flex flex-col min-h-0 border border-gray-200 rounded-lg overflow-hidden' }, [
            Table({
              class: 'flex-1 min-w-full overflow-hidden',
              getOpenActionState: () => props.getLocalState('actionId'),
              setOpenActionState: () => props.setLocalState('actionId', null),
            }, [
              TableHeader({}, [
                TableRow({}, [
                  TableHCell({ class: 'text-nowrap', onClick: () => handleSortChange('receipt_no') }, [
                    'Receipt #',
                    sortIcon('receipt_no'),
                  ]),
                  TableHCell({ onClick: () => handleSortChange('supplier_name') }, [
                    'Supplier',
                    sortIcon('supplier_name'),
                  ]),
                  TableHCell({ class: 'text-nowrap', onClick: () => handleSortChange('order_date') }, [
                    'Date',
                    sortIcon('order_date'),
                  ]),
                  TableHCell({ class: 'text-nowrap', onClick: () => handleSortChange('net_amount') }, [
                    'Amount',
                    sortIcon('net_amount'),
                  ]),
                  TableHCell({ class: 'text-nowrap' }, 'Payment Mode'),
                  TableHCell({ class: 'text-nowrap' }, 'Status'),
                  TableHCell({ class: 'text-nowrap' }, 'Outstanding'),
                  TableHCell({ class: 'w-24' }, 'Actions'),
                ]),
              ]),
              TableBody({ class: 'flex-1 min-h-0 overflow-y-auto' }, [
                orders.map((order) =>
                  TableRow({ key: order.id }, [
                    TableDCell({ class: 'font-medium' }, order.receipt_number || `PO${order.id}`),
                    TableDCell({}, order.supplier_name || 'Unknown'),
                    TableDCell({}, formatDateDDMMYYYY(order.order_date)),
                    TableDCell({ class: 'font-medium' }, `Br ${financeFormat(order.net_amount)}`),
                    TableDCell({}, Row({ class: 'capitalize' }, order.payment_mode || 'cash')),
                    TableDCell({}, getStatusBadge(order.status)),
                    TableDCell({}, getPaymentStatusBadge(Number(order.outstanding_balance ?? 0))),
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
                        order.status === 'completed'
                          ? ActionItem({
                              label: 'Show receipt',
                              icon: 'receipt-outline',
                              onClick: () => {
                                props.setLocalState('actionId', null);
                                handleShowReceipt(order.id);
                              },
                            })
                          : null,
                      ].filter(Boolean)),
                    ]),
                  ])
                ),
              ]),
            ]),
          ]),
  ]);
}

function orderDetailsDrawer(props) {
  props.ensureLocalStateKey('showOrderDrawer', false);

  const showOrderDrawer = props.getLocalState('showOrderDrawer');
  const drawerContentType = props.getLocalState('drawerContentType') || 'details';
  const drawerOrderId = props.getLocalState('drawerOrderId');

  const onClose = () => {
    props.setLocalState('showOrderDrawer', false);
    setTimeout(() => {
      props.setLocalState('drawerOrderId', null);
      props.setLocalState('drawerContentType', 'details');
    }, DRAWER_CLOSE_MS);
  };

  const onSwitchToPayment = () => {
    props.setLocalState('drawerContentType', 'payment');
  };

  return OrderDetailsDrawer({
    ...props,
    showSlide: showOrderDrawer,
    onClose,
    contentType: drawerContentType,
    onSwitchToPayment,
  });
}

function OrderHistoryCard({ key, title, icon, value, subtitle, primary, color, bgColor, borderColor, hoverBg, isSelected, onClick }) {
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
