import Drawer from '../../shared/ExampleDrawer';
import { Button } from '../../utils/Button';
import { Input } from '../../utils/Input';
import { IconButton, IonIcon } from '../../utils/Icon';
import { Card, CardHeader, CardBody, CardFooter } from '../../utils/Card';
import { SelectFluid, SelectOptions } from '../../utils/Select';
import { formatDateDDMMYYYY } from '../../utils/DateUtils';
import { showAlert, showConfirmation } from '../../utils/ModalHelpers';

const { Row } = Liteframe;

const PAYMENT_MODE_OPTIONS = ['Cash', 'Cheque'];

const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SalesOrderDetailsDrawer(props) {
  const drawerOpen = props.showSlide !== undefined ? props.showSlide : props.viewModel.getState('order-drawer-open');
  const onClose = props.onClose || (() => props.viewModel.closeOrderDrawer());
  const contentType = props.drawerContentType || 'details';
  const selectedPayload = props.viewModel.getState('selected-order');
  const loading = props.viewModel.getState('loading');

  if (!selectedPayload || !selectedPayload.order) return null;

  const order = selectedPayload.order;
  const items = selectedPayload.items || [];
  const orderRef = order.receipt_no || `SO${order.id}`;
  const outstanding = Number(order.outstanding_balance ?? (order.received_amount != null ? (Number(order.received_amount) - Number(order.amount_paid ?? 0)) : 0));

  const headerTitles = {
    details: 'Order Details',
    payment: 'Record Payment',
    'confirm-withhold': 'Confirm Withhold',
    'rollback-withhold': 'Rollback Withhold',
    reverse: 'Reverse Order'
  };
  const headerTitle = `${headerTitles[contentType] || headerTitles.details}: ${orderRef}`;

  const handlePay = () => {
    props.viewModel.setSalesPaymentFormDefaults(outstanding);
    props.setDrawerContentType('payment');
  };
  const handleConfirmWithhold = () => props.setDrawerContentType('confirm-withhold');
  const handleRollbackWithhold = () => props.setDrawerContentType('rollback-withhold');
  const handleReverse = () => props.setDrawerContentType('reverse');
  const handleBackToDetails = () => props.setDrawerContentType('details');

  return Drawer({ class: 'flex flex-col h-full', openSlide: drawerOpen }, [
    Card({ class: 'flex flex-col h-full' }, [
      CardHeader({
        class: 'flex items-center justify-between px-5 h-12 border-b border-gray-200 flex-shrink-0',
      }, [
        Row({ class: 'text-base font-semibold text-gray-900' }, headerTitle),
        IconButton({ onClick: onClose }, IonIcon({ name: 'close-outline', class: 'text-xl' })),
      ]),
      CardBody({ class: 'flex-1 overflow-y-auto min-h-0 px-5 py-4' }, [
        contentType === 'details' && renderDetails(props, order, items),
        contentType === 'payment' && renderPaymentForm(props, order, outstanding, onClose),
        contentType === 'confirm-withhold' && renderConfirmWithholdForm(props, order, onClose),
        contentType === 'rollback-withhold' && renderRollbackConfirm(props, order, onClose),
        contentType === 'reverse' && renderReverseConfirm(props, order, onClose),
      ].filter(Boolean)),
      contentType === 'details'
        ? CardFooter({ class: 'flex flex-wrap justify-end gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0' }, [
            Button({ variant: 'secondary', onClick: onClose, disabled: loading }, 'Close'),
            outstanding > 0.01 ? Button({ variant: 'primary', onClick: handlePay, disabled: loading }, 'Record Payment') : null,
            order.withhold_amount > 0.009 && !order.withhold_confirmation ? Button({ variant: 'outline', onClick: handleConfirmWithhold, disabled: loading }, 'Confirm Withhold') : null,
            order.withhold_confirmation ? Button({ variant: 'outline', onClick: handleRollbackWithhold, disabled: loading }, 'Rollback Withhold') : null,
            !order.is_reversed ? Button({ variant: 'danger', onClick: handleReverse, disabled: loading }, 'Reverse Order') : null,
          ].filter(Boolean))
        : CardFooter({ class: 'flex justify-end gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0' }, [
            Button({ variant: 'secondary', onClick: handleBackToDetails, disabled: loading }, 'Back'),
          ]),
    ]),
  ]);
}

function renderDetails(props, order, items) {
  const netAmount = Number(order.total_amount ?? 0) - Number(order.withhold_amount ?? 0);
  const hasWithhold = order.withhold_amount > 0.009;
  const withholdConfirmed = !!order.withhold_confirmation;

  return Row({ class: 'flex flex-col gap-5' }, [
    Row({ class: 'grid grid-cols-2 gap-x-6 gap-y-3' }, [
      Row({}, [
        Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Customer'),
        Row({ class: 'text-sm text-gray-900' }, order.customer_name || 'Walk-in'),
      ]),
      Row({}, [
        Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Date'),
        Row({ class: 'text-sm text-gray-900' }, formatDateDDMMYYYY(order.order_date)),
      ]),
      Row({}, [
        Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Payment'),
        Row({ class: 'text-sm text-gray-900 capitalize' }, order.payment_type || 'cash'),
      ]),
      Row({}, [
        Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Outstanding'),
        Row({ class: 'text-sm font-medium' }, `Br ${financeFormat(order.outstanding_balance ?? (netAmount - Number(order.amount_paid ?? 0)))}`),
      ]),
    ]),
    hasWithhold
      ? Row({ class: 'rounded-lg border border-gray-200 bg-gray-50 p-4' }, [
          Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-2' }, 'Withholding tax'),
          Row({ class: 'flex flex-col gap-2' }, [
            Row({ class: 'flex items-center justify-between gap-4 flex-wrap' }, [
              Row({ class: 'text-sm text-gray-700' }, [
                Row({}, `Amount: Br ${financeFormat(order.withhold_amount)}`),
                Row({ class: 'mt-1 font-medium text-gray-900' }, withholdConfirmed ? `Confirmed${order.withhold_ref ? ` · Withhold Ref: ${order.withhold_ref}` : ''}` : 'Not confirmed'),
              ]),
              Row({ class: 'flex flex-wrap gap-2' }, [
                withholdConfirmed
                  ? Row({ class: 'flex flex-col gap-1' }, [
                      Row({ class: 'text-xs text-gray-500 max-w-[220px]' }, 'Customer declined to confirm or provide withhold ref? Clear the confirmation so this order is no longer marked as withhold-confirmed.'),
                      Button({
                        variant: 'outline',
                        onClick: () => props.setDrawerContentType('rollback-withhold'),
                        disabled: props.viewModel.getState('loading'),
                        class: 'text-amber-700 border-amber-300 hover:bg-amber-50',
                      }, 'Clear withhold confirmation'),
                    ])
                  : Button({
                      variant: 'outline',
                      onClick: () => props.setDrawerContentType('confirm-withhold'),
                      disabled: props.viewModel.getState('loading'),
                    }, 'Confirm withhold'),
              ]),
            ]),
          ]),
        ])
      : null,
    Row({ class: 'flex flex-col min-h-0' }, [
      Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-2' }, 'Items'),
      items.length === 0
        ? Row({ class: 'text-sm text-gray-500' }, 'No items')
        : Row({ class: 'overflow-x-auto' }, [
            Row({ tagType: 'table', class: 'min-w-full text-sm' }, [
              Row({ tagType: 'thead' }, [
                Row({ tagType: 'tr', class: 'border-b border-gray-200' }, [
                  Row({ tagType: 'th', class: 'text-left py-2 pr-4' }, 'Product'),
                  Row({ tagType: 'th', class: 'text-right py-2 pr-4' }, 'Qty'),
                  Row({ tagType: 'th', class: 'text-right py-2 pr-4' }, 'Unit'),
                  Row({ tagType: 'th', class: 'text-right py-2' }, 'Total'),
                ]),
              ]),
              Row({ tagType: 'tbody' }, items.map((row) =>
                Row({ tagType: 'tr', key: row.id, class: 'border-b border-gray-100' }, [
                  Row({ tagType: 'td', class: 'py-2 pr-4' }, row.product_name || row.product_code || '—'),
                  Row({ tagType: 'td', class: 'text-right py-2 pr-4' }, row.quantity),
                  Row({ tagType: 'td', class: 'text-right py-2 pr-4' }, `Br ${financeFormat(row.unit_price)}`),
                  Row({ tagType: 'td', class: 'text-right py-2' }, `Br ${financeFormat(row.total_price)}`),
                ])
              )),
            ]),
          ]),
    ]),
  ]);
}

function FormField(label, children) {
  return Row({ class: 'block' }, [
    Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, label),
    children,
  ]);
}

function renderPaymentForm(props, order, outstanding, onClose) {
  const today = new Date().toISOString().split('T')[0];
  const form = props.viewModel.getState('sales-payment-form') || {};
  const amount = form.payment_amount ?? '';
  const paymentMode = form.payment_mode || 'cash';
  const paymentDate = form.payment_date || today;
  const cheque = form.cheque_details || {};
  const notes = form.notes ?? '';
  const vm = props.viewModel;

  const handleSubmit = async () => {
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      await showAlert({ message: 'Enter a valid payment amount.', variant: 'error' });
      return;
    }
    if (num > outstanding + 0.01) {
      await showAlert({ message: `Amount cannot exceed Br ${outstanding.toFixed(2)}.`, variant: 'error' });
      return;
    }
    const paymentData = {
      payment_amount: num,
      payment_mode: paymentMode,
      payment_date: paymentDate,
      notes: notes.trim() || null,
    };
    if (paymentMode === 'cheque') {
      paymentData.cheque_details = {
        bank_name: cheque.bank_name || '',
        cheque_number: cheque.cheque_number || '',
        cheque_date: cheque.cheque_date || '',
      };
    }
    try {
      await props.viewModel.payOrder(order.id, paymentData);
      await showAlert({ message: 'Payment recorded.', variant: 'success' });
      props.setDrawerContentType('details');
      await props.viewModel.loadOrderDetails(order.id);
    } catch (e) {
      await showAlert({ message: e.message || 'Failed to record payment', variant: 'error' });
    }
  };

  const paymentModeDisplay = paymentMode === 'cheque' ? 'Cheque' : 'Cash';

  return Row({ class: 'flex flex-col gap-4' }, [
    Row({ class: 'bg-blue-50 border border-blue-200 rounded-lg p-4' }, [
      Row({ class: 'text-xs font-medium uppercase tracking-wide text-blue-700 mb-1' }, 'Outstanding balance'),
      Row({ class: 'text-xl font-semibold text-blue-900' }, `Br ${financeFormat(outstanding)}`),
    ]),
    FormField('Payment amount *', [
      Input({
        type: 'number',
        step: '0.01',
        min: '0',
        max: String(outstanding),
        value: amount,
        onChange: (e) => vm.updateSalesPaymentForm({ payment_amount: e.target.value }),
        class: 'w-full',
      }),
    ]),
    FormField('Payment method *', [
      SelectFluid({
        value: paymentModeDisplay,
        onChange: (e) => vm.updateSalesPaymentForm({ payment_mode: e.target.value.toLowerCase() }),
      }, [SelectOptions({ options: PAYMENT_MODE_OPTIONS, selectedOption: paymentModeDisplay })]),
    ]),
    FormField('Payment date *', [
      Input({
        type: 'date',
        value: paymentDate,
        onChange: (e) => vm.updateSalesPaymentForm({ payment_date: e.target.value }),
        class: 'w-full',
      }),
    ]),
    paymentMode === 'cheque'
      ? Row({ class: 'space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4' }, [
          Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-600 mb-3' }, 'Cheque details'),
          Row({ class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' }, [
            FormField('Bank name', [
              Input({
                type: 'text',
                value: cheque.bank_name || '',
                onChange: (e) => vm.updateSalesPaymentForm({ cheque_details: { ...cheque, bank_name: e.target.value } }),
                placeholder: 'Bank name',
                class: 'w-full',
              }),
            ]),
            FormField('Cheque number', [
              Input({
                type: 'text',
                value: cheque.cheque_number || '',
                onChange: (e) => vm.updateSalesPaymentForm({ cheque_details: { ...cheque, cheque_number: e.target.value } }),
                placeholder: 'Cheque number',
                class: 'w-full',
              }),
            ]),
            Row({ class: 'sm:col-span-2' }, [
              FormField('Cheque date', [
                Input({
                  type: 'date',
                  value: cheque.cheque_date || '',
                  onChange: (e) => vm.updateSalesPaymentForm({ cheque_details: { ...cheque, cheque_date: e.target.value } }),
                  class: 'w-full',
                }),
              ]),
            ]),
          ]),
        ])
      : null,
    FormField('Notes (optional)', [
      Input({
        type: 'text',
        value: notes,
        onChange: (e) => vm.updateSalesPaymentForm({ notes: e.target.value }),
        placeholder: 'Additional notes',
        class: 'w-full',
      }),
    ]),
    Row({ class: 'flex justify-end' }, [
      Button({
        variant: 'primary',
        onClick: handleSubmit,
        disabled: props.viewModel.getState('loading') || !amount || parseFloat(amount) <= 0,
      }, props.viewModel.getState('loading') ? 'Recording...' : 'Record Payment'),
    ]),
  ]);
}

function renderConfirmWithholdForm(props, order, onClose) {
  props.ensureLocalStateKey('withhold-ref-confirm', order.withhold_ref || '');
  const value = props.getLocalState('withhold-ref-confirm') || '';

  const handleSubmit = async () => {
    try {
      await props.viewModel.confirmWithhold(order.id, value.trim() || null);
      await showAlert({ message: 'Withhold confirmed.', variant: 'success' });
      props.setDrawerContentType('details');
      await props.viewModel.loadOrderDetails(order.id);
    } catch (e) {
      await showAlert({ message: e.message || 'Failed to confirm withhold', variant: 'error' });
    }
  };

  return Row({ class: 'flex flex-col gap-4' }, [
    Row({}, [
      Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, 'Withhold Ref.'),
      Input({
        type: 'text',
        value,
        onChange: (e) => props.setLocalState('withhold-ref-confirm', e.target.value),
        placeholder: 'Customer withholding receipt reference',
        class: 'w-full',
      }),
    ]),
    Row({ class: 'flex justify-end' }, [
      Button({ variant: 'primary', onClick: handleSubmit, disabled: props.viewModel.getState('loading') }, 'Confirm Withhold'),
    ]),
  ]);
}

function renderRollbackConfirm(props, order, onClose) {
  const handleSubmit = async () => {
    const ok = await showConfirmation({ title: 'Rollback Withhold', message: 'Clear withhold confirmation for this order?', variant: 'warning' });
    if (!ok) return;
    try {
      await props.viewModel.rollbackWithhold(order.id);
      await showAlert({ message: 'Withhold rolled back.', variant: 'success' });
      props.setDrawerContentType('details');
      onClose();
    } catch (e) {
      await showAlert({ message: e.message || 'Failed to rollback', variant: 'error' });
    }
  };

  return Row({ class: 'flex flex-col gap-4' }, [
    Row({ class: 'text-sm text-gray-600' }, 'This will clear the withhold confirmation and withhold ref for this order.'),
    Row({ class: 'flex justify-end' }, [
      Button({ variant: 'danger', onClick: handleSubmit, disabled: props.viewModel.getState('loading') }, 'Rollback Withhold'),
    ]),
  ]);
}

function renderReverseConfirm(props, order, onClose) {
  const handleSubmit = async () => {
    const ok = await showConfirmation({ title: 'Reverse Sale', message: 'Reverse this sale? Inventory will be restored. This cannot be undone.', variant: 'danger' });
    if (!ok) return;
    try {
      await props.viewModel.reverseOrder(order.id);
      await showAlert({ message: 'Order reversed.', variant: 'success' });
      onClose();
    } catch (e) {
      await showAlert({ message: e.message || 'Failed to reverse', variant: 'error' });
    }
  };

  return Row({ class: 'flex flex-col gap-4' }, [
    Row({ class: 'text-sm text-gray-600' }, 'This will restore inventory and mark the order as reversed.'),
    Row({ class: 'flex justify-end' }, [
      Button({ variant: 'danger', onClick: handleSubmit, disabled: props.viewModel.getState('loading') }, 'Reverse Order'),
    ]),
  ]);
}
