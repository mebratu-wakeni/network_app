import Modal from '../../shared/Modal';
import { CardHeader, CardBody, CardFooter } from '../../utils/Card';
import { Button, Spinner } from '../../utils/Button';
import { Input } from '../../utils/Input';
import { SelectFluid, SelectOptions } from '../../utils/Select';
import { IconButton, IonIcon } from '../../utils/Icon';
import { showAlert } from '../../utils/ModalHelpers';

const { Row } = Liteframe;

const PAYMENT_MODE_OPTIONS = ['Cash', 'Cheque'];

const financeFormat = (v) => (v != null ? Number(v) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Label + field wrapper: consistent block label (mb-2) then control. */
function FormField(props, children) {
  const { label, labelRequired } = props;
  return Row({ class: 'block' }, [
    Row({ tagType: 'label', class: 'block text-sm font-medium text-gray-700 mb-2' }, label + (labelRequired ? ' *' : '')),
    children,
  ]);
}

export function PaymentModalContent(props) {
  const { handleClose, embedded } = props;
  const selectedOrderId = props.viewModel.getState('selected-order-for-payment');
  const paymentHistory = props.viewModel.getPaymentHistory();
  const loading = props.viewModel.getState('loading');
  const onClose = handleClose || (() => props.viewModel.closePaymentModal());

  const outstandingBalance = Number(paymentHistory?.outstanding_balance ?? 0);
  const vm = props.viewModel;
  const lastOrderId = vm.getState('payment-form-order-id');
  if (!selectedOrderId) {
    // Modal closed; VM closePaymentModal already clears payment-form-order-id
  } else if (lastOrderId !== selectedOrderId) {
    vm.setPaymentFormDefaults();
  }
  const paymentForm = vm.getState('payment-form') || {};

  const handleSubmit = async () => {
    try {
      if (!paymentForm.payment_amount || parseFloat(paymentForm.payment_amount) <= 0) {
        await showAlert({ message: 'Please enter a valid payment amount.', variant: 'error' });
        return;
      }

      const paymentAmount = parseFloat(paymentForm.payment_amount);
      if (paymentAmount > outstandingBalance + 0.01) {
        await showAlert({
          message: `Payment amount cannot exceed outstanding balance of Br ${outstandingBalance.toFixed(2)}.`,
          variant: 'error',
        });
        return;
      }

      const paymentData = {
        payment_amount: paymentAmount,
        payment_mode: paymentForm.payment_mode,
        payment_date: paymentForm.payment_date,
        cheque_details: paymentForm.payment_mode === 'cheque' ? {
          bank_name: paymentForm.cheque_details.bank_name,
          cheque_number: paymentForm.cheque_details.cheque_number,
          cheque_date: paymentForm.cheque_details.cheque_date
        } : null,
        notes: paymentForm.notes || null
      };

      await props.viewModel.recordPayment(paymentData);
      await showAlert({
        title: 'Payment Recorded',
        message: 'The payment has been recorded successfully.',
        variant: 'success',
      });
      props.viewModel.resetPaymentForm();
    } catch (error) {
      await showAlert({
        message: error.message || 'Failed to record payment.',
        variant: 'error',
      });
    }
  }

  if (!selectedOrderId) {
    return Row({ class: 'p-4 text-center text-gray-500' }, 'No order selected for payment');
  }

  const header = embedded ? null : CardHeader({ class: 'flex items-center justify-between px-6 py-4' }, [
    Row({ class: 'text-lg font-semibold text-gray-900' }, 'Record Payment'),
    IconButton({
      icon: 'close-outline',
      class: 'text-gray-400 hover:text-gray-600',
      events: { click: onClose },
    }),
  ]);

  const paymentModeDisplay = paymentForm.payment_mode === 'cheque' ? 'Cheque' : 'Cash';
  const footerClass = embedded
    ? 'flex justify-end gap-2 px-5 py-3 border-t border-gray-200 flex-shrink-0'
    : 'flex items-center justify-end gap-3 px-6 py-4';

  return Row({ class: 'w-full max-w-2xl flex flex-col h-full' }, [
    ...(header ? [header] : []),
    CardBody({ class: embedded ? 'px-0 py-0 space-y-4 flex-1 min-h-0' : 'px-6 py-4 space-y-4' }, [
      Row({ class: 'bg-blue-50 border border-blue-200 rounded-lg p-4' }, [
        Row({ class: 'text-xs font-medium uppercase tracking-wide text-blue-700 mb-1' }, 'Outstanding Balance'),
        Row({ class: 'text-xl font-semibold text-blue-900' }, `Br ${financeFormat(outstandingBalance)}`),
      ]),

      FormField({ label: 'Payment Amount', labelRequired: true }, [
        Input({
          type: 'number',
          name: 'payment-amount',
          value: paymentForm.payment_amount || '',
          onChange: (e) => vm.updatePaymentForm({ payment_amount: e.target.value }),
          placeholder: '0.00',
          step: '0.01',
          min: '0',
          max: outstandingBalance.toString(),
          class: 'w-full',
        }),
      ]),

      FormField({ label: 'Payment Method', labelRequired: true }, [
        SelectFluid({
          name: 'payment-mode',
          value: paymentModeDisplay,
          onChange: (e) => vm.updatePaymentForm({ payment_mode: e.target.value.toLowerCase() }),
        }, [
          SelectOptions({
            options: PAYMENT_MODE_OPTIONS,
            selectedOption: paymentModeDisplay,
          }),
        ]),
      ]),

      FormField({ label: 'Payment Date', labelRequired: true }, [
        Input({
          type: 'date',
          name: 'payment-date',
          value: paymentForm.payment_date || '',
          onChange: (e) => vm.updatePaymentForm({ payment_date: e.target.value }),
          class: 'w-full',
        }),
      ]),

      paymentForm.payment_mode === 'cheque'
        ? Row({ class: 'space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4' }, [
            Row({ class: 'text-xs font-medium uppercase tracking-wide text-gray-600 mb-3' }, 'Cheque Details'),
            Row({ class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' }, [
              FormField({ label: 'Bank Name', labelRequired: true }, [
                Input({
                  type: 'text',
                  name: 'bank-name',
                  value: paymentForm.cheque_details?.bank_name || '',
                  onChange: (e) => vm.updatePaymentForm({
                    cheque_details: { ...(paymentForm.cheque_details || {}), bank_name: e.target.value }
                  }),
                  placeholder: 'Bank name',
                  class: 'w-full',
                }),
              ]),
              FormField({ label: 'Cheque Number', labelRequired: true }, [
                Input({
                  type: 'text',
                  name: 'cheque-number',
                  value: paymentForm.cheque_details?.cheque_number || '',
                  onChange: (e) => vm.updatePaymentForm({
                    cheque_details: { ...(paymentForm.cheque_details || {}), cheque_number: e.target.value }
                  }),
                  placeholder: 'Cheque number',
                  class: 'w-full',
                }),
              ]),
              Row({ class: 'sm:col-span-2' }, [
                FormField({ label: 'Cheque Date', labelRequired: true }, [
                  Input({
                    type: 'date',
                    name: 'cheque-date',
                    value: paymentForm.cheque_details?.cheque_date || '',
                    onChange: (e) => vm.updatePaymentForm({
                      cheque_details: { ...(paymentForm.cheque_details || {}), cheque_date: e.target.value }
                    }),
                    class: 'w-full',
                  }),
                ]),
              ]),
            ]),
          ])
        : null,

      FormField({ label: 'Notes', labelRequired: false }, [
        Input({
          type: 'text',
          name: 'notes',
          value: paymentForm.notes || '',
          onChange: (e) => vm.updatePaymentForm({ notes: e.target.value }),
          placeholder: 'Additional notes (optional)',
          class: 'w-full',
        }),
      ])
    ]),
    CardFooter({ class: footerClass }, [
      Button({ variant: 'secondary', onClick: onClose }, embedded ? 'Close' : 'Cancel'),
      embedded && props.onViewReceipt ? Button({ variant: 'secondary', onClick: props.onViewReceipt }, 'View Receipt') : null,
      Button({
        variant: 'primary',
        onClick: handleSubmit,
        disabled: loading || !paymentForm.payment_amount || parseFloat(paymentForm.payment_amount) <= 0,
      }, loading ? [Spinner({ class: 'w-4 h-4' }), ' Recording...'] : 'Record Payment'),
    ].filter(Boolean)),
  ])
}
