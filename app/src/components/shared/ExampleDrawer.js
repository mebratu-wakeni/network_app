const { Row } = Liteframe;

/**
 * Simple Stateless Drawer Component
 * Smooth sliding from the right edge
 */
const Drawer = (props = {}, children = []) => {
  const { class: className = '', openSlide = true } = props;

  return Row({ class: 'absolute inset-0 bg-transparent flex z-50' }, [
    // Backdrop area (click to close normally)
    Row({ class: 'flex-1 bg-transparent' }),

    // Sliding panel
    Row({
      class: `
        bg-white w-150
        box-shadow
        transition-transform duration-300 ease-out border border-gray-200
        ${openSlide ? 'translate-x-0' : 'translate-x-full'}
        ${className}
      `,
      attributes: {
        style: 'box-shadow: -12px 0 24px rgba(15, 23, 42, 0.12);'
      }
    }, children)
  ]);
};

export default Drawer;
