import Drawer from '../../shared/ExampleDrawer';
import { Button } from '../../utils/Button';
import { IconButton, IonIcon } from '../../utils/Icon';
import { formatDateDDMMYYYY } from '../../utils/DateUtils';
import { showAlert, showConfirmation } from '../../utils/ModalHelpers';
import { openReceiptModal } from './ReceiptModal';
import { PaymentModalContent } from './PaymentModal';
import { Card, CardHeader, CardBody, CardFooter } from '../../utils/Card';

const { Row } = Liteframe;

const CONTENT_TITLES = {
  details: 'Order Details',
  payment: 'Record Payment',
};

export function OrderDetailsDrawer(props) {
  const drawerOpen = props.showSlide !== undefined ? props.showSlide : props.viewModel.getState('order-drawer-open');
  const onClose = props.onClose || (() => props.viewModel.closeOrderDrawer());
  const contentType = props.contentType || 'details';
  const selectedOrder = props.viewModel.getState('selected-order');

  if (!selectedOrder) {
    return null;
  }

  const orderRef = selectedOrder.receipt_number || '—';
  const headerTitle = `${CONTENT_TITLES[contentType] || CONTENT_TITLES.details}: ${orderRef}`;

  /** Switch drawer body to payment form (called from details view footer). */
  const handleSwitchToPayment = async () => {
    try {
      await props.viewModel.preparePaymentForOrder(selectedOrder.id);
      if (props.onSwitchToPayment) props.onSwitchToPayment();
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to load payment', variant: 'error' });
    }
  };

  const handleReverseOrder = async () => {
    try {
      const confirmed = await showConfirmation({
        title: 'Reverse Purchase Order',
        message: 'Reverse this purchase order? Inventory and ledger entries will be reversed. This cannot be undone.',
        variant: 'danger',
      });
      if (!confirmed) return;
      await props.viewModel.reverseOrder(selectedOrder.id, `Order reversal from purchase drawer (${orderRef})`);
      await showAlert({ message: 'Order reversed.', variant: 'success' });
      onClose();
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to reverse order', variant: 'error' });
    }
  };

  const handleViewReceipt = () => {
    onClose();
    openReceiptModal({ orderId: selectedOrder.id });
  };

  const isPaymentView = contentType === 'payment';
  const loading = props.viewModel.getState('loading');

  return Drawer({ class: 'flex flex-col h-full', openSlide: drawerOpen }, [
    Card({ class: 'flex flex-col h-full' }, [
      CardHeader({
        class: 'flex items-center justify-between px-5 h-12 border-b border-gray-200 flex-shrink-0',
      }, [
        Row({ class: 'text-base font-semibold text-gray-900' }, headerTitle),
        IconButton({ onClick: onClose }, IonIcon({ name: 'close-outline', class: 'text-xl' })),
      ]),
      CardBody({ class: 'flex-1 overflow-y-auto min-h-0 px-5 py-4' }, [
        isPaymentView
          ? PaymentModalContent({
              ...props,
              handleClose: onClose,
              onViewReceipt: handleViewReceipt,
              embedded: true,
            })
          : renderDetailsContent(selectedOrder),
      ]),
      !isPaymentView
        ? CardFooter({ class: 'flex justify-end gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0' }, [
            Button({ variant: 'secondary', onClick: onClose, disabled: loading }, 'Close'),
            Number(selectedOrder.outstanding_balance ?? 0) > 0.01 ? Button({ variant: 'primary', onClick: handleSwitchToPayment, disabled: loading }, 'Record Payment') : null,
            Button({ variant: 'secondary', onClick: handleViewReceipt, disabled: loading }, 'View Receipt'),
            selectedOrder.status === 'completed' && Number(selectedOrder.outstanding_balance ?? 0) <= 0.01
              ? Button({ variant: 'danger', onClick: handleReverseOrder, disabled: loading }, 'Reverse Order')
              : null,
          ].filter(Boolean))
        : null,
    ]),
  ]);
}

const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderDetailsContent(selectedOrder) {
  const items = selectedOrder.items || [];

  return Row({ class: 'flex flex-col gap-5' }, [
    Row({ class: 'grid grid-cols-2 gap-x-6 gap-y-3' }, [
      Row({}, [
        Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Supplier'),
        Row({ class: 'text-sm text-gray-900' }, selectedOrder.supplier_name || 'Unknown'),
      ]),
      Row({}, [
        Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Order Date'),
        Row({ class: 'text-sm text-gray-900' }, formatDateDDMMYYYY(selectedOrder.order_date)),
      ]),
      Row({}, [
        Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Payment Mode'),
        Row({ class: 'text-sm text-gray-900 capitalize' }, selectedOrder.payment_mode || 'cash'),
      ]),
      Row({}, [
        Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-0.5' }, 'Status'),
        Row({ class: 'text-sm text-gray-900' }, selectedOrder.status || 'completed'),
      ]),
    ]),
    Row({ class: 'flex flex-col min-h-0' }, [
      Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-2 flex-shrink-0' }, 'Items'),
      items.length === 0
        ? Row({ class: 'text-sm text-gray-500 py-2' }, 'No items')
        : Row({ class: 'max-h-48 overflow-y-auto flex flex-col gap-1 flex-shrink-0 rounded border border-gray-100' }, items.map((item, index) =>
            Row({
              key: index,
              class: 'flex items-baseline justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0 text-sm flex-nowrap',
            }, [
              Row({ class: 'flex-1 min-w-0 overflow-hidden' }, [
                Row({ class: 'font-medium text-gray-900 truncate' }, item.product_name || 'Unknown'),
                item.product_code ? Row({ class: 'text-xs text-gray-500 truncate' }, item.product_code) : null,
              ].filter(Boolean)),
              Row({ class: 'text-gray-600 shrink-0 text-xs whitespace-nowrap' }, `${item.quantity || 0} × Br ${financeFormat(item.unit_price)}`),
              Row({ class: 'font-medium text-gray-900 shrink-0 text-right whitespace-nowrap min-w-[4.5rem]' }, `Br ${financeFormat(item.subtotal)}`),
            ])
          )),
    ]),
    Row({ class: 'bg-gray-50 rounded-lg px-4 py-3 border border-gray-100' }, [
      Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-2' }, 'Summary'),
      Row({ class: 'space-y-1.5 text-sm' }, [
        Row({ class: 'flex justify-between' }, [Row({ class: 'text-gray-600' }, 'Subtotal'), Row({ class: 'text-gray-900' }, `Br ${financeFormat(selectedOrder.subtotal)}`)]),
        selectedOrder.withhold_percentage > 0
          ? Row({ class: 'flex justify-between' }, [Row({ class: 'text-gray-600' }, `Withhold (${selectedOrder.withhold_percentage}%)`), Row({ class: 'text-orange-600' }, `-Br ${financeFormat(selectedOrder.withhold_amount)}`)])
          : null,
        Row({ class: 'flex justify-between font-semibold pt-2 border-t border-gray-200' }, [Row({}, 'Net'), Row({ class: 'text-gray-900' }, `Br ${financeFormat(selectedOrder.net_amount)}`)]),
        Row({ class: 'flex justify-between' }, [Row({ class: 'text-gray-600' }, 'Paid'), Row({ class: 'text-gray-900' }, `Br ${financeFormat(selectedOrder.total_paid)}`)]),
        selectedOrder.outstanding_balance > 0.01
          ? Row({ class: 'flex justify-between font-semibold pt-1.5 border-t border-gray-200 text-red-600' }, [Row({}, 'Outstanding'), Row({}, `Br ${financeFormat(selectedOrder.outstanding_balance)}`)])
          : null,
      ].filter(Boolean)),
    ]),
    selectedOrder.payments && selectedOrder.payments.length > 0
      ? Row({}, [
          Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-500 mb-2' }, 'Payment History'),
          Row({ class: 'flex flex-col gap-1.5' }, [
            ...selectedOrder.payments.map((payment, index) =>
              Row({
                class: 'flex items-center justify-between py-2 px-3 bg-white border border-gray-200 rounded text-sm',
              }, [
                Row({}, [
                  Row({ class: 'font-medium text-gray-900' }, `#${index + 1}`),
                  Row({ class: 'text-xs text-gray-500' }, formatDateDDMMYYYY(payment.payment_date)),
                ]),
                Row({ class: 'font-medium text-gray-900' }, `Br ${financeFormat(payment.payment_amount)}`),
                Row({ class: 'text-xs text-gray-500 capitalize' }, payment.payment_mode || 'cash'),
              ])
            ),
          ]),
        ])
      : null,
  ].filter(Boolean));
}
