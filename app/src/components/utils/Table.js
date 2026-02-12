const { Row } = Liteframe;

/**
 * Table component: parent is flex-col, so Table uses flex-1 to take the rest of the space.
 * Structure: Table = flex-1 flex-col overflow-hidden; inner scroll wrapper = flex-1 min-h-0
 * min-w-0 overflow-auto so the table body area scrolls. Thead is sticky inside that scroll area.
 */
const Table = (props, children) => {
  const { class: className = '', tableClass = '' } = props;

  const baseClasses = 'min-w-full divide-y divide-gray-200 sm:rounded-lg relative';

  const tableElement = Row({ tagType: 'table', class: `min-w-full divide-y divide-gray-300 ${tableClass}`.trim() }, children);

  // Outer: Table takes rest of space in parent flex-col; flex-col + overflow-hidden so inner can scroll
  const outerClass = `flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden ${baseClasses} ${className}`.trim();
  // Inner: scrollable body area – flex-1 min-h-0 min-w-0 overflow-auto; pb-48 so bottom-row dropdowns aren't cut off
  const scrollClass = 'flex-1 min-h-0 min-w-0 overflow-auto pb-48';
  return Row({
    tagType: 'div',
    class: outerClass
  }, [
    Row({
      tagType: 'div',
      class: scrollClass,
      attributes: { id: props.id || undefined }
    }, [tableElement])
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
  const events = onClick ? { click: onClick } : {};
  return Row({
    tagType: 'tr',
    class: className,
    events
  }, children);
};

// --- TableHeaderCell (<th>) ---

const TableHCell = (props, children) => {
  const { class: className = '', onClick, delegator } = props;

  let events = {};
  if (onClick) {
    events['click'] = onClick;
  }
  return Row({
    tagType: 'th',
    // Sticky positioning: each th cell sticks to top of scrollable container
    // Use a solid white background and slightly higher z so header overlays rows reliably.
    class: `px-6 py-5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider sticky top-0 z-20 bg-white ${className}`,
    attributes: { scope: 'col' },
    events: events,
    delegator,
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