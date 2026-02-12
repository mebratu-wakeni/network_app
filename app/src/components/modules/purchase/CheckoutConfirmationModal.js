import Modal from '../../shared/Modal';
import { CardHeader, CardBody, CardFooter } from '../../utils/Card';
import { Button, Spinner } from '../../utils/Button';
import { IconButton, IonIcon } from '../../utils/Icon';
import { showAlert } from '../../utils/ModalHelpers';
import { openReceiptModal } from './ReceiptModal';

const { Row } = Liteframe;

const financeFormat = (value) =>
  (value != null ? value : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Opens the purchase order confirmation modal. Validates the current order first;
 * if invalid, shows an error and does not open. Otherwise shows a summary and
 * prompts Complete / Edit / Hold.
 */
export function openCheckoutConfirmationModal(props) {
  const viewModel = props.viewModel;
  if (viewModel.getState('loading')) return;

  viewModel.updateState('loading', true);
  const valid = viewModel.validateOrder();
  viewModel.updateState('loading', false);

  if (!valid) {
    const error = viewModel.getState('current-order').error;
    if (error) {
      showAlert({ message: error, variant: 'error' });
    }
    return;
  }

  Modal({}, (delegator, handleClose) => {
    return CheckoutConfirmationContent(props, delegator, handleClose);
  });
}

function CheckoutConfirmationContent(props, delegator, handleClose) {
  const viewModel = props.viewModel;
  const currentOrder = viewModel.getState('current-order') || {};
  const totals = viewModel.calculateOrderTotals() || {};
  const loading = viewModel.getState('loading');

  const supplierList = viewModel.getState('supplier-list') || [];
  const supplier = supplierList.find((s) => s.id === currentOrder.supplier_id);
  const supplierName = supplier ? (supplier.name || 'Unknown') : 'Unknown';

  const paymentMode = currentOrder.payment_mode || 'cash';
  const paymentLabel = paymentMode.charAt(0).toUpperCase() + paymentMode.slice(1);
  const netAmount = totals.net_amount || 0;
  const amountPaid =
    paymentMode === 'credit'
      ? currentOrder.first_payment || 0
      : paymentMode === 'cheque'
        ? (currentOrder.cheque_details && currentOrder.cheque_details.amount) || 0
        : netAmount;
  // Outstanding: only for credit (or cheque when underpaid); cash is fully paid so 0
  const chequeAmount = (currentOrder.cheque_details && currentOrder.cheque_details.amount) || 0;
  const outstanding =
    paymentMode === 'cash' ? 0 : Math.max(0, netAmount - (paymentMode === 'cheque' ? chequeAmount : currentOrder.first_payment || 0));

  const items = currentOrder.items || [];
  const itemCount = items.length;
  const isWithholding = currentOrder.is_withholding;
  const withholdPct = viewModel.getState('withhold-percentage');

  const handleComplete = async () => {
    if (loading) return;
    try {
      // Cash balance validation: ensure sufficient funds before processing cash purchase
      if (paymentMode === 'cash' && netAmount > 0) {
        const ledgerRes = await window.ipcRenderer?.invoke?.('dashboard:get-ledger-balances');
        const cashBalance = ledgerRes?.balances?.['1100'] != null ? Number(ledgerRes.balances['1100']) : 0;
        if (cashBalance < netAmount) {
          showAlert({
            message: `Insufficient cash balance. Current cash: Br ${financeFormat(cashBalance)}. Required: Br ${financeFormat(netAmount)}.`,
            variant: 'error',
          });
          return;
        }
      }
      const order = await viewModel.processOrder();
      handleClose();
      showAlert({ message: 'Purchase order completed successfully.', variant: 'success' });
      if (order && order.id) {
        openReceiptModal({ orderId: order.id });
      }
    } catch (err) {
      showAlert({ message: err.message || 'Failed to complete order.', variant: 'error' });
    }
  };

  const handleHold = async () => {
    if (loading) return;
    try {
      await viewModel.saveAsHoldOrder();
      handleClose();
      showAlert({ message: 'Order saved as hold order.', variant: 'success' });
    } catch (err) {
      showAlert({ message: err.message || 'Failed to save hold order.', variant: 'error' });
    }
  };

  const handleEdit = () => {
    handleClose();
  };

  return Row({ class: 'w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden' }, [
    CardHeader({ class: 'flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex items-center gap-2' }, [
        IonIcon({ name: 'document-text-outline', class: 'text-2xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-900' }, 'Confirm Purchase Order'),
      ]),
      IconButton({ onClick: handleEdit, delegator, class: 'text-gray-400 hover:text-gray-600' }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' }),
      ]),
    ]),
    CardBody({ class: 'px-6 py-5 space-y-4' }, [
      Row({ class: 'text-sm text-gray-600 mb-4' }, 'Review the order summary below, then complete, edit, or hold.'),
      Row({ class: 'grid grid-cols-2 gap-x-4 gap-y-3 text-sm' }, [
        Row({ class: 'text-gray-500' }, 'Supplier'),
        Row({ class: 'font-medium text-gray-900' }, supplierName),
        Row({ class: 'text-gray-500' }, 'Order date'),
        Row({ class: 'font-medium text-gray-900' }, currentOrder.order_date || '—'),
        Row({ class: 'text-gray-500' }, 'Invoice No.'),
        Row({ class: 'font-medium text-gray-900' }, currentOrder.invoice_no || '—'),
        Row({ class: 'text-gray-500' }, 'Payment'),
        Row({ class: 'font-medium text-gray-900' }, paymentLabel),
        Row({ class: 'text-gray-500' }, 'Items'),
        Row({ class: 'font-medium text-gray-900' }, String(itemCount)),
      ]),
      items.length > 0 &&
        Row({ class: 'border border-gray-100 rounded-lg overflow-hidden' }, [
          Row({ class: 'text-xs font-medium text-gray-500 uppercase tracking-wide px-3 py-2 bg-gray-50 border-b border-gray-100' }, 'Items'),
          Row({ class: 'max-h-32 overflow-y-auto px-3 py-2 space-y-1' }, items.map((item) =>
            Row({ class: 'flex justify-between text-sm text-gray-700 gap-2' }, [
              Row({ class: 'truncate flex-1 min-w-0' }, item.product_name || 'Unknown'),
              Row({ class: 'flex-shrink-0 text-gray-500' }, `${item.quantity} × Br ${financeFormat(item.unit_price)}`),
            ])
          )),
        ]),
      Row({ class: 'border-t border-gray-200 pt-4 mt-4 space-y-2' }, [
        Row({ class: 'flex justify-between text-sm' }, [
          Row({ class: 'text-gray-600' }, 'Gross amount'),
          Row({ class: 'font-medium' }, `Br ${financeFormat(totals.subtotal)}`),
        ]),
        isWithholding &&
          Row({ class: 'flex justify-between text-sm' }, [
            Row({ class: 'text-gray-600' }, `Withhold (${withholdPct != null ? withholdPct + '%' : '—'})`),
            Row({ class: 'font-medium text-orange-600' }, `- Br ${financeFormat(totals.withhold_amount)}`),
          ]),
        Row({ class: 'flex justify-between text-sm font-semibold border-t border-gray-100 pt-2' }, [
          Row({ class: 'text-gray-800' }, 'Net amount'),
          Row({ class: 'text-gray-900' }, `Br ${financeFormat(netAmount)}`),
        ]),
        Row({ class: 'flex justify-between text-sm' }, [
          Row({ class: 'text-gray-600' }, 'Amount paid'),
          Row({ class: 'font-medium text-green-600' }, `Br ${financeFormat(amountPaid)}`),
        ]),
        outstanding > 0.01 &&
          Row({ class: 'flex justify-between text-sm font-semibold' }, [
            Row({ class: 'text-gray-700' }, 'Outstanding'),
            Row({ class: 'text-red-600' }, `Br ${financeFormat(outstanding)}`),
          ]),
      ]),
    ]),
    CardFooter({ class: 'flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50' }, [
      Button({
        variant: 'secondary',
        onClick: handleEdit,
        disabled: loading,
        delegator,
        class: 'min-w-[100px]',
      }, 'Edit'),
      Button({
        variant: 'outline',
        onClick: handleHold,
        disabled: loading,
        delegator,
        class: 'min-w-[100px]',
      }, loading ? [Spinner({ class: 'w-4 h-4' }), ' Holding...'] : 'Hold'),
      Button({
        variant: 'primary',
        onClick: handleComplete,
        disabled: loading,
        delegator,
        class: 'min-w-[100px]',
      }, loading ? [Spinner({ class: 'w-4 h-4' }), ' Completing...'] : 'Complete'),
    ]),
  ]);
}
