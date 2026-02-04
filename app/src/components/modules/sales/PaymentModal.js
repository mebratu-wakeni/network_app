import Modal from '../../shared/Modal';
import { CardHeader, CardBody, CardFooter } from '../../utils/Card';
import { Button, Spinner } from '../../utils/Button';
import { Input } from '../../utils/Input';
import { showAlert } from '../../utils/ModalHelpers';

const { Row } = Liteframe;

export function PaymentModalContent(props, delegator, handleClose) {
  const loading = props.viewModel?.getState('loading');
  return Row({ class: 'w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden' }, [
    CardHeader({ class: 'px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'text-lg font-semibold text-gray-800' }, 'Record Payment'),
    ]),
    CardBody({ class: 'px-6 py-4' }, [
      Row({ class: 'text-sm text-gray-500' }, 'Sales payment recording will be available when the sales API is connected.'),
    ]),
    CardFooter({ class: 'flex justify-end gap-2 px-6 py-4 border-t border-gray-200' }, [
      Button({ variant: 'secondary', onClick: handleClose, delegator }, 'Close'),
    ]),
  ]);
}
