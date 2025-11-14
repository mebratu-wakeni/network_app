const { Row } = Liteframe;
import { Table, TableHeader, TableBody, TableRow, TableHCell, TableDCell, TableFooter} from './Table';

// --- Conceptual Pagination Component ---
const Pagination = (props) => {
  const { currentPage = 1, totalPages = 1, onPageChange } = props;

  // Simple button render for previous/next
  const prevButton = Row({
    tagType: 'button',
    class: `px-3 py-1 text-sm rounded-md border ${currentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-indigo-600 border-gray-300 hover:bg-gray-50'}`,
    attributes: { disabled: currentPage === 1 ? 'disabled' : null },
    events: { 'click': () => onPageChange(currentPage - 1) }
  }, 'Previous');

  const nextButton = Row({
    tagType: 'button',
    class: `px-3 py-1 text-sm rounded-md border ${currentPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-indigo-600 border-gray-300 hover:bg-gray-50'}`,
    attributes: { disabled: currentPage === totalPages ? 'disabled' : null },
    events: { 'click': () => onPageChange(currentPage + 1) }
  }, 'Next');

  return Row({
    tagType: 'div',
    class: 'flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6'
  }, [
    Row({ tagType: 'div', class: 'flex-1 flex justify-between sm:hidden' }, [prevButton, nextButton]),
    Row({ tagType: 'div', class: 'hidden sm:flex-1 sm:flex sm:items-center sm:justify-between' }, [
      Row({ tagType: 'div' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-700' }, `Page ${currentPage} of ${totalPages}`)
      ]),
      Row({ tagType: 'div' }, [
        Row({ tagType: 'nav', class: 'relative z-0 inline-flex -space-x-px rounded-md shadow-sm', attributes: { 'aria-label': 'Pagination' } }, [
          prevButton,
          // You could add page numbers here for more advanced pagination
          nextButton
        ])
      ])
    ])
  ]);
};

// --- Conceptual State Management ---
// In your Liteframe, this would be reactive state
let tableState = {
  products: [
    { id: 1, name: 'Wireless Headphones', category: 'Electronics', price: 99.99, stock: 150 },
    { id: 2, name: 'Ergonomic Keyboard', category: 'Accessories', price: 75.00, stock: 80 },
    { id: 3, name: '4K Monitor 27"', category: 'Electronics', price: 349.99, stock: 60 },
    { id: 4, name: 'Gaming Mouse', category: 'Peripherals', price: 50.00, stock: 200 },
    { id: 5, name: 'USB-C Hub', category: 'Accessories', price: 30.00, stock: 120 },
    { id: 6, name: 'External SSD 1TB', category: 'Storage', price: 120.00, stock: 90 },
    { id: 7, name: 'Webcam HD', category: 'Peripherals', price: 65.00, stock: 110 },
    { id: 8, name: 'Standing Desk', category: 'Furniture', price: 299.99, stock: 40 },
    { id: 9, name: 'Smartwatch', category: 'Wearables', price: 199.99, stock: 70 },
    { id: 10, name: 'Portable Speaker', category: 'Audio', price: 45.00, stock: 180 },
  ],
  currentPage: 1,
  itemsPerPage: 5,
};

// --- Conceptual State Update Function ---
const updateTableState = (newState) => {
  Object.assign(tableState, newState);
  // In a real Liteframe, this would trigger a re-render of components subscribed to tableState.
  console.log("Table State Updated:", tableState);
  // You would typically call a Liteframe's render function here
  // e.g., Liteframe.render(document.getElementById('app'), ProductsTable());
};

// --- ProductsTable Component (Composer) ---
const ProductsTable = () => {
  const { products, currentPage, itemsPerPage } = tableState;

  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      updateTableState({ currentPage: newPage });
    }
  };

  return Row({ tagType: 'div', class: 'mx-auto mt-10 p-4 bg-gray-100 rounded-lg' }, [
    Row({ tagType: 'h1', class: 'text-2xl font-bold text-gray-800 mb-6' }, 'Product Inventory'),

    Table({ class: 'my-6' }, [
      TableHeader({}, [
        TableRow({}, [
          TableHCell({}, 'Product Name'),
          TableHCell({}, 'Category'),
          TableHCell({ class: 'text-right' }, 'Price'),
          TableHCell({ class: 'text-center' }, 'Stock'),
          TableHCell({ class: 'sr-only' }, 'Actions'), // Screen reader only for action column
        ])
      ]),
      TableBody({},
        currentProducts.length > 0
          ? currentProducts.map(product =>
            TableRow({ class: 'hover:bg-gray-100' }, [
              TableDCell({}, product.name),
              TableDCell({}, product.category),
              TableDCell({ class: 'text-right' }, `$${product.price.toFixed(2)}`),
              TableDCell({ class: 'text-center' }, product.stock),
              TableDCell({ class: 'text-right text-sm font-medium' }, [
                Row({ tagType: 'a', class: 'text-indigo-600 hover:text-indigo-900 mr-4', attributes: { href: '#' } }, 'Edit'),
                Row({ tagType: 'a', class: 'text-red-600 hover:text-red-900', attributes: { href: '#' } }, 'Delete'),
              ]),
            ])
          )
          : TableRow({}, [
            TableDCell({ attributes: { colspan: 5 }, class: 'text-center text-gray-500 py-4' }, 'No products found.')
          ])
      ),
      TableFooter({}, [
        TableRow({}, [
          TableDCell({ attributes: { colspan: 5 }, class: 'p-0 border-none' }, [
            // Embed the Pagination component here
            Pagination({
              currentPage: currentPage,
              totalPages: totalPages,
              onPageChange: handlePageChange,
            })
          ])
        ])
      ])
    ])
  ]);
};

// --- How you would "mount" or render this in your Liteframe ---
// const appRoot = document.getElementById('app');
// if (appRoot) {
//     // Assuming Liteframe.render takes a DOM element and the component's output
//     Liteframe.render(appRoot, ProductsTable());
// }

export default ProductsTable;