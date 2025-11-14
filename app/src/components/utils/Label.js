const { Row } = Liteframe;
/**
 * Renders a highly configurable <label> element.
 * @param {Object} props
 * @param {string} props.name - The 'for' attribute, matching the input's 'id'.
 * @param {string} props.text - The text content of the label.
 * @param {string} [props.className=''] - Custom Tailwind classes for the label itself.
 */
const Label = (props) => {
  const { name, text, class: className = '' } = props;

  // Default styling for form labels
  const baseClasses = "block text-sm font-medium text-gray-700";

  return Row({
    tagType: 'label',
    attributes: { for: name },
    class: `${baseClasses} ${className}`
  }, text);
};

export default Label;