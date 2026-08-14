import Modal from "../shared/Modal";
import { ConfirmationModalContent, AlertModalContent } from "../shared/ConfirmationModal";
import { formatUserError } from './userErrorMessage.js';

/**
 * Show a confirmation dialog
 * @param {Object} options - { title, message, confirmText, cancelText, onConfirm, onCancel, variant, icon }
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirmation(options = {}) {
  return new Promise((resolve) => {
    const handleConfirm = async () => {
      if (options.onConfirm) {
        await options.onConfirm();
      }
      resolve(true);
    };

    const handleCancel = () => {
      if (options.onCancel) {
        options.onCancel();
      }
      resolve(false);
    };

    Modal({}, (delegator, handleClose) => {
      // Wrap handleClose to also resolve the promise
      const wrappedClose = () => {
        handleClose();
        resolve(false);
      };

      return ConfirmationModalContent({
        ...options,
        onConfirm: handleConfirm,
        onCancel: handleCancel
      }, delegator, wrappedClose);
    });
  });
}

/**
 * Show an alert dialog
 * @param {Object} options - { title, message, buttonText, onClose, variant, icon }
 */
export function showAlert(options = {}) {
  return new Promise((resolve) => {
    const handleOk = () => {
      if (options.onClose) {
        options.onClose();
      }
      resolve();
    };

    Modal({}, (delegator, handleClose) => {
      // Wrap handleClose to also resolve the promise
      const wrappedClose = () => {
        handleClose();
        resolve();
      };

      const message = options.message != null
        ? formatUserError(options.message, typeof options.message === 'string' ? options.message : 'Something went wrong. Please try again.')
        : options.message;

      return AlertModalContent({
        ...options,
        message,
        onClose: handleOk
      }, delegator, wrappedClose);
    });
  });
}
