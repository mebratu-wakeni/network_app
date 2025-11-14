const { Row } = Liteframe;

/**
 * Wraps an icon component to provide default interactive styling:
 * - Centered icon
 * - Circular background on hover (light gray)
 * @param {Object} props
 * @param {Array<Object>|Object} props.children - The icon component (e.g., IonIcon).
 * @param {string} [props.className=''] - Custom Tailwind classes for the wrapper div.
 * Use for margin, positioning, etc.
 * @param {string} [props.size='medium'] - Defines the size of the circular wrapper ('small', 'medium', 'large').
 */
const IconWrap = (props, children) => {
  const { class: className = '', size = 'medium', onClick } = props;

  // --- Base Styling for the wrapper ---
  // Flexbox for centering, rounded-full for circular shape, transition for hover effect
  const baseClasses = 'flex items-center justify-center rounded-full transition-colors duration-150 ease-in-out';
  const hoverClasses = 'hover:bg-gray-100'; // Light gray on hover

  // --- Size Variants ---
  let sizeClasses;
  switch (size) {
    case 'small':
      sizeClasses = 'w-8 h-8'; // e.g., for icons like 16-20px
      break;
    case 'large':
      sizeClasses = 'w-12 h-12'; // e.g., for icons like 28-32px
      break;
    case 'medium': // Default
    default:
      sizeClasses = 'w-10 h-10'; // e.g., for icons like 20-24px
      break;
  }

  // --- Final Classes ---
  const finalClasses = `${baseClasses} ${hoverClasses} ${sizeClasses} ${className}`;

  return Row({
    tagType: 'div',
    class: finalClasses,
    events: {'click': onClick}
  }, children);
};

/**
 * Renders a clickable button that can contain any children (text, icon, etc.).
 * Provides the circular wrapper, native <button> behavior (click/disabled), and
 * Google-style conditional hover effects.
 * * @param {Object} props
 * @param {Function} props.onClick - The event handler for the 'click' event.
 * @param {boolean} [props.disabled=false] - If true, disables the button and suppresses hover/click.
 * @param {string} [props.className=''] - Custom Tailwind classes for the button container.
 * @param {string} [props.size='medium'] - Size of the button/wrapper ('small', 'medium', 'large').
 * @param {Array<Object>|Object|string} children - The content of the button (icon, letter, etc.).
 */
const IconButton = (props, children) => {
  const {
    onClick,
    disabled = false,
    className = '',
    size = 'medium'
  } = props;

  // --- 1. Base Styling for the <button> element ---
  // Flexbox for centering, rounded-full for circular shape, transition for hover effect
  const baseClasses = 'flex items-center justify-center rounded-full transition-colors duration-150 ease-in-out border-none p-0 bg-transparent';

  // --- 2. Conditional Hover and Disabled States ---
  const hoverClasses = disabled
    ? 'cursor-not-allowed opacity-50' // Disabled look: grayed out, no cursor change
    : 'hover:bg-gray-200'; // focus:bg-gray-200'; // Interactive look: light gray background on hover/focus

  // --- 3. Size Variants ---
  let sizeClasses;
  switch (size) {
    case 'small':
      sizeClasses = 'w-8 h-8 text-sm'; // Added text size for clarity
      break;
    case 'large':
      sizeClasses = 'w-12 h-12 text-xl';
      break;
    case 'xlarge':
      sizeClasses = 'w-16 h-16 text-4xl';
      break;
    case 'medium': // Default
    default:
      sizeClasses = 'w-10 h-10 text-base';
      break;
  }

  // --- 4. Final Classes ---
  const finalClasses = `${baseClasses} ${sizeClasses} ${hoverClasses} ${className}`;

  return Row({
    tagType: 'button',
    class: finalClasses,
    attributes: {
      type: 'button',
      disabled: disabled ? 'disabled' : null,
    },
    // We only attach the click handler if the button is not disabled
    events: disabled ? {} : { 'click': onClick }
  }, children);
};

/**
 * Renders an Ionicons-style icon.
 * Assumes Ionicons script is loaded or similar icon font CSS is available.
 * @param {Object} props
 * @param {string} props.name - The name of the icon (e.g., 'home-outline', 'add', 'close').
 * @param {string} [props.className=''] - Custom Tailwind classes for the icon element itself.
 * @param {string} [props.size=''] - Optional size for the icon (e.g., 'small', 'large').
 * Ionicons uses this as an attribute.
 */
const IonIcon = (props) => {
  const { name, class: className = '', size = '' } = props;

  // Base styling for the icon. Text color will inherit from parent or be explicitly set.
  const baseClasses = `inline-block align-middle text-indigo-600 font-bold ${className}`; // inline-block for proper sizing, align-middle to center with text

  return Row({
    // Using 'ion-icon' tag directly for Ionicons.
    // If you're using a different icon font (e.g., Material Icons),
    // you might use 'i' and adjust the class based on 'name'.
    tagType: 'ion-icon',
    class: baseClasses,
    attributes: {
      name: name,
      ...(size && { size: size }) // Conditionally add size attribute if provided
    }
    // No children for ion-icon, as the icon is defined by the 'name' attribute
  });
};

// If you want a more generic approach that doesn't strictly depend on ion-icon tag:
/*
const GenericIcon = (props) => {
    const { name, className = '' } = props;
    // Example for Material Icons: <i class="material-icons">home</i>
    // Example for Font Awesome: <i class="fas fa-home"></i>
    // For your purpose, if 'name' directly maps to a class:
    return Row({
        tagType: 'i',
        class: `${name} ${className}` // Assuming 'name' contains the icon class like 'fas fa-home' or 'material-icons-home'
    });
};
*/

export {IconWrap, IconButton, IonIcon}