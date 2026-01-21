import { Button } from "../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../utils/Card";
import { IconButton, IonIcon } from "../utils/Icon";

const { Row } = Liteframe;

/**
 * ConfirmationModal - A reusable confirmation dialog modal
 * @param {Object} props - { title, message, confirmText, cancelText, onConfirm, onCancel, variant }
 * @param {EventDelegator} delegator - Event delegator from Modal
 * @param {Function} handleClose - Close handler from Modal
 */
export function ConfirmationModalContent({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, variant = 'danger', icon = 'warning-outline' }, delegator, handleClose) {
  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    handleClose();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    handleClose();
  };

  const iconColor = variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-yellow-600' : 'text-indigo-600';
  const confirmButtonVariant = variant === 'danger' ? 'danger' : 'primary';

  return Card({
    class: 'bg-white rounded-lg shadow-2xl w-full max-w-md transform transition-all'
  }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: icon, class: `text-xl ${iconColor}` }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, title || 'Confirm Action')
      ]),
      IconButton({ onClick: handleCancel, size: 'medium', delegator }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    CardBody({ class: 'px-6 py-4' }, [
      Row({ class: 'text-sm text-gray-700' }, message || 'Are you sure you want to proceed?')
    ]),
    CardFooter({ class: 'flex justify-end gap-3 px-6 py-4 border-t border-gray-200' }, [
      Button({ variant: 'secondary', onClick: handleCancel, delegator }, cancelText),
      Button({ variant: confirmButtonVariant, onClick: handleConfirm, delegator }, confirmText)
    ])
  ]);
}

/**
 * AlertModal - A reusable alert/info dialog modal
 * @param {Object} props - { title, message, buttonText, onClose, variant }
 * @param {EventDelegator} delegator - Event delegator from Modal
 * @param {Function} handleClose - Close handler from Modal
 */
export function AlertModalContent({ title, message, buttonText = 'OK', onClose, variant = 'info', icon = 'information-circle-outline' }, delegator, handleClose) {
  const handleOk = () => {
    if (onClose) {
      onClose();
    }
    handleClose();
  };

  const iconColor = variant === 'error' ? 'text-red-600' : variant === 'warning' ? 'text-yellow-600' : variant === 'success' ? 'text-green-600' : 'text-indigo-600';
  const buttonVariant = variant === 'error' ? 'danger' : variant === 'success' ? 'primary' : 'secondary';

  return Card({
    class: 'bg-white rounded-lg shadow-2xl w-full max-w-md transform transition-all'
  }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: icon, class: `text-xl ${iconColor}` }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, title || 'Alert')
      ]),
      IconButton({ onClick: handleOk, size: 'medium', delegator }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    CardBody({ class: 'px-6 py-4' }, [
      Row({ class: 'text-sm text-gray-700 whitespace-pre-line' }, message || '')
    ]),
    CardFooter({ class: 'flex justify-end gap-3 px-6 py-4 border-t border-gray-200' }, [
      Button({ variant: buttonVariant, onClick: handleOk, delegator }, buttonText)
    ])
  ]);
}
