const { Row } = Liteframe;

/**
 * Table component: parent is flex-col, so Table uses flex-1 to take the rest of the space.
 * Structure: Table = flex-1 flex-col overflow-hidden; inner scroll wrapper = flex-1 min-h-0
 * min-w-0 overflow-auto so the table body area scrolls. Thead is sticky inside that scroll area.
 */
const Table = (props, children) => {
  const { class: className = '', tableClass = '', pageScrollable = false } = props;

  const baseClasses = 'min-w-full divide-y divide-gray-200 sm:rounded-lg relative';

  const tableElement = Row({ tagType: 'table', class: `min-w-full divide-y divide-gray-300 ${tableClass}`.trim() }, children);

  // Default behavior: table manages its own vertical scroll area.
  // pageScrollable=true: parent page handles vertical scrolling, table keeps only horizontal overflow.
  const outerClass = pageScrollable
    ? `flex flex-col min-w-0 ${baseClasses} ${className}`.trim()
    : `flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden ${baseClasses} ${className}`.trim();
  const scrollClass = pageScrollable
    ? 'min-w-0 overflow-visible'
    : 'flex-1 min-h-0 min-w-0 overflow-auto pb-24 lg:pb-40';
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
  const {
    class: className = '',
    showEndMarker = false,
    endMarkerLabel = 'End of table',
    endMarkerColspan = 1,
    endMarkerHeightClass = 'h-16'
  } = props;

  const endMarkerRow = showEndMarker
    ? Row({ tagType: 'tr', class: 'pointer-events-none' }, [
        Row({
          tagType: 'td',
          class: `${endMarkerHeightClass} text-center text-xs text-gray-400 bg-gradient-to-b from-white to-gray-50`,
          attributes: { colspan: endMarkerColspan }
        }, Row({ class: 'inline-flex items-center gap-2' }, [
          Row({ class: 'w-10 border-t border-dashed border-gray-300' }),
          Row({}, endMarkerLabel),
          Row({ class: 'w-10 border-t border-dashed border-gray-300' })
        ]))
      ])
    : null;

  return Row({
    tagType: 'tbody',
    // Added 'odd:bg-gray-50'
    class: `divide-y divide-gray-200 bg-white odd:bg-gray-50 ${className}`,
  }, [children, endMarkerRow].filter(Boolean));
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
    class: `px-3 md:px-4 lg:px-6 py-3 text-left text-[11px] md:text-xs font-medium text-gray-600 uppercase tracking-wider bg-white ${className}`,
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
    class: `whitespace-nowrap px-3 md:px-4 lg:px-6 py-2 text-sm text-gray-900 ${className}`
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