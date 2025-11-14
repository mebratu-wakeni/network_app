const { Row } = Liteframe;


/**
 * Renders a configurable <button> element.
 * @param {Object} props
 * @param {Array<Object>|Object|string} props.children - The content/text of the button.
 * @param {Function} props.onClick - The event handler for the 'click' event.
 * @param {string} [props.variant='primary'] - Defines the button's color theme ('primary', 'secondary', 'danger').
 * @param {string} [props.type='button'] - HTML button type ('submit', 'button', 'reset').
 * @param {boolean} [props.disabled=false] - If true, disables the button and applies disabled styling.
 * @param {string} [props.className=''] - Custom Tailwind classes to override or extend the button's appearance.
 */
const Button = (props, children) => {
  const {
    onClick,
    variant = 'primary',
    type = 'button',
    disabled = false,
    class: className = '',
    delegator,
  } = props;

  // --- 1. Base Styling ---
  // Common styles for all buttons (padding, border, rounded, transition)
  const baseClasses = 'inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out';

  // --- 2. Variant Styling (Color Theme) ---
  let variantClasses;

  switch (variant) {
    case 'outline':
      variantClasses = 'bg-transparent text-indigo-600 border-indigo-500 hover:bg-indigo-50 focus:ring-indigo-500';
      break;
    case 'secondary':
      variantClasses = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:ring-indigo-500';
      break;
    case 'danger':
      variantClasses = 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500';
      break;
    case 'primary': // Default
    default:
      variantClasses = 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500';
      break;
  }

  // --- 3. Disabled Styling ---
  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed'
    : '';

  // --- 4. Final Classes ---
  const finalClasses = `${baseClasses} ${variantClasses} ${disabledClasses} ${className}`;

  return Row({
    tagType: 'button',
    class: finalClasses,
    attributes: {
      type: type,
      disabled: disabled ? 'disabled' : null, // Set the HTML disabled attribute
    },
    delegator,
    events: { 'click': onClick }
  }, children);
};

const Spinner = () => Row({
  class: "inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
});

export {Button, Spinner};