const { Row } = Liteframe;

/**
 * Renders the image content for the Card.
 * @param {Object} props
 * @param {string} props.src - Image source URL.
 * @param {string} props.alt - Image alt text.
 * @param {string} [props.className=''] - Custom Tailwind classes.
 */
const CardImage = (props) => {
  const { src, alt, class: className = '' } = props;
  return Row({
    tagType: 'img',
    class: `w-full h-48 object-cover rounded-t-lg ${className}`, // rounded-t-lg ensures it fits the card
    attributes: {
      src: src,
      alt: alt,
    }
  });
};

/**
 * Renders the header/title section of the Card.
 * @param {Object} props
 * @param {Array<Object>|Object|string} props.children - Content of the header.
 * @param {string} [props.className=''] - Custom Tailwind classes.
 */
const CardHeader = (props, children) => {
  const { class: className = '' } = props;
  return Row({
    tagType: 'div',
    class: `px-6 py-4 border-b border-gray-200 ${className}`
  }, children);
};

/**
 * Renders the main content body of the Card.
 * @param {Object} props
 * @param {Array<Object>|Object|string} props.children - Content of the body.
 * @param {string} [props.className=''] - Custom Tailwind classes.
 */
const CardBody = (props, children) => {
  const { class: className = '' } = props;
  return Row({
    tagType: 'div',
    class: `p-6 ${className}`
  }, children);
};

/**
 * Renders the footer/action section of the Card.
 * @param {Object} props
 * @param {Array<Object>|Object|string} props.children - Content of the footer.
 * @param {string} [props.className=''] - Custom Tailwind classes.
 */
const CardFooter = (props, children) => {
  const { class: className = '' } = props;
  return Row({
    tagType: 'div',
    class: `px-6 py-4 border-t border-gray-200 flex justify-end gap-2 ${className}`
  }, children);
};

/**
 * The main container for the Card component.
 * @param {Object} props
 * @param {Array<Object>|Object} props.children - Card accessories (Header, Body, Footer, Image).
 * @param {string} [props.className=''] - Custom Tailwind classes for the card container itself (e.g., width, margin).
 */
const Card = (props, children) => {
  const { class: className = '' } = props;

  // Base styling for the card container
  const baseClasses = 'bg-white rounded-lg shadow-xl overflow-hidden';

  return Row({
    tagType: 'div',
    class: `${baseClasses} ${className}`
  }, children);
};


export { CardImage, CardHeader, CardBody, CardFooter, Card };