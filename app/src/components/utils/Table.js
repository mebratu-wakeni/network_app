const { Row } = Liteframe;

/**
 * The main container for the Table component.
 * IMPROVEMENT: Adds max-height and overflow-y for fixed header functionality.
 */
const Table = (props, children) => {
  const { class: className = '' } = props;

  // Added 'relative' to the wrapper for positioning context.
  const baseClasses = 'min-w-full divide-y divide-gray-200 sm:rounded-lg relative';

  // The inner <table> tag needs no overflow settings, but we need to prevent it from expanding
  const tableElement = Row({ tagType: 'table', class: 'min-w-full divide-y divide-gray-300' }, children);

  // Wrapper div for responsive scrolling AND fixed header
  // Ensure the outer wrapper cannot become the scroll container by forcing `overflow-hidden`.
  // The inner scrollable div (`overflow-y-auto`) is the single vertical scroller that
  // `position: sticky` on table headers will use.
  return Row({
    tagType: 'div',
    class: `overflow-hidden ${baseClasses} ${className} flex flex-col flex-1 min-h-0`
  }, [
    Row({ tagType: 'div', class: 'overflow-x-auto overflow-y-auto flex-1 min-h-0', 
      attributes: { 
        // style: 'max-height: calc(100vh - 12rem);', 
        id: props.id } }, [
      tableElement
    ])
  ]);
};

/**
 * Renders the table header section (<thead>).
 * @param {Object} props
 * @param {Array<Object>} props.children - The TableRow element containing TableCells/TableHeaders.
 */

const TableHeader = (props, children) => {
  return Row({
    tagType: 'thead',
    class: `bg-gray-50 ${props.class || ''}`
  }, children);
};

/**
 * Renders the table body section (<tbody>).
 * @param {Object} props
 * @param {Array<Object>} props.children - Array of TableRow elements.
 */

const TableBody = (props, children) => {
  const {class: className = ''} = props;
  return Row({
    tagType: 'tbody',
    // Added 'odd:bg-gray-50'
    class: `divide-y divide-gray-200 bg-white odd:bg-gray-50 ${className}`,
  }, children);
};

/**
 * Renders a single table row (<tr>).
 * @param {Object} props
 * @param {Array<Object>} props.children - Array of TableCell elements.
 */
const TableRow = (props, children) => {
  const { class: className = '', onClick } = props;
  return Row({
    tagType: 'tr',
    class: className,
    events: {'click': onClick}
  }, children);
};

// --- TableHeaderCell (<th>) ---

const TableHCell = (props, children) => {
  const { class: className = '' } = props;
  return Row({
    tagType: 'th',
    // Sticky positioning: each th cell sticks to top of scrollable container
    // Use a solid white background and slightly higher z so header overlays rows reliably.
    class: `px-6 py-5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider sticky top-0 z-20 bg-white ${className}`,
    attributes: { scope: 'col' }
  }, children);
};

// --- TableCell (<td>) ---

const TableDCell = (props, children) => {
  const { class: className = '' } = props;
  return Row({
    tagType: 'td',
    // Changed 'py-4' to 'py-3' for tighter body row
    class: `whitespace-nowrap px-6 py-3 text-sm text-gray-900 ${className}`
  }, children);
};

/**
 * Renders the table footer section (<tfoot>).
 * @param {Object} props
 * @param {Array<Object>} props.children - Content of the footer (e.g., summary, Pagination).
 */
const TableFooter = (props, children) => {
  return Row({
    tagType: 'tfoot',
    class: 'bg-gray-50'
  }, children);
};

export { Table, TableHeader, TableBody, TableRow, TableDCell, TableHCell, TableFooter }