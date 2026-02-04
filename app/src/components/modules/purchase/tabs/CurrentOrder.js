import { Button, Spinner } from '../../../utils/Button';
import { Input } from '../../../utils/Input';
import Label from '../../../utils/Label';
import { SelectFluid, SelectOptions } from '../../../utils/Select';
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table';
import { IconButton, IonIcon } from '../../../utils/Icon';
import Drawer from '../../../shared/ExampleDrawer';
import { CardHeader } from '../../../utils/Card';
import { openCheckoutConfirmationModal } from '../CheckoutConfirmationModal';
import { openReceiptModal } from '../ReceiptModal';
import { showAlert } from '../../../utils/ModalHelpers';

const { Row } = Liteframe;

export function CurrentOrder(props) {

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }, [
    Row({ class: 'overflow-y-auto flex-1 min-h-0 p-6 space-y-4' }, [
      props.viewModel.getState('current-order').error && Row({ class: 'bg-red-50 border border-red-200 rounded-lg p-2 text-red-500 text-sm' }, [
        Row({ class: 'text-sm text-red-500' }, props.viewModel.getState('current-order').error)
      ]),
      OrderItemsSection(props),
      OrderSummary(props),
    ]),
    
    OrderActionButtons(props),
    props.getLocalState('editItemId') && orderItemEditDrawer(props),
  ]);
}

function OrderItemsSection(props) {

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
    const itemIds = props.viewModel.getState('current-order').items.map(
      item => ({ id: item.product_id, selected: !props.getLocalState('selectedItemIds').isAllSelected })
    );
    props.setLocalState('selectedItemIds', {
      isAllSelected: !props.getLocalState('selectedItemIds').isAllSelected,
      itemIds,
    });
  }

  const handleItemSelect = (id) => {
    const existingState = props.getLocalState('selectedItemIds');

    if(!existingState.itemIds.map(state => state.id).includes(id)) {
      props.setLocalState('selectedItemIds', {
        ... existingState,
        itemIds: [...existingState.itemIds, {id, selected: true}]
      })

      return
    }

    props.setLocalState('selectedItemIds', {
      ...existingState,
      itemIds: existingState.itemIds.map(state => {
        if (state.id === id) {
          return { ...state, selected: !state.selected }
        } else {
          return state
        }
      })
    })
  }

  const handleDelete = () => {
    const itemIds = selectedItemIds.filter(state => state.selected).map(state => state.id);

    props.viewModel.removeItemsFromOrder(itemIds);

    props.setLocalState('selectedItemIds', {
      isAllSelected: false,
      itemIds: []
    });

    props.viewModel.filterOrderItems();
    
  }

  const handleEdit = (id) => {
    props.setLocalState('editItemId', id);

    setTimeout(() => {
      props.setLocalState('showEditDrawer', true);
    }, 0);
    
  }
  


  const filteredItems = props.viewModel.getState('filtered-items') || [];

  return Row({ class: 'flex-1 min-h-0 flex flex-col overflow-hidden py-2' }, [
    Row({ class: 'flex flex-col flex-1 min-h-0 border border-gray-200 rounded-sm overflow-hidden' }, [
      Row({ class: 'flex items-center gap-3 p-3 flex-shrink-0 border-b border-gray-200 bg-white rounded-t-lg' }, [
        Button({ variant: 'primary', onClick: handleDelete }, 'Delete'),
        Row({ class: 'flex-1' }),
        Input({ class: 'max-w-xs', value: itemQuery, placeholder: 'Search Item', onInput: (e) => {
          props.setLocalState('itemQuery', e.target.value);
          props.viewModel.filterOrderItems(e.target.value);
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
          TableHCell({ class: 'text-left text-xs font-semibold text-nowrap text-gray-500 uppercase tracking-wide' }, 'Expiry Date'),
          TableHCell({ class: 'text-left text-xs font-semibold text-nowrap text-gray-500 uppercase tracking-wide' }, 'Batch No.'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Qty'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Price'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Total'),
          TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-20' }, 'Action'),
        ]),
        TableBody(
          {},
          filteredItems.map((item) =>
            TableRow({}, [
              TableDCell({ class: 'w-10' }, [
                Row({ tagType: 'span', events: {click: () => handleItemSelect(item.product_id)}}, 
                  IonIcon({ name: (selectAll || selectedItemIds.filter(state => state.id === item.product_id)[0]?.selected) ? 'checkbox' : 'square-outline', class: 'text-indigo-600 text-2xl' }),
              ),
              ]),
              TableDCell({ class: 'pl-2' }, item.product_code),
              TableDCell({}, item.product_name),
              TableDCell({}, item.expiry_date),
              TableDCell({}, item.batch_number),
              TableDCell({}, item.quantity),
              TableDCell({}, financeFormat(item.unit_price)),
              TableDCell({}, financeFormat(parseInt(item.quantity) * parseFloat(item.unit_price))),
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

function OrderSummary(props) {
  props.ensureLocalStateKey('summaryCollapsed', false);
  const summaryCollapsed = props.getLocalState('summaryCollapsed');

  return Row({ class: 'flex-shrink-0' }, [
    Row({ class: 'border border-gray-200 rounded-sm bg-white flex flex-col overflow-hidden' }, [
      Row({ class: `flex items-center justify-between gap-6 flex-shrink-0 px-4 py-2 mb-6 border-b border-gray-200`}, [
        Row({ class: 'text-sm font-semibold text-gray-700 text-nowrap' }, 'Order Summary'),
        Row({ class: 'flex items-center gap-2' }, [
          Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-500' }, 'Order Date: '),
          Input({
            type: 'date',
            class: 'w-50',
            placeholder: 'Order Date',
            value: props.viewModel.getState('current-order').order_date,
            onChange: (e) => props.viewModel.updateCurrentOrderField('order_date', e.target.value),
          }),
        ]),
        IconButton({ onClick: () => props.setLocalState('summaryCollapsed', !props.getLocalState('summaryCollapsed')) }, 
          IonIcon({ name: `${summaryCollapsed ? 'chevron-collapse-outline' : 'chevron-expand-outline'}`, class: 'text-xl' }),
        ),
      ]),
      
      summaryCollapsed ? false : Row({ 
        class: 'overflow-y-auto flex-1 min-h-0',
        attributes: {
          style: 'min-height: 150px; max-height: 300px;'
        }
      }, [
        Row({ class: 'flex justify-between gap-6 w-full px-6' }, [
          /* Left column: Payment modality */
          PaymentSettings(props),
          // order date input
          Row({ class: 'flex-1/5' }, [
            
          ]),
          /* Right column: Summary amounts */
          OrderTotals(props),
        ]),
      ]),
    ]),
  ]);
}

function OrderActionButtons(props) {
  const loading = props.viewModel.getState('loading');

  return Row({ class: 'flex-shrink-0 flex items-center justify-end gap-3 px-4 py-2 border-t border-gray-200 mt-4' }, [
    Button({
      class: 'w-40',
      variant: 'secondary',
      disabled: loading,
      onClick: () => props.viewModel.resetCurrentOrder(),
    }, 'Reset'),
    Button({
      variant: 'outline',
      disabled: loading,
      class: 'w-40',
      onClick: async () => {
        const order = await props.viewModel.getLastOrder();
        if (order && order.id) {
          openReceiptModal({ orderId: order.id });
        } else {
          showAlert({ message: 'No purchase orders yet.', variant: 'info' });
        }
      },
    }, 'View Last Receipt'),
    Button({
      class: 'w-40',
      variant: 'primary',
      disabled: loading,
      onClick: () => openCheckoutConfirmationModal(props),
    }, 'Checkout'),
  ]);
}

function financeFormat(value) {
  return (value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function OrderTotals(props) {
  const currentOrder = props.viewModel.getState('current-order') || {};
  const isWithholding = currentOrder.is_withholding;

  const withholdPct = props.viewModel.getState('withhold-percentage');


  const totals = props.viewModel.calculateOrderTotals() || {};

  const paymentMode = currentOrder.payment_mode;


  const amountPaid = paymentMode === 'credit' ? (currentOrder.first_payment || 0)
    : paymentMode === 'cheque' ? (currentOrder.cheque_details?.amount || 0) : totals.net_amount || 0;


  return Row({ class: 'flex-2/5 flex flex-col gap-2' }, [
    Row({ class: 'flex justify-between text-sm' }, [
      Row({ class: 'text-gray-600' }, 'Gross amount'),
      Row({ class: 'font-medium' }, `Br ${financeFormat(totals.subtotal)}`),
    ]),
    Row({ class: 'flex justify-between text-sm' }, [
      Row({ class: 'text-gray-600' }, `Withhold (${isWithholding ? withholdPct + '%' : '-'})`),
      Row({ class: 'font-medium text-orange-600' }, isWithholding ? `- Br ${financeFormat(totals.withhold_amount)} ` : 'Br 0.00'),
    ]),
    Row({ class: 'flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-1' }, [
      Row({}, 'Net amount'),
      Row({ class: 'text-gray-900' }, `Br ${financeFormat(totals.net_amount)}`),
    ]),
    Row({ class: 'flex justify-between text-sm' }, [
      Row({ class: 'text-gray-600' }, 'Amount paid'),
      Row({ class: 'font-medium text-green-600' }, `Br ${financeFormat(amountPaid)}`),
    ]),
    ((totals.outstanding_balance || 0) > 0.01
      ? Row({ class: 'flex justify-between text-sm font-semibold border-t border-gray-200 pt-2 mt-1' }, [
        Row({ class: 'text-gray-700' }, 'Outstanding'),
        Row({ class: 'text-red-600' }, `Br ${financeFormat(totals.outstanding_balance)}`),
      ])
      : null),
  ]);
}

function PaymentSettings(props) {
  const currentOrder = props.viewModel.getState('current-order');

  const paymentMode = currentOrder.payment_mode;

  const handlePaymentModeChange = (e) => {
    const mode = e.target.value.trim().toLowerCase();
    props.viewModel.updateCurrentOrderField('payment_mode', mode);
    if (mode !== 'cheque') {
      props.viewModel.updateCurrentOrderField('cheque_details', null);
    } else {
      props.viewModel.updateCurrentOrderField('cheque_details', {
        bank_name: '',
        cheque_number: '',
        amount: null,
        cheque_date: new Date().toISOString().split('T')[0] || ''
      });
    }
    if (mode === 'credit') {
      props.viewModel.updateCurrentOrderField('first_payment', 0);
    }
  }

  

  return Row({ class: 'flex-2/5 flex flex-col gap-4 ' }, [
    Row({}, [
      Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Payment mode'),
      SelectFluid({
        // name: 'purchase-payment-mode',
        value: paymentMode.charAt(0).toUpperCase() + paymentMode.slice(1),
        onChange: handlePaymentModeChange,
      }, SelectOptions({
        options: ['Cash', 'Credit', 'Cheque'],
        selectedOption: paymentMode.charAt(0).toUpperCase() + paymentMode.slice(1)
      })),

    ]),
    currentOrder.payment_mode === 'credit'
      && Row({}, [
        Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'First payment'),
        Input({
          type: 'number',
          // name: 'purchase-first-payment',
          value: currentOrder.first_payment ?? '',
          onChange: (e) => props.viewModel.updateCurrentOrderField('first_payment', e.target.value ? parseFloat(e.target.value) : null),
          placeholder: '0.00',
          step: '0.01',
          min: '0',
          class: 'w-full',
        }),
      ]),
     currentOrder.payment_mode === 'cheque'
      && Row({ class: 'space-y-3' }, [
        Row({}, [
          Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Bank name'),
          Input({
            type: 'text',
            // name: 'cheque-bank',
            value: (currentOrder.cheque_details && currentOrder.cheque_details.bank_name) || '',
            onChange: (e) => {
              const d = currentOrder.cheque_details || {};
              props.viewModel.updateCurrentOrderField('cheque_details', { ...d, bank_name: e.target.value });
            },
            class: 'w-full',
          }),
        ]),
        Row({}, [
          Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Cheque number'),
          Input({
            type: 'text',
            value: (currentOrder.cheque_details && currentOrder.cheque_details.cheque_number) || '',
            onChange: (e) => {
              const d = currentOrder.cheque_details || {};
              props.viewModel.updateCurrentOrderField('cheque_details', { ...d, cheque_number: e.target.value });
            },
            class: 'w-full',
          }),
        ]),
        Row({}, [
          Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Cheque date'),
          Input({
            type: 'date',
            value: (currentOrder.cheque_details && currentOrder.cheque_details.cheque_date) || '',
            onChange: (e) => {
              const d = currentOrder.cheque_details || {};
              props.viewModel.updateCurrentOrderField('cheque_details', { ...d, cheque_date: e.target.value || null });
            },
            class: 'w-full',
          }),
        ]),
        Row({}, [
          Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Cheque amount'),
          Input({
            type: 'number',
            // name: 'cheque-amount',
            value: (currentOrder.cheque_details && currentOrder.cheque_details.amount) ?? '',
            onChange: (e) => {
              const d = currentOrder.cheque_details || {};
              props.viewModel.updateCurrentOrderField('cheque_details', {
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
  ])
} 

function orderItemEditDrawer(props) {
  props.ensureLocalStateKey('showEditDrawer', false);



  const editItemId = props.getLocalState('editItemId');

  const editItem = props.viewModel.getState('current-order').items.find(item => item.product_id === editItemId);

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
        Row({ class: 'text-lg font-semibold text-gray-800' }, 'Edit Order Item'),
      ]),
      IconButton({ onClick: onClose, size: 'medium' }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Row({ class: 'flex flex-col gap-6 max-w-2xl' }, [
        Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'text-md font-semibold text-blue-800 mb-3' }, editItem.product_name),
          // displaying product category and unit in a row
          Row({ class: 'flex items-center justify-between gap-6'}, [
            Row({ class: 'text-sm text-gray-600' }, [
              Row({ tagType: 'span', class: 'font-medium' }, 'Category: '),
              editItem.product_category
            ]),
            Row({ class: 'text-sm text-gray-600' }, [
              Row({ tagType: 'span', class: 'font-medium' }, 'Unit: '),
              editItem.product_unit
            ]),
          ]),
          // editable two rows of input for quantity and unit price, 
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
          Row({ class: 'flex items-center justify-between gap-12 mt-6' }, [
            Row({ class: 'flex-1 text-sm text-gray-600' }, [
              Row({ class: 'font-medium mb-2' }, 'Batch Number'),
              Input({
                type: 'text',
                value: editItem.batch_number,
                onChange: (e) => { editItem.batch_number = e.target.value; },
              })
            ]),
            Row({ class: 'flex-1 text-sm text-gray-600' }, [
              Row({ class: 'font-medium mb-2' }, 'Expiry Date'),
              Input({
                type: 'date',
                value: editItem.expiry_date,
                onChange: (e) => { editItem.expiry_date = e.target.value; },
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