const { Row, EventDelegator } = Liteframe;

const Modal = (props, childComponent) => {

  // 1. Create the Modal Container (The Backdrop)
  // We use fixed positioning to cover the entire viewport and a dark, semi-transparent background.
  const baseClasses = 'fixed inset-0 bg-gray-800/50 flex items-center justify-center p-4 z-50';

  // const baseClasses = "fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto bg-gray-500/75 bg-transparent backdrop:bg-transparent";

  const modal = Row({
    // tagType: 'dialog'
    id: 'modal-backdrop', // Use a more descriptive ID
    attributes: {id: 'modal-backdrop'},
    class: `${baseClasses} ${props.class || ''}`
  });

  

  

  // Append to the body
  document.body.appendChild(modal);

  // 3. Setup Event Delegation
  const delegator = new EventDelegator(modal);

  // 2. Define the Close Handler
  const handleClose = () => {
    // We use the ID to find and remove the whole modal container.
    // NOTE: document.getElementById is needed here.


    const modalElement = document.getElementById('modal-backdrop');

    if (modalElement) {
      modalElement.remove();
    }
  }

  // 4. Expose handleClose to the Child Component
  // We modify the childComponent call to pass the close handler.
  // The childComponent will now receive two arguments: (delegator, handleClose)
  const childContent = childComponent(delegator, handleClose);

  // 5. Append Content and Mount to DOM
  modal.appendChild(childContent);

  

  // 5. Backdrop Click Handler (Attached to the main modal element)
  modal.addEventListener('click', (event) => {
    // Only close if the click originated from the backdrop itself, not its children.
    if (event.target.id === 'modal-backdrop') {
      handleClose();
    }
  });

}

export default Modal;