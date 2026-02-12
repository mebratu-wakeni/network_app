import Drawer from '../../../shared/ExampleDrawer';
import { CardHeader, CardFooter } from '../../../utils/Card';
import { Button } from '../../../utils/Button';
import { Input } from '../../../utils/Input';
import { SelectRelative, SelectOptions } from '../../../utils/Select';
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table';
import { ActionDropdown, ActionItem } from '../../../utils/Action';
import { IconButton, IonIcon } from '../../../utils/Icon';
import { showAlert, showConfirmation } from '../../../utils/ModalHelpers';
import { formatDateDDMMYYYY } from '../../../utils/DateUtils';

const { Row } = Liteframe;

const FILTER_BTN_CLASS = 'text-xs px-2 py-1 min-h-0';
const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function HoldOrders(props) {
  const holdOrderList = props.viewModel.getHoldOrderList();
  const holdOrders = holdOrderList.hold_orders || [];
  const total = holdOrderList.total || 0;
  const loading = props.viewModel.getState('loading');
  const tableConfig = props.viewModel.getState('hold-order-table-config') || {};
  const selectedHoldOrder = props.viewModel.getState('selected-hold-order');
  const holdDrawerOpen = props.viewModel.getState('hold-drawer-open');
  props.ensureLocalStateKey('searchInput', tableConfig.search || '');
  props.ensureLocalStateKey('actionId', null);
  const actionId = props.getLocalState('actionId');

  const handleSearchChange = (e) => {
    const value = e.target.value;
    props.setLocalState('searchInput', value);
    clearTimeout(props.getLocalState('searchTimeout'));
    const timeout = setTimeout(() => props.viewModel.updateHoldOrderTableConfig({ search: value, offset: 0 }), 500);
    props.setLocalState('searchTimeout', timeout);
  };
  const currentFilter = tableConfig.filter || 'active';
  const handleFilterClick = (filterKey) => props.viewModel.updateHoldOrderTableConfig({ filter: filterKey, offset: 0 });
  const paginationLimit = tableConfig.limit || 20;
  const paginationOffset = tableConfig.offset || 0;
  const initRow = total > 0 ? paginationOffset + 1 : 0;
  const endRow = total > 0 ? Math.min(paginationOffset + paginationLimit, total) : 0;
  const handleSetLimit = (newLimit) => props.viewModel.updateHoldOrderTableConfig({ limit: newLimit, offset: 0 });
  const handlePreviousPage = () => props.viewModel.updateHoldOrderTableConfig({ offset: Math.max(0, paginationOffset - paginationLimit) });
  const handleNextPage = () => props.viewModel.updateHoldOrderTableConfig({ offset: paginationOffset + paginationLimit });

  const handleLoadHoldOrder = async (holdOrderId) => {
    try {
      await props.viewModel.loadHoldOrder(holdOrderId);
      await showAlert({ message: 'Hold order loaded into Current Sale. You can review or checkout from the Current Sale tab.', variant: 'success' });
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to load hold order.', variant: 'error' });
    }
  };

  const handleViewHoldOrder = (holdOrderId) => props.viewModel.openHoldOrderDrawer(holdOrderId);

  const handleDeleteHoldOrder = async (holdOrderId) => {
    try {
      const confirmed = await showConfirmation({ title: 'Delete Hold Order', message: 'Are you sure you want to delete this hold order?' });
      if (!confirmed) return;
      await props.viewModel.archiveHoldOrder(holdOrderId);
      await showAlert({ message: 'Hold order deleted.', variant: 'success' });
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to delete hold order.', variant: 'error' });
    }
  };

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }, [
    Row({ class: 'flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0 flex-wrap' }, [
      Button({ variant: currentFilter === 'all' ? 'primary' : 'outline', class: FILTER_BTN_CLASS, onClick: () => handleFilterClick('all') }, 'All hold orders'),
      Button({ variant: currentFilter === 'active' ? 'primary' : 'outline', class: FILTER_BTN_CLASS, onClick: () => handleFilterClick('active') }, 'Hold orders'),
      Button({ variant: currentFilter === 'archived' ? 'primary' : 'outline', class: FILTER_BTN_CLASS, onClick: () => handleFilterClick('archived') }, 'Archived'),
    ]),
    Row({ class: 'flex items-center justify-between gap-4 px-4 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0' }, [
      Row({ class: 'flex-1 min-w-[200px] max-w-md' }, [Input({ type: 'text', placeholder: 'Search hold orders...', value: props.getLocalState('searchInput') || '', onInput: handleSearchChange, class: 'w-full' })]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
        SelectRelative({ name: 'hold-order-limit', onChange: (e) => handleSetLimit(parseInt(e.target.value, 10)), value: paginationLimit }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
        Row({ tagType: 'p' }, '|'),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, total > 0 ? `${initRow}-${endRow} of ${total}` : '0-0 of 0'),
          IconButton({ onClick: handlePreviousPage, disabled: paginationOffset === 0 || loading }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ onClick: handleNextPage, disabled: paginationOffset + paginationLimit >= total || loading }, [IonIcon({ name: 'caret-forward-outline' })]),
        ]),
      ]),
    ]),
    Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden px-4 py-4' }, [
      loading
        ? Row({ class: 'p-8 text-center text-gray-500' }, 'Loading hold orders...')
        : holdOrders.length === 0
          ? Row({ class: 'flex flex-col items-center justify-center gap-2 p-8 text-center text-gray-500 border border-gray-200 rounded-lg bg-gray-50' }, [
              Row({ class: 'text-sm font-medium' }, 'No hold orders found'),
              Row({ class: 'text-xs text-gray-400 max-w-sm' }, 'Hold orders are drafts saved from the Current Sale tab. Use Checkout → Hold to save one.'),
            ])
          : Row({ class: 'flex-1 flex flex-col min-h-0 min-w-full border border-gray-200 rounded-lg overflow-hidden' }, [
              Table({
                class: 'flex-1 min-h-0 min-w-full overflow-hidden',
              }, [
                TableHeader({}, [
                  TableRow({}, [
                    TableHCell({ class: 'w-10 text-center' }, '#'),
                    TableHCell({}, 'Customer'),
                    TableHCell({}, 'Date'),
                    TableHCell({}, 'Items'),
                    TableHCell({}, 'Amount'),
                    TableHCell({ class: 'w-20' }, 'Actions'),
                  ]),
                ]),
                TableBody({}, [
                  holdOrders.map((holdOrder, index) =>
                    TableRow({ key: holdOrder.id }, [
                      TableDCell({ class: 'text-center text-gray-500' }, paginationOffset + index + 1),
                      TableDCell({ class: 'font-medium' }, holdOrder.customer_name || holdOrder.supplier_name || 'Unknown'),
                      TableDCell({}, formatDateDDMMYYYY(holdOrder.sale_date || holdOrder.order_date)),
                      TableDCell({}, `${holdOrder.items_count || 0} item(s)`),
                      TableDCell({ class: 'font-medium' }, `Br ${financeFormat(holdOrder.net_amount)}`),
                      TableDCell({}, [
                        ActionDropdown({
                          actionId: holdOrder.id,
                          open: holdOrder.id === actionId,
                          onToggle: () => props.setLocalState('actionId', actionId === holdOrder.id ? null : holdOrder.id),
                          class: 'text-center',
                        }, [
                          ActionItem({
                            label: 'View',
                            icon: 'eye-outline',
                            onClick: () => {
                              props.setLocalState('actionId', null);
                              handleViewHoldOrder(holdOrder.id);
                            },
                          }),
                          ActionItem({
                            label: 'Load',
                            icon: 'arrow-forward-outline',
                            disabled: loading,
                            onClick: () => {
                              props.setLocalState('actionId', null);
                              handleLoadHoldOrder(holdOrder.id);
                            },
                          }),
                          ActionItem({
                            label: 'Delete',
                            icon: 'trash-outline',
                            disabled: loading,
                            onClick: () => {
                              props.setLocalState('actionId', null);
                              handleDeleteHoldOrder(holdOrder.id);
                            },
                            danger: true,
                          }),
                        ]),
                      ]),
                    ])
                  )
                ]),
              ]),
            ]),
    // Hold Order Details Drawer
    selectedHoldOrder && HoldOrderDetailsDrawer({ holdOrder: selectedHoldOrder, showSlide: holdDrawerOpen, onClose: () => props.viewModel.closeHoldOrderDrawer(), ...props }),
    ]),
  ])
}

function HoldOrderDetailsDrawer({ holdOrder, showSlide, onClose, ...props }) {
  let items = [];
  try {
    items = typeof holdOrder.items === 'string' ? JSON.parse(holdOrder.items) : (holdOrder.items || []);
  } catch (e) {
    console.error('Failed to parse hold order items:', e);
  }
  const subtotal = Number(holdOrder.total_amount || 0) + Number(holdOrder.withhold_amount || 0);
  const netAmount = Number(holdOrder.total_amount || 0);
  const withholdPct = holdOrder.withhold_percentage != null ? Number(holdOrder.withhold_percentage) : 0;
  const withholdAmount = Number(holdOrder.withhold_amount || 0);
  const customerName = holdOrder.customer_name || holdOrder.supplier_name || 'Unknown';
  const saleDate = holdOrder.sale_date || holdOrder.order_date;

  return Drawer({ class: 'h-full overflow-y-auto flex flex-col', openSlide: showSlide }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [IonIcon({ name: 'document-text-outline', class: 'text-xl text-indigo-600' }), Row({ class: 'text-lg font-semibold text-gray-800' }, 'Hold Order Details')]),
      IconButton({ onClick: onClose, size: 'medium' }, [IonIcon({ name: 'close-outline', class: 'text-xl' })]),
    ]),
    Row({ class: 'flex-1 overflow-y-auto px-6 py-4' }, [
      Row({ class: 'flex flex-col gap-5' }, [
        Row({ class: 'grid grid-cols-2 gap-x-6 gap-y-3' }, [
          Row({}, [Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Customer'), Row({ class: 'text-sm text-gray-900' }, customerName)]),
          Row({}, [Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Date'), Row({ class: 'text-sm text-gray-900' }, formatDateDDMMYYYY(saleDate))]),
          Row({}, [Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Payment Mode'), Row({ class: 'text-sm text-gray-900 capitalize' }, holdOrder.payment_mode || 'cash')]),
        ]),
        Row({ class: 'flex flex-col min-h-0' }, [
          Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-2 flex-shrink-0' }, 'Items'),
          items.length === 0 ? Row({ class: 'text-sm text-gray-500 py-2' }, 'No items') : Row({ class: 'max-h-48 overflow-y-auto flex flex-col gap-1 flex-shrink-0 rounded border border-gray-100' }, items.map((item, index) =>
            Row({ key: index, class: 'flex items-baseline justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0 text-sm flex-nowrap' }, [
              Row({ class: 'flex-1 min-w-0 overflow-hidden' }, [Row({ class: 'font-medium text-gray-900 truncate' }, item.product_name || 'Unknown'), item.product_code ? Row({ class: 'text-xs text-gray-500 truncate' }, item.product_code) : null].filter(Boolean)),
              Row({ class: 'text-gray-600 shrink-0 text-xs whitespace-nowrap' }, `${item.quantity || 0} × Br ${financeFormat(item.unit_price)}`),
              Row({ class: 'font-medium text-gray-900 shrink-0 text-right whitespace-nowrap min-w-[4.5rem]' }, `Br ${financeFormat(item.subtotal != null ? item.subtotal : Number(item.quantity || 0) * Number(item.unit_price || 0))}`),
            ])
          )),
        ]),
        Row({ class: 'bg-gray-50 rounded-lg px-4 py-3 border border-gray-100' }, [
          Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-2' }, 'Summary'),
          Row({ class: 'space-y-1.5 text-sm' }, [
            Row({ class: 'flex justify-between' }, [Row({ class: 'text-gray-600' }, 'Subtotal'), Row({ class: 'text-gray-900' }, `Br ${financeFormat(subtotal)}`)]),
            withholdPct > 0 ? Row({ class: 'flex justify-between' }, [Row({ class: 'text-gray-600' }, `Withhold (${withholdPct}%)`), Row({ class: 'text-orange-600' }, `-Br ${financeFormat(withholdAmount)}`)]) : null,
            Row({ class: 'flex justify-between font-semibold pt-2 border-t border-gray-200' }, [Row({}, 'Net'), Row({ class: 'text-gray-900' }, `Br ${financeFormat(netAmount)}`)]),
          ].filter(Boolean)),
        ]),
      ]),
    ]),
    CardFooter({ class: 'flex justify-end gap-2 px-6 py-3 border-t border-gray-200 flex-shrink-0' }, [Button({ variant: 'secondary', onClick: onClose }, 'Close')]),
  ]);
}
