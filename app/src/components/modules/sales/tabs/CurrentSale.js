import { Button } from '../../../utils/Button';
import { Input } from '../../../utils/Input';
import { SelectFluid, SelectOptions } from '../../../utils/Select';
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table';
import { IconButton, IonIcon } from '../../../utils/Icon';
import { CardHeader } from '../../../utils/Card';
import Drawer from '../../../shared/ExampleDrawer';
import { openCheckoutConfirmationModal } from '../CheckoutConfirmationModal';
import { openReceiptModal } from '../ReceiptModal';
import { showAlert } from '../../../utils/ModalHelpers';

const { Row } = Liteframe;

export function CurrentSale(props) {
  const currentSale = props.viewModel.getState('current-sale') || {};
  const loading = props.viewModel.getState('loading');

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }, [
    Row({ class: 'overflow-y-auto flex-1 min-h-0 p-6 space-y-4' }, [
      currentSale.error && Row({ class: 'bg-red-50 border border-red-200 rounded-lg p-2 text-red-500 text-sm' }, [Row({ class: 'text-sm text-red-500' }, currentSale.error)]),
      SaleItemsSection(props),
      SaleSummary(props),
    ]),
    SaleActionButtons(props),
    props.getLocalState('editItemId') && saleItemEditDrawer(props),
  ]);
}

function SaleItemsSection(props) {
  props.ensureLocalStateKey('editItemId', null);
  const editItemId = props.getLocalState('editItemId');

  props.ensureLocalStateKey('itemQuery', '');
  const itemQuery = props.getLocalState('itemQuery');

  props.ensureLocalStateKey('selectedItemIds', {
    isAllSelected: false,
    itemIds: []
  });

  const selectAll = props.getLocalState('selectedItemIds').isAllSelected;
  const selectedItemIds = props.getLocalState('selectedItemIds').itemIds || [];

  const handleSelectAll = () => {
    const existingState = props.getLocalState('selectedItemIds');
    const isSelecting = !existingState.isAllSelected;
    const itemIds = (props.viewModel.getState('current-sale').items || []).map(
      item => ({ id: item.product_id, selected: isSelecting })
    );

    props.setLocalState('selectedItemIds', {
      isAllSelected: isSelecting,
      itemIds,
    });
  }

  const handleItemSelect = (id) => {
    const existingState = props.getLocalState('selectedItemIds');
    const allItems = props.viewModel.getState('current-sale').items || [];

    if (existingState.isAllSelected) {
      const allItemIds = allItems.map(item => ({
        id: item.product_id,
        selected: item.product_id !== id,
      }));
      props.setLocalState('selectedItemIds', {
        isAllSelected: false,
        itemIds: allItemIds,
      });
      return;
    }

    // Normal toggle logic when selectAll is false
    if(!existingState.itemIds.map(state => state.id).includes(id)) {
      props.setLocalState('selectedItemIds', {
        ...existingState,
        itemIds: [...existingState.itemIds, {id, selected: true}]
      });
      return;
    }

    props.setLocalState('selectedItemIds', {
      ...existingState,
      itemIds: existingState.itemIds.map(state => {
        if (state.id === id) {
          return { ...state, selected: !state.selected };
        } else {
          return state;
        }
      })
    });
  }

  const handleDelete = () => {
    const itemIds = selectedItemIds.filter(state => state.selected).map(state => state.id);

    props.viewModel.removeItemsFromSale(itemIds);

    props.setLocalState('selectedItemIds', {
      isAllSelected: false,
      itemIds: []
    });

    props.viewModel.filterSaleItems();
  }

  const handleEdit = (id) => {
    props.setLocalState('editItemId', id);

    setTimeout(() => {
      props.setLocalState('showEditDrawer', true);
    }, 0);
  }

  const filteredItems = props.viewModel.getState('filtered-items') || [];
  const currentSale = props.viewModel.getState('current-sale') || {};

  const financeFormat = (v) => (v == null ? 0 : Number(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return Row({ class: 'flex-1 min-h-0 flex flex-col overflow-hidden py-2' }, [
    Row({ class: 'flex flex-col flex-1 min-h-0 border border-gray-200 rounded-sm overflow-hidden' }, [
      Row({ class: 'flex items-center gap-3 p-3 flex-shrink-0 border-b border-gray-200 bg-white rounded-t-lg' }, [
        Button({ variant: 'primary', onClick: handleDelete }, 'Delete'),
        Row({ class: 'flex-1' }),
        Input({ class: 'max-w-xs', value: itemQuery, placeholder: 'Search Item', onInput: (e) => {
          props.setLocalState('itemQuery', e.target.value);
          props.viewModel.filterSaleItems(e.target.value);
        } }),
      ]),
      Row({ 
        class: 'overflow-auto flex-1 min-h-0',
        attributes: {
          style: 'min-height: 200px; max-height: 400px;'
        }
      }, [
      Table({ class: 'min-w-full' }, [
        TableHeader({ class: 'sticky top-0 z-10 bg-gray-50' }, [
          TableHCell(
            {
              class: 'w-10 text-left text-xs font-semibold text-gray-500 cursor-pointer',
              onClick: handleSelectAll,
            },
            [IonIcon({ name: selectAll ? 'checkbox' : 'square-outline', class: 'text-indigo-600 text-2xl' })]
          ),
          TableHCell({ class: 'text-left pl-2 text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Code'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Name'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Qty'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Price'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Total'),
          TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-20' }, 'Action'),
        ]),
        TableBody(
          {},
          filteredItems.length === 0
            ? TableRow({}, [
                TableDCell({ colSpan: 7, class: 'text-center p-8 text-gray-500' }, 'No items. Add products from the left panel.')
              ])
            : filteredItems.map((item) =>
            TableRow({}, [
              TableDCell({ class: 'w-10' }, [
                Row({ tagType: 'span', events: {click: () => handleItemSelect(item.product_id)}}, 
                  IonIcon({ name: (selectAll || selectedItemIds.filter(state => state.id === item.product_id)[0]?.selected) ? 'checkbox' : 'square-outline', class: 'text-indigo-600 text-2xl' }),
                ),
              ]),
              TableDCell({ class: 'pl-2' }, item.product_code),
              TableDCell({}, item.product_name),
              TableDCell({}, item.quantity),
              TableDCell({}, financeFormat(item.unit_price)),
              TableDCell({}, financeFormat(Number(item.quantity) * Number(item.unit_price))),
              TableDCell({ class: 'text-center px-2 py-2' }, [
                IconButton({ onClick: () => handleEdit(item.product_id), class: 'text-indigo-600' }, IonIcon({ name: 'pencil-outline', class: 'text-2xl' })),
              ]),
            ])
          )
        ),
      ]),
      ]),
    ]),
  ]);
}

function SaleSummary(props) {
  const currentSale = props.viewModel.getState('current-sale') || {};
  const totals = props.viewModel.calculateSaleTotals() || {};
  const withholdPct = props.viewModel.getState('withhold-percentage');
  const financeFormat = (v) => (v == null ? 0 : Number(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return Row({ class: 'flex-shrink-0 border border-gray-200 rounded-sm bg-white flex flex-col overflow-hidden' }, [
    Row({ class: 'flex items-center justify-between gap-6 flex-shrink-0 px-4 py-2 border-b border-gray-200' }, [
      Row({ class: 'text-sm font-semibold text-gray-700' }, 'Sale Summary'),
      Row({ class: 'flex items-center gap-2' }, [
        Row({ tagType: 'label', class: 'text-sm font-medium text-gray-500' }, 'Sale Date:'),
        Input({
          type: 'date',
          class: 'w-50',
          value: currentSale.sale_date,
          onChange: (e) => props.viewModel.updateCurrentSaleField('sale_date', e.target.value),
        }),
      ]),
    ]),
    Row({ class: 'flex justify-between gap-6 w-full px-6 py-4' }, [
      PaymentSettings(props),
      Row({ class: 'flex-2/5 flex flex-col gap-2' }, [
        Row({ class: 'flex justify-between text-sm' }, [Row({ class: 'text-gray-600' }, 'Gross amount'), Row({ class: 'font-medium' }, `Br ${financeFormat(totals.subtotal)}`)]),
        Row({ class: 'flex justify-between text-sm' }, [Row({ class: 'text-gray-600' }, `Withhold (${currentSale.is_withholding ? withholdPct + '%' : '-'})`), Row({ class: 'font-medium text-orange-600' }, currentSale.is_withholding ? `- Br ${financeFormat(totals.withhold_amount)}` : 'Br 0.00')]),
        Row({ class: 'flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-1' }, [Row({}, 'Net amount'), Row({ class: 'text-gray-900' }, `Br ${financeFormat(totals.net_amount)}`)]),
        Row({ class: 'flex justify-between text-sm' }, [Row({ class: 'text-gray-600' }, 'Amount paid'), Row({ class: 'font-medium text-green-600' }, `Br ${financeFormat(totals.amount_paid ?? 0)}`)]),
        (totals.outstanding_balance ?? 0) > 0.01 && Row({ class: 'flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-1' }, [Row({ class: 'text-gray-700' }, 'Outstanding'), Row({ class: 'text-red-600' }, `Br ${financeFormat(totals.outstanding_balance)}`)]),
      ].filter(Boolean)),
    ]),
  ]);
}

function PaymentSettings(props) {
  const currentSale = props.viewModel.getState('current-sale') || {};
  const paymentMode = (currentSale.payment_mode || 'cash').toString();
  const paymentModeDisplay = paymentMode.charAt(0).toUpperCase() + paymentMode.slice(1);

  const handlePaymentModeChange = (e) => {
    const val = e.target.value.trim().toLowerCase();
    props.viewModel.updateCurrentSaleField('payment_mode', val);  
    props.viewModel.updateCurrentSaleField('payment_type', val);
    if (val !== 'cheque') {
      props.viewModel.updateCurrentSaleField('cheque_details', null);
    } else {
      props.viewModel.updateCurrentSaleField('cheque_details', {
        bank_name: '',
        cheque_no: '',
        amount: null,
        cheque_date: new Date().toISOString().split('T')[0] || ''
      });
    }
    if (val === 'credit') {
      props.viewModel.updateCurrentSaleField('first_payment', 0);
    } else if (val !== 'credit') {
      props.viewModel.updateCurrentSaleField('first_payment', null);
    }
  };
  return Row({ class: 'flex-2/5 flex flex-col gap-4' }, [
    Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Payment mode'),
    SelectFluid({ name: 'sales-payment-mode', value: paymentModeDisplay, onChange: handlePaymentModeChange, class: 'w-full' }, [
      SelectOptions({ options: ['Cash', 'Credit', 'Cheque'], selectedOption: paymentModeDisplay }),
    ]),
    paymentMode === 'credit' && Row({}, [
      Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'First payment'),
      Input({
        type: 'number',
        value: currentSale.first_payment ?? '',
        onChange: (e) => props.viewModel.updateCurrentSaleField('first_payment', e.target.value ? parseFloat(e.target.value) : null),
        placeholder: '0.00',
        step: '0.01',
        min: '0',
        class: 'w-full',
      }),
    ]),
    paymentMode === 'cheque' && Row({ class: 'space-y-3' }, [
      Row({}, [
        Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Bank name'),
        Input({
          type: 'text',
          value: (currentSale.cheque_details && currentSale.cheque_details.bank_name) || '',
          onChange: (e) => {
            const d = currentSale.cheque_details || {};
            props.viewModel.updateCurrentSaleField('cheque_details', { ...d, bank_name: e.target.value });
          },
          class: 'w-full',
        }),
      ]),
      Row({}, [
        Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Cheque number'),
        Input({
          type: 'text',
          value: (currentSale.cheque_details && currentSale.cheque_details.cheque_no) || '',
          onChange: (e) => {
            const d = currentSale.cheque_details || {};
            props.viewModel.updateCurrentSaleField('cheque_details', { ...d, cheque_no: e.target.value });
          },
          class: 'w-full',
        }),
      ]),
      Row({}, [
        Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Cheque date'),
        Input({
          type: 'date',
          value: (currentSale.cheque_details && currentSale.cheque_details.cheque_date) || '',
          onChange: (e) => {
            const d = currentSale.cheque_details || {};
            props.viewModel.updateCurrentSaleField('cheque_details', { ...d, cheque_date: e.target.value || null });
          },
          class: 'w-full',
        }),
      ]),
      Row({}, [
        Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Cheque amount'),
        Input({
          type: 'number',
          value: (currentSale.cheque_details && currentSale.cheque_details.amount) ?? '',
          onChange: (e) => {
            const d = currentSale.cheque_details || {};
            props.viewModel.updateCurrentSaleField('cheque_details', {
              ...d,
              amount: e.target.value ? parseFloat(e.target.value) : null,
            });
          },
          step: '0.01',
          min: '0',
          placeholder: '0.00',
          class: 'w-full',
        }),
      ]),
    ]),
  ].filter(Boolean));
}

function SaleActionButtons(props) {
  const loading = props.viewModel.getState('loading');
  return Row({ class: 'flex-shrink-0 flex items-center justify-end gap-3 px-4 py-2 border-t border-gray-200 mt-4' }, [
    Button({ class: 'w-40', variant: 'secondary', disabled: loading, onClick: () => props.viewModel.resetCurrentSale() }, 'Reset'),
    Button({
      variant: 'outline',
      disabled: loading,
      class: 'w-40',
      onClick: async () => {

        const order = await props.viewModel.getLastOrder(); 
        if (order && order.id) {
          openReceiptModal({ orderId: order.id })
        } else {
          showAlert({ message: 'No sales orders yet.', variant: 'info' });
        }
      },
    }, 'View Last Receipt'),
    Button({ class: 'w-40', variant: 'primary', disabled: loading, onClick: () => openCheckoutConfirmationModal(props) }, 'Checkout'),
  ]);
}

function saleItemEditDrawer(props) {
  props.ensureLocalStateKey('showEditDrawer', false);

  const editItemId = props.getLocalState('editItemId');

  const editItem = props.viewModel.getState('current-sale').items.find(item => item.product_id === editItemId);

  if (!editItem) return null;

  const onClose = () => {
    props.setLocalState('showEditDrawer', false);

    setTimeout(() => {
      props.setLocalState('editItemId', null);
    }, 300);
  }

  const handleSave = (editedItem) => {
    props.viewModel.saveOrderItem(editedItem);
    onClose();
  }

  const showEditDrawer = props.getLocalState('showEditDrawer');
  return Drawer({ class: 'h-full overflow-hidden flex flex-col', openSlide: showEditDrawer }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        Row({ class: 'text-lg font-semibold text-gray-800' }, 'Edit Sale Item'),
      ]),
      IconButton({ onClick: onClose, size: 'medium' }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Row({ class: 'flex flex-col gap-6 max-w-2xl' }, [
        Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'text-md font-semibold text-blue-800 mb-3' }, editItem.product_name),
          Row({ class: 'flex items-center justify-between gap-12 mt-6'}, [
            Row({ class: 'flex-1 text-sm text-gray-600' }, [
              Row({ class: 'font-medium mb-2' }, 'Quantity (QTY)'),
              Input({
                type: 'number',
                value: editItem.quantity,
                onChange: (e) => { editItem.quantity = e.target.value; },
              })
            ]),
            Row({ class: 'flex-1 text-sm text-gray-600' }, [
              Row({ class: 'font-medium mb-2' }, 'Unit Price (PRICE)'),
              Input({
                type: 'number',
                value: editItem.unit_price,
                onChange: (e) => { editItem.unit_price = e.target.value; },
              })
            ]),
          ]),
        ]),
      ]),
    ]),
    Row({ class: 'flex-shrink-0 px-4 py-2 border-t border-gray-200' }, [
      Button({
        variant: 'primary',
        class: 'w-40',
        onClick: () => handleSave(editItem),
      }, 'Save Changes'),
    ]),
  ]);
}
