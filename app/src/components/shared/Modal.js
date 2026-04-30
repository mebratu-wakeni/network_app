const { Row, EventDelegator } = Liteframe;

const Modal = (props, childComponent) => {
  // Full-viewport overlay; child content is centered by flex. Stack above main UI.
  const baseClasses = 'fixed inset-0 bg-gray-800/50 flex items-center justify-center p-4 z-[100]';

  const modal = Row({
    attributes: {
      id: props.id || `modal-backdrop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role: 'presentation'
    },
    class: `${baseClasses} ${props.class || ''}`
  });

  document.body.appendChild(modal);

  const delegator = new EventDelegator(modal);

  const handleClose = () => {
    modal.remove();
  };

  const childContent = childComponent(delegator, handleClose);
  // Lift dialog above backdrop fills in nested fixed/flex layouts (Electron/WebKit).
  const panelWrap = Row(
    { class: 'relative z-10 w-full flex justify-center items-center max-h-[90vh] min-h-0' },
    [childContent]
  );
  modal.appendChild(panelWrap);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      handleClose();
    }
  });
};

export default Modal;
