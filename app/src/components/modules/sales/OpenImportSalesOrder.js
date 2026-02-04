import Modal from '../../shared/Modal';
import { Button } from '../../utils/Button';
import { CardHeader, CardBody, CardFooter } from '../../utils/Card';
import { showAlert } from '../../utils/ModalHelpers';

const { Row } = Liteframe;

export function OpenImportSalesOrderModal(props) {
  Modal({}, (delegator, handleClose) => {
    return Row({ class: 'w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden' }, [
      CardHeader({ class: 'px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
        Row({ class: 'text-lg font-semibold text-gray-800' }, 'Import Sales Orders'),
      ]),
      CardBody({ class: 'px-6 py-4' }, [
        Row({ class: 'text-sm text-gray-500' }, 'Bulk import for sales orders will be available when the sales API is connected.'),
      ]),
      CardFooter({ class: 'flex justify-end gap-2 px-6 py-4 border-t border-gray-200' }, [
        Button({ variant: 'secondary', onClick: handleClose, delegator }, 'Close'),
      ]),
    ]);
  });
}
