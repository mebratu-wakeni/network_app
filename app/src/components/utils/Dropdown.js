const { Row } = Liteframe;
// Assume the Row function is available globally or imported:
// function Row(config, children) { ... }

// --- Default Icon SVG Path (Down Arrow) ---
// This is used if the user doesn't pass an iconSvg prop
const DEFAULT_ICON_SVG = "M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z";

/**
 * Reusable Dropdown Component for Liteframe
 * @param {Object} props
 * @param {Array<string>} props.options - Array of option values (e.g., ['USD', 'EUR'])
 * @param {string} props.name - The name attribute for the select element
 * @param {string|number} props.value - The current selected value
 * @param {Function} props.onChange - Event handler for 'change'
 * @param {string} [props.className=''] - Custom Tailwind classes for the outer container
 * @param {string} [props.iconSvg=DEFAULT_ICON_SVG] - SVG path data for the custom icon
 * @returns {Array<Object>} The Liteframe element structure
 */
const Dropdown = (props) => {
  const {
    options = [],
    name,
    value,
    onChange,
    className = '',
    iconSvg = DEFAULT_ICON_SVG,
    ariaLabel = 'Select option'
  } = props;

  // Map the array of option values into Liteframe Row elements
  const optionElements = options.map(option => {
    // Option values are assumed to be strings for simplicity
    return Row({
      tagType: 'option',
      attributes: { value: option, selected: option === value ? 'selected' : null }
    }, option);
  });

  return Row({
    // Outer Container: Sets the grid layout and accepts external classes
    tagType: 'div',
    class: `grid shrink-0 grid-cols-1 focus-within:relative ${className}`
  }, [
    // 1. SELECT Element
    Row({
      tagType: 'select',
      class: "col-start-1 row-start-1 w-full appearance-none rounded-md bg-gray-800 py-1.5 pr-7 pl-3 text-base text-gray-400 *:bg-gray-800 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6",
      attributes: {
        id: name,
        name: name,
        'aria-label': ariaLabel,
        // Note: The 'value' attribute isn't typically set here in vanilla HTML,
        // but the selected state is determined by the 'selected' attribute on the option.
        // We'll rely on the 'selected' attribute inside optionElements.
      },
      events: { 'change': onChange }
    }, optionElements),

    // 2. SVG Icon (Custom Arrow)
    Row({
      tagType: 'svg',
      class: "pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-400 sm:size-4",
      attributes: {
        viewBox: "0 0 16 16",
        fill: "currentColor",
        'data-slot': "icon",
        'aria-hidden': "true",
      }
    }, [
      // Path element using the configurable iconSvg prop
      Row({
        tagType: 'path',
        attributes: {
          d: iconSvg,
          'clip-rule': "evenodd",
          'fill-rule': "evenodd"
        }
      })
    ])
  ]);
};

export default Dropdown;