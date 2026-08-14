const { Row } = Liteframe;
import { twMerge } from 'tailwind-merge'

/**
 * Renders a highly configurable <input> element.
 * @param {Object} props
 * @param {string} [props.type='text'] - The HTML input type (e.g., 'text', 'password').
 * @param {string} props.name - The HTML 'name' and 'id' attribute.
 * @param {string|number} props.value - The current value of the input.
 * @param {Function} props.onChange - Callback function for the 'change' event.
 * @param {string} [props.placeholder=''] - Placeholder text.
 * @param {boolean} [props.isError=false] - If true, applies error styling.
 * @param {string} [props.className=''] - Custom Tailwind classes for the input element itself.
 */
const Input = (props) => {
  const {
    type = 'text',
    name,
    value,
    accept,
    onChange,
    onInput,
    focusIn,
    focusOut,
    placeholder = '',
    required = false,
    isError = false,
    class: className = '',
    delegator,
  } = props;

  // 1. Define base/default Tailwind classes
  const baseClasses = 'block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm transition duration-150 ease-in-out placeholder:text-gray-500';

  // 2. Conditional classes for error state
  const errorClasses = isError
    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' // Error look
    : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'; // Normal look

  const combinedClasses = `${baseClasses} ${errorClasses}`
  // 3. Final Input Classes
  const finalInputClasses = twMerge(combinedClasses, className);

  const events = {};
  
  if(onChange) events['change'] = onChange;
  if(onInput) events['input'] = onInput;
  if(focusIn) events['focusin'] = focusIn;
  if(focusOut) events['focusout'] = focusOut;

  return Row({
    tagType: 'input',
    class: finalInputClasses,
    attributes: {
      type: type,
      name: name,
      id: name, // ID links to the Label's 'for' attribute
      ...(type === 'file' ? {} : { value: value }),
      ...(accept ? { accept } : {}),
      placeholder: placeholder,
      'aria-invalid': isError ? "true" : "false",
      required,
    },
    events,
  
    delegator,
  });
};

const ErrorMessage = (props) => {
  const { name, message } = props;
  return Row({
    tagType: 'p',
    class: "mt-2 text-sm text-red-600",
    attributes: { id: `${name}-error` }
  }, message);
};

export { Input, ErrorMessage };