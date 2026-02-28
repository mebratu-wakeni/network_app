import { CardHeader, CardBody } from '../../../utils/Card';
import { Button } from '../../../utils/Button';
import { Input } from '../../../utils/Input';
import { SelectFluid, SelectOptions } from '../../../utils/Select';
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table';
import { IconButton, IonIcon } from '../../../utils/Icon';
import { showAlert } from '../../../utils/ModalHelpers';
import { formatDateDDMMYYYY } from '../../../utils/DateUtils';

const { Row } = Liteframe;

export function Payments(props) {
  const orderList = props.viewModel.getOrderList();
  const orders = orderList.orders || [];
  const loading = props.viewModel.getState('loading');
  const paymentHistory = props.viewModel.getPaymentHistory();
  const selectedOrderId = props.viewModel.getState('selected-order-for-payment');
  const paymentModalOpen = props.viewModel.getState('payment-modal-open');

  // Local state for order search
  props.ensureLocalStateKey('orderSearchInput', '');

  const handleOrderSearch = async (e) => {
    const value = e.target.value;
    props.setLocalState('orderSearchInput', value);
    // Search orders and load payment history if order selected
    // This is a simplified version - you might want to implement order search API
  }

  const handleSelectOrder = async (orderId) => {
    try {
      await props.viewModel.loadPaymentHistory(orderId);
    } catch (error) {
      await showAlert({ message: error.message || 'Failed to load payment history', variant: 'error' });
    }
  }

  // If order is selected, show payment history
  if (selectedOrderId) {
    return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden p-4' }, [
      Row({ class: 'mb-4 flex items-center justify-between flex-shrink-0' }, [
        Row({ class: 'text-lg font-semibold' }, 'Payment History'),
        Button({
          variant: 'secondary',
          onClick: () => {
            props.viewModel.closePaymentModal();
          }
        }, 'Back to Orders')
      ]),
      
      Row({ class: 'mb-4 flex-shrink-0 bg-gray-50 border border-gray-200 rounded p-4' }, [
        Row({ class: 'grid grid-cols-3 gap-4' }, [
          Row({}, [
            Row({ class: 'text-xs text-gray-500 mb-1' }, 'Total Paid'),
            Row({ class: 'text-xl font-bold text-green-600' }, 
              `Br ${(paymentHistory.total_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            )
          ]),
          Row({}, [
            Row({ class: 'text-xs text-gray-500 mb-1' }, 'Outstanding Balance'),
            Row({ class: 'text-xl font-bold text-red-600' }, 
              `Br ${(paymentHistory.outstanding_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            )
          ]),
          Row({}, [
            Button({
              variant: 'primary',
              onClick: () => {
                props.viewModel.openPaymentModal(selectedOrderId);
              }
            }, 'Record Payment')
          ])
        ])
      ]),

      Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden border border-gray-200 rounded' }, [
        paymentHistory.payments && paymentHistory.payments.length > 0 ?
          Table({ class: 'min-w-full' }, [
            TableHeader({}, [
              TableRow({}, [
                TableHCell({}, 'Payment Date'),
                TableHCell({}, 'Amount'),
                TableHCell({}, 'Payment Mode'),
                TableHCell({}, 'Cheque Details')
              ])
            ])
          ]) :
          Row({ class: 'p-8 text-center text-gray-500' }, 'No payments recorded'),
        paymentHistory.payments && paymentHistory.payments.length > 0 ?
          TableBody({}, [
            ...paymentHistory.payments.map(payment => 
              TableRow({ key: payment.id }, [
                TableDCell({}, formatDateDDMMYYYY(payment.payment_date)),
                TableDCell({ class: 'font-medium' }, 
                  `Br ${(payment.payment_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                ),
                TableDCell({ class: 'capitalize' }, payment.payment_mode || 'cash'),
                TableDCell({}, 
                  payment.cheque_details ? 
                    `${payment.cheque_details.bank_name || ''} - ${payment.cheque_details.cheque_number || ''}` :
                    '-'
                )
              ])
            )
          ]) : null
      ])
    ])
  }

  // Default view: List orders with outstanding balance
  const ordersWithOutstanding = orders.filter(o => (o.outstanding_balance || 0) > 0.01);

  return Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden p-4' }, [
    Row({ class: 'mb-4 flex-shrink-0' }, [
      Input({
        type: 'text',
        placeholder: 'Search orders by receipt # or supplier...',
        value: props.getLocalState('orderSearchInput') || '',
        onChange: handleOrderSearch,
        class: 'w-full max-w-md'
      })
    ]),

    Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden border border-gray-200 rounded' }, [
      loading ? Row({ class: 'p-8 text-center text-gray-500' }, 'Loading orders...') :
      ordersWithOutstanding.length === 0 ? Row({ class: 'p-8 text-center text-gray-500' }, 'No orders with outstanding balance') :
      Table({ class: 'min-w-full' }, [
        TableHeader({}, [
          TableRow({}, [
            TableHCell({}, 'Receipt #'),
            TableHCell({}, 'Supplier'),
            TableHCell({}, 'Date'),
            TableHCell({}, 'Net Amount'),
            TableHCell({}, 'Outstanding'),
            TableHCell({ class: 'w-32' }, 'Action')
          ])
        ])
      ]),
      ordersWithOutstanding.length > 0 ?
        TableBody({}, [
          ...ordersWithOutstanding.map(order => 
            TableRow({ key: order.id }, [
              TableDCell({ class: 'font-medium' }, order.receipt_number || `PO${order.id}`),
              TableDCell({}, order.supplier_name || 'Unknown'),
              TableDCell({}, formatDateDDMMYYYY(order.order_date)),
              TableDCell({}, 
                `Br ${(order.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
              ),
              TableDCell({ class: 'font-medium text-red-600' }, 
                `Br ${(order.outstanding_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
              ),
              TableDCell({}, [
                Button({
                  variant: 'primary',
                  onClick: () => handleSelectOrder(order.id),
                  class: 'text-xs'
                }, 'View Payments')
              ])
            ])
          )
        ]) : null
    ])
  ])
}
