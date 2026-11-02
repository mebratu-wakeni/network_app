const { Row } = Liteframe;

/**
 * Simple Stateless Drawer Component
 * Smooth sliding from the right edge
 */
const Drawer = (props = {}, children = []) => {
  const { class: className = '', openSlide = true } = props;
  // When slid closed, do not intercept clicks on the module underneath (ghost overlay bug).
  const pointerClass = openSlide ? 'pointer-events-auto' : 'pointer-events-none';

  return Row({ class: `absolute inset-0 bg-transparent flex z-50 ${pointerClass}` }, [
    // Backdrop area (click to close normally)
    Row({ class: `flex-1 bg-transparent ${pointerClass}` }),

    // Sliding panel
    Row({
      class: `
        bg-white w-150
        box-shadow
        transition-transform duration-300 ease-out border border-gray-200
        pointer-events-auto
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
