import { ActionDropdown, ActionItem } from '../../../utils/Action';
import { DropdownSearch, DropdownSearchItem } from '../../../utils/DropdownSearch';
import { ManageDSOutsideClick, ManageOutsideClick } from '../../../utils/OutsideClick';
import { CardHeader } from '../../../utils/Card';
import { Button } from '../../../utils/Button';
import { Input } from '../../../utils/Input';
import { SelectFluid, SelectOptions, SelectRelative } from '../../../utils/Select';
import { IconButton } from '../../../utils/Icon';
import { IonIcon } from '../../../utils/Icon';
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../../utils/Table';
import Drawer from '../../../shared/ExampleDrawer';
import Modal from '../../../shared/Modal';
import ImportModalContent from '../ImportStockModal';
import BorrowFromModalContent from '../BorrowFromModal';
import { showAlert, showConfirmation } from '../../../utils/ModalHelpers';
import { permissionChecker } from '../../../utils/PermissionChecker';
import { formatDateDDMMYYYY, toDateInputValue } from '../../../utils/DateUtils';

const { Row } = Liteframe;

let cleanupOutsideClick;

export function Stock(props) {
  return StockUI(props);
}

function StockUI(props) {
  // Get data from viewModel state (not local state)
  const loading = props.viewModel.getState('loading');
  const stockList = props.viewModel.getStockList();
  const stockStats = props.viewModel.getStockStats();
  const stockListState = props.viewModel.getState('stock-list');
  const selectedFilter = stockListState?.filter || 'all';
  const searchQuery = stockListState?.search || '';
  
  // Get drawer state from viewModel
  const selectedStockItem = props.viewModel.getState('selected-stock-item');
  const stockDrawerType = props.viewModel.getState('stock-drawer-type');
  const stockDrawerOpen = props.viewModel.getState('stock-drawer-open');
  
  // Local state only for UI concerns (view mode, cards visibility, selected row highlighting)
  props.ensureLocalStateKey('show-cards', true);
  props.ensureLocalStateKey('view-mode', 'cards'); // 'cards' or 'table'
  
  const showCards = props.getLocalState('show-cards');
  const viewMode = props.getLocalState('view-mode');

  const toggleCards = () => {
    props.setLocalState('show-cards', !props.getLocalState('show-cards'));
  }

  const handleFilterClick = (filterKey) => {
    props.viewModel.updateStockFilter(filterKey);
    props.setLocalState('view-mode', 'table'); // Switch to table view when filtering
    // Load stock with new filter
    props.viewModel.loadStock();
  }

  // Local state for search input value and debouncing
  props.ensureLocalStateKey('searchInputValue', '');
  props.ensureLocalStateKey('searchTimeout', null);
  props.ensureLocalStateKey('searchInputValueInitialized', false);
  
  const searchInputValue = props.getLocalState('searchInputValue') || '';
  const searchInputValueInitialized = props.getLocalState('searchInputValueInitialized');

  const handleSearchFocusIn = () => {
    props.setLocalState('searchInputValue', searchQuery || '');
    props.setLocalState('searchInputValueInitialized', true);
  }

  const handleSearchFocusOut = () => {
    props.setLocalState('searchInputValueInitialized', false);
  }

  const handleSearchChange = (e) => {
    const newQuery = e.target.value;
    
    // Update local state immediately for input value (single re-render)
    props.setLocalState('searchInputValue', newQuery);
    
    // Clear existing timeout
    const existingTimeout = props.getLocalState('searchTimeout');
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // If search is cleared, update ViewModel and reload immediately
    if (!newQuery || newQuery.trim() === '') {
      props.viewModel.updateStockSearchQuery('');
      props.viewModel.loadStock();
      props.setLocalState('searchTimeout', null);
      return;
    }
    
    // Debounce: wait 500ms after user stops typing before updating ViewModel and searching
    // Defer ViewModel updates (which trigger 2 updateState calls) to avoid complex re-renders during typing
    // This prevents input from losing focus while user is actively typing
    const timeout = setTimeout(() => {
      props.viewModel.updateStockSearchQuery(newQuery);
      props.viewModel.loadStock();
      props.setLocalState('searchTimeout', null);
    }, 500);

    props.setLocalState('searchTimeout', timeout);
  }

  // Get stock statistics from viewModel state
  const stats = stockStats || {};
  const stockStatsArray = [
    { 
      key: 'all', 
      title: 'Total Stock', 
      icon: 'cube-outline', 
      value: (stats.total || 0).toLocaleString(), 
      subtitle: 'Total items in warehouse',
      color: 'text-indigo-600', 
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      hoverBg: 'hover:bg-indigo-100',
      // Primary, secondary, and tertiary stats for Total Stock card
      primary: stats.totalCost ? `Br ${(stats.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
      secondary: stats.itemsWithStock ? `${(stats.itemsWithStock || 0).toLocaleString()} in-stock items` : null,
      tertiary: stats.totalQuantity ? `${(stats.totalQuantity || 0).toLocaleString()} total qty` : null
    },
    { 
      key: 'expiring-soon', 
      title: 'Expiring Soon', 
      icon: 'time-outline', 
      value: (stats.expiringSoon || 0).toLocaleString(), 
      subtitle: 'Expires within product-specific threshold',
      color: 'text-yellow-600', 
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      hoverBg: 'hover:bg-yellow-100'
    },
    { 
      key: 'expired', 
      title: 'Expired', 
      icon: 'ban-outline', 
      value: (stats.expired || 0).toLocaleString(), 
      subtitle: 'Past expiration date',
      color: 'text-red-700', 
      bgColor: 'bg-red-100',
      borderColor: 'border-red-300',
      hoverBg: 'hover:bg-red-200'
    },
    { 
      key: 'borrowed-from', 
      title: 'Borrowed From', 
      icon: 'arrow-down-outline', 
      value: (stats.borrowedFrom || 0).toLocaleString(), 
      subtitle: 'Items received from partners',
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      hoverBg: 'hover:bg-blue-100'
    },
    { 
      key: 'borrowed-to', 
      title: 'Borrowed To', 
      icon: 'arrow-up-outline', 
      value: (stats.borrowedTo || 0).toLocaleString(), 
      subtitle: 'Items given to partners',
      color: 'text-purple-600', 
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      hoverBg: 'hover:bg-purple-100'
    },
    { 
      key: 'high-value', 
      title: 'High Value', 
      icon: 'diamond-outline', 
      value: (stats.highValue || 0).toLocaleString(), 
      subtitle: 'Unit cost above Br 1,000',
      color: 'text-emerald-600', 
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      hoverBg: 'hover:bg-emerald-100'
    },
  ];

  return Row({ class: 'w-full flex-1 flex flex-col overflow-hidden' }, [
    // Header Section with Actions
    Row({ class: 'flex items-center justify-between gap-6 px-4 py-2 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-4' }, [
        Button({ 
          variant: 'primary', 
          class: 'text-nowrap flex items-center gap-2',
          onClick: async () => {
            await openBorrowFromModal(props);
          },
          delegator: props.delegator
        }, [
          IonIcon({ name: 'arrow-down-outline', class: 'text-lg text-white font-bold' }),
          'Borrow From'
        ]),
        Button({ 
          variant: 'outline', 
          class: 'text-nowrap flex items-center gap-2',
          onClick: () => openImportStockModal(props),
          delegator: props.delegator
        }, [
          IonIcon({ name: 'cloud-upload-outline', class: 'text-lg text-white font-bold' }),
          'Import Stock'
        ]),
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Button({ 
          variant: 'secondary', 
          class: 'text-nowrap flex items-center gap-2',
          onClick: async () => {
            const hasPermission = await permissionChecker.checkPermission('CanSeeStockItemDetails', {
              actionName: 'export stock'
            });
            if (hasPermission) {
              handleExportCSV(props);
            }
          }
        }, [
          IonIcon({ name: 'download-outline', class: 'text-lg font-bold' }),
          'Export CSV'
        ]),
        IconButton({ 
          onClick: toggleCards,
          class: 'text-gray-600',
          size: 'medium'
        }, [
          IonIcon({ name: showCards ? 'chevron-up-outline' : 'chevron-down-outline' })
        ])
      ])
    ]),

    // Stats Cards Section
    showCards && Row({ class: 'w-full p-6 pb-4' }, [
      Row({ class: 'flex items-center justify-between mb-4' }, [
        Row({ class: 'text-lg font-semibold text-gray-800' }, 'Stock Overview'),
        // Row({ class: 'flex items-center gap-2' }, [
        //   IconButton({ 
        //     onClick: () => props.setLocalState('view-mode', 'cards'),
        //     class: viewMode === 'cards' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400',
        //     size: 'medium'
        //   }, [
        //     IonIcon({ name: 'grid-outline' })
        //   ]),
        //   IconButton({ 
        //     onClick: () => props.setLocalState('view-mode', 'table'),
        //     class: viewMode === 'table' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400',
        //     size: 'medium'
        //   }, [
        //     IonIcon({ name: 'list-outline' })
        //   ])
        // ])
      ]),
      Row({ class: 'w-full grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3' }, 
        stockStatsArray.map(stat => 
          StockCard({
            ...stat,
            isSelected: selectedFilter === stat.key,
            onClick: () => handleFilterClick(stat.key)
          })
        )
      )
    ]),

    // Row 1: Filters only (Out of stock / Low stock moved to Products tab)
    Row({ class: 'flex items-center gap-2 flex-wrap px-6 py-2 border-b border-gray-200 bg-gray-50' }, [
      Row({ tagType: 'span', class: 'text-xs text-gray-600' }, 'Filter:'),
      Button({ variant: selectedFilter === 'all' ? 'primary' : 'outline', class: 'text-xs py-0.5 px-2 min-h-0', onClick: () => handleFilterClick('all') }, 'All'),
      Button({ variant: selectedFilter === 'expiring-soon' ? 'primary' : 'outline', class: 'text-xs py-0.5 px-2 min-h-0', onClick: () => handleFilterClick('expiring-soon') }, 'Expiring Soon'),
      Button({ variant: selectedFilter === 'expired' ? 'primary' : 'outline', class: 'text-xs py-0.5 px-2 min-h-0', onClick: () => handleFilterClick('expired') }, 'Expired'),
      Button({ variant: selectedFilter === 'borrowed-from' ? 'primary' : 'outline', class: 'text-xs py-0.5 px-2 min-h-0', onClick: () => handleFilterClick('borrowed-from') }, 'Borrowed From'),
      Button({ variant: selectedFilter === 'borrowed-to' ? 'primary' : 'outline', class: 'text-xs py-0.5 px-2 min-h-0', onClick: () => handleFilterClick('borrowed-to') }, 'Borrowed To'),
      Button({ variant: selectedFilter === 'high-value' ? 'primary' : 'outline', class: 'text-xs py-0.5 px-2 min-h-0', onClick: () => handleFilterClick('high-value') }, 'High Value'),
    ]),

    // Row 2: Search + Pagination (flex)
    StockSearchAndPaginationRow(props, { searchInputValue, handleSearchChange, handleSearchFocusIn, handleSearchFocusOut }),

    // Stock Table Section
    StockTable({ 
      filter: selectedFilter,
      searchQuery: searchQuery,
      stockList: stockList,
      loading: loading,
      ...props 
    }),

    

    // Drawers
    stockDrawerType && selectedStockItem && StockDrawers({
      drawerType: stockDrawerType,
      stockItem: selectedStockItem,
      showSlide: stockDrawerOpen,
      onClose: () => props.viewModel.closeStockDrawer(),
      ...props
    })
  ])
}

function StockCard({ 
  key, 
  title, 
  icon, 
  value, 
  subtitle, 
  color, 
  bgColor, 
  borderColor, 
  hoverBg,
  isSelected,
  onClick,
  primary,
  secondary,
  tertiary
}) {
  const selectedClasses = isSelected 
    ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-md scale-105' 
    : '';
  
  // If primary, secondary, tertiary are provided, show multi-line stats
  const hasMultiStats = primary || secondary || tertiary;
  
  return Row({ 
    class: `flex flex-col gap-2 p-3 rounded-lg border ${bgColor} ${borderColor} ${hoverBg} ${color} cursor-pointer transition-all duration-200 ${selectedClasses}`,
    events: onClick ? { click: onClick } : {}
  }, [
    Row({ class: 'flex items-center justify-between' }, [
      Row({ class: 'text-xs font-medium opacity-80 truncate flex-1' }, title),
      IonIcon({ 
        name: icon, 
        class: `text-xl opacity-80 ${color ? color : 'text-indigo-600'} flex-shrink-0 ml-2` 
      })
    ]),
    hasMultiStats ? Row({ class: 'flex flex-col gap-1.5' }, [
      // Primary stat (Total Value)
      primary && Row({ class: 'flex items-baseline gap-1' }, [
        Row({ class: 'text-lg font-bold' }, primary),
      ]),
      // Secondary stat (In-stock items)
      secondary && Row({ class: 'flex items-baseline gap-1' }, [
        Row({ class: 'text-sm font-medium opacity-90' }, secondary),
      ]),
      // Tertiary stat (Total quantity)
      tertiary && Row({ class: 'flex items-baseline gap-1' }, [
        Row({ class: 'text-xs opacity-80' }, tertiary),
      ]),
    ]) : Row({ class: 'flex items-baseline gap-1' }, [
      Row({ class: 'text-xl font-bold' }, value),
      Row({ class: 'text-xs opacity-70' }, 'items')
    ]),
    Row({ class: 'text-xs opacity-70 leading-tight line-clamp-2' }, subtitle)
  ])
}

function StockSearchAndPaginationRow(props, { searchInputValue, handleSearchChange, handleSearchFocusIn, handleSearchFocusOut }) {
  const stockListState = props.viewModel.getState('stock-list');
  const tableConfig = stockListState?.config || { limit: 10, offset: 0, sortBy: 'id', orderBy: 'desc' };
  const totalCount = stockListState?.total || 0;
  const paginationOffset = tableConfig.offset || 0;
  const paginationLimit = tableConfig.limit || 25;
  const totalItems = totalCount;
  const initRow = totalItems > 0 ? paginationOffset + 1 : 0;
  const endRow = totalItems > 0 ? Math.min(paginationOffset + paginationLimit, totalItems) : 0;
  return Row({ class: 'flex items-center justify-between gap-4 px-6 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0' }, [
    Row({ class: 'flex-1 min-w-[200px] max-w-md' }, [
      Row({ class: 'relative' }, [
        IonIcon({ name: 'search-outline', class: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl pointer-events-none' }),
        Input({
          placeholder: 'Search stock by product code, name, or location...',
          class: 'pl-10 pr-4 w-full',
          value: searchInputValue,
          onInput: handleSearchChange,
          focusIn: handleSearchFocusIn,
          focusOut: handleSearchFocusOut,
          name: 'stock-search'
        })
      ])
    ]),
    Row({ class: 'flex items-center gap-4' }, [
      Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 'Rows per page'),
      SelectRelative({
        name: 'limit',
        onChange: (e) => {
          props.viewModel.setStockLimit(parseInt(e.target.value, 10));
          props.viewModel.loadStock();
        },
        value: paginationLimit
      }, SelectOptions({ options: ['10', '25', '50', '100'], selectedOption: String(paginationLimit) })),
      Row({ tagType: 'p', class: 'text-gray-400' }, '|'),
      Row({ class: 'inline-flex items-center gap-1' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, totalItems > 0 ? `${initRow}-${endRow} of ${totalItems}` : '0-0 of 0'),
        IconButton({
          onClick: () => { props.viewModel.previousStockPage(); props.viewModel.loadStock(); },
          disabled: paginationOffset === 0
        }, [IonIcon({ name: 'caret-back-outline' })]),
        IconButton({
          onClick: () => { props.viewModel.nextStockPage(); props.viewModel.loadStock(); },
          disabled: paginationOffset + paginationLimit >= totalItems
        }, [IonIcon({ name: 'caret-forward-outline' })])
      ])
    ])
  ]);
}

function StockTable({ filter, searchQuery, stockList = [], loading = false, ...props }) {
  // Get pagination from viewModel state (not local state)
  const stockListState = props.viewModel.getState('stock-list');
  const tableConfig = stockListState?.config || { limit: 10, offset: 0, sortBy: 'id', orderBy: 'desc' };
  const totalCount = stockListState?.total || 0;
  
  const paginationOffset = tableConfig.offset || 0;
  const paginationLimit = tableConfig.limit || 25;
  
  // Threshold for high-value filter (unit cost >= this)
  const HIGH_VALUE_THRESHOLD = 1000;

  // Use stockList from viewModel (real data from API)
  const stockItems = stockList || [];

  props.ensureLocalStateKey('actionId', null);
  props.ensureLocalStateKey('selectedRowId', null);
  const selectedRowId = props.getLocalState('selectedRowId');
  const actionId = props.getLocalState('actionId');


  // Helper function to check if date is within product-specific threshold
  const isExpiringSoon = (expiryDate, expiryThreshold = 30) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry >= 0 && daysUntilExpiry <= expiryThreshold;
  };

  // Helper function to check if date is expired (null/undefined expiry = not expired, exclude from filter)
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  // Helper function to calculate total value of an item
  const getTotalValue = (item) => {
    return (item.quantity || 0) * (item.unitCost || 0);
  };

  // Helper function to check if item is high value (based on unit cost)
  const isHighValue = (item) => {
    return (item.unitCost || 0) >= HIGH_VALUE_THRESHOLD;
  };

  const filteredItems = (filter === 'borrowed-from' || filter === 'borrowed-to')
    ? stockItems
    : stockItems.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'expiring-soon') {
          const expiryThreshold = item.expiry_threshold || item.product?.expiry_threshold || 30;
          return isExpiringSoon(item.expiryDate, expiryThreshold);
        }
        if (filter === 'expired') return isExpired(item.expiryDate);
        if (filter === 'high-value') return isHighValue(item);
        return item.status === filter;
      });

  // Search filter (null-safe; partnerName for borrow tables)
  const searchedItems = filteredItems.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const match = (s) => (s != null && String(s).toLowerCase().includes(q));
    if (match(item.productCode) || match(item.name)) return true;
    if (match(item.location)) return true;
    if (match(item.partnerName)) return true;
    return false;
  });

  // Pagination calculations
  // Use totalCount from viewModel if available, otherwise use filtered/searched items length
  const totalItems = stockList.length > 0 ? totalCount : searchedItems.length;
  const totalPages = Math.ceil(totalItems / paginationLimit);
  const currentPage = Math.floor(paginationOffset / paginationLimit) + 1;
  const initRow = paginationOffset + 1;
  let endRow = paginationOffset + paginationLimit;
  if (endRow > totalItems) endRow = totalItems;

  // Paginated items
  // If using viewModel data, items are already paginated by backend
  // Otherwise, do client-side pagination as fallback
  const paginatedItems = stockList.length > 0 
    ? stockList 
    : searchedItems.slice(paginationOffset, paginationOffset + paginationLimit);

  // Pagination handlers - use viewModel methods
  const handleSetLimit = (newLimit) => {
    props.viewModel.setStockLimit(newLimit);
    props.viewModel.loadStock(); // Reload data with new limit
  };

  const handlePreviousPage = () => {
    props.viewModel.previousStockPage();
    props.viewModel.loadStock(); // Reload data for previous page
  };

  const handleNextPage = () => {
    props.viewModel.nextStockPage();
    props.viewModel.loadStock(); // Reload data for next page
  };

  // Status badge for Stock tab: only borrowed and expiry badges; no "In Stock" / low / out-of-stock (those are on Products)
  const badgeClass = 'w-fit inline-flex px-2 py-1 rounded-full text-xs font-medium';
  const getStatusBadge = (status, expiryDate, item = null) => {
    if (status === 'borrowed-from') {
      return Row({ class: `${badgeClass} bg-blue-100 text-blue-700` }, 'Borrowed From');
    }
    if (status === 'borrowed-to') {
      return Row({ class: `${badgeClass} bg-purple-100 text-purple-700` }, 'Borrowed To');
    }
    if (isExpired(expiryDate)) {
      return Row({ class: `${badgeClass} bg-red-200 text-red-800` }, 'Expired');
    }
    const expiryThreshold = item?.expiry_threshold || item?.product?.expiry_threshold || 30;
    if (isExpiringSoon(expiryDate, expiryThreshold)) {
      return Row({ class: `${badgeClass} bg-yellow-100 text-yellow-700` }, 'Expiring Soon');
    }
    return null;
  };

  // Table type: inventories | borrow_from | borrow_to (out-of-stock / low-stock filters moved to Products tab)
  const tableType = filter === 'borrowed-from' ? 'borrow_from' : filter === 'borrowed-to' ? 'borrow_to' : 'inventories';

  // Sort icon helper function
  const sortIcon = (column) => {
    const stockListState = props.viewModel.getState('stock-list');
    const tableConfig = stockListState?.config || { sortBy: 'id', orderBy: 'desc' };
    const orderBy = tableConfig.orderBy;
    const sortBy = tableConfig.sortBy;
    if (column === sortBy) {
      return IonIcon({ name: `${orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline'}`, class: 'text-xs ml-2 font-semibold' });
    }
    return false;
  };

  return Row({ class: 'flex-1 flex flex-col overflow-hidden min-h-0' }, [
    // Stock Table (search + pagination are in parent row)
    Row({ class: 'flex-1 flex flex-col overflow-hidden min-h-0 pb-6' }, [
      Row({ class: 'px-4 py-2 text-sm text-gray-500 border-b border-gray-100' }, 
        tableType === 'inventories' ? 'Showing: Inventories' : 
        tableType === 'borrow_from' ? 'Showing: Borrowed From (borrow_from_inventories)' : 
        'Showing: Borrowed To (borrow_to_inventories)'
      ),
      Table({ 
        class: 'flex-1 flex flex-col min-h-0', 
      }, [
      TableHeader({ class: 'sticky top-0 z-10 bg-white' }, [
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('product_code') }, ['Product Code', sortIcon('product_code')]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('name') }, ['Product Name', sortIcon('name')]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('category') }, ['Category', sortIcon('category')]),
        tableType === 'inventories'
          ? TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('location') }, ['Location', sortIcon('location')])
          : TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Partner'),
        TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('quantity') }, [
          tableType === 'inventories' ? 'Quantity' : (tableType === 'borrow_from' || tableType === 'borrow_to') ? 'Remaining' : 'Qty Lent',
          sortIcon('quantity')
        ]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('unit') }, ['Unit', sortIcon('unit')]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('expiry_date') }, ['Expiry Date', sortIcon('expiry_date')]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Status'),
        TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Action')
      ]),
      TableBody({ class: 'flex-1 overflow-y-auto bg-white' }, 
        paginatedItems.length === 0 
          ? TableRow({}, [
              TableDCell({ 
                class: 'px-4 py-8 text-center text-sm text-gray-500', 
                attributes: { colspan: 9 } 
              }, 'No stock items found')
            ])
          : paginatedItems.map(item => 
                TableRow({ 
                  class: `transition-colors duration-150 cursor-pointer ${selectedRowId === item.id ? 'bg-blue-50 border-l-2 border-indigo-500' : ''} hover:bg-blue-50` 
                }, [
                  TableDCell({ class: 'px-4 py-3 text-sm font-medium text-gray-900' }, item.productCode ?? ''),
                  TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, item.name ?? ''),
                  TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, item.category ?? ''),
                  TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, tableType === 'inventories' ? (item.location ?? '—') : (item.partnerName ?? '—')),
                  TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right font-medium' }, 
                    (tableType === 'borrow_from' || tableType === 'borrow_to') && item.remaining !== undefined ? (item.remaining ?? 0).toLocaleString() : (item.quantity ?? 0).toLocaleString()
                  ),
                  TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, item.unit ?? ''),
                  TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, formatDateDDMMYYYY(item.expiryDate)),
                  TableDCell({ class: 'px-4 py-3 text-sm' }, getStatusBadge(item.status, item.expiryDate, item)),
                  ActionDropdown({
                    actionId: item.id,
                    open: item.id === actionId,
                    class: 'text-center px-4 py-3',
                    onToggle: () => props.setLocalState('actionId', actionId === item.id ? null : item.id)
                  }, [
                    ActionItem({ label: 'View Details', icon: 'eye-outline', onClick: async () => {
                      const hasPermission = await permissionChecker.checkPermission('CanSeeStockItemDetails', { actionName: 'view stock details' });
                      if (hasPermission) { props.viewModel.openStockDrawer(item, 'view-details'); props.setLocalState('actionId', null); } else { props.setLocalState('actionId', null); }
                    } }),
                    (item.status === 'borrowed-from' || item.borrowFromId || filter === 'borrowed-from') && item.borrowStatus !== 'returned' && ActionItem({ label: 'Return Borrowed From', icon: 'return-down-back-outline', onClick: async () => {
                      const hasPermission = await permissionChecker.checkPermission('CanReturnBorrowedFromStock', { actionName: 'return borrowed from items' });
                      if (hasPermission) { props.viewModel.openStockDrawer(item, 'return-borrowed'); props.setLocalState('actionId', null); } else { props.setLocalState('actionId', null); }
                    } }),
                    (item.status === 'borrowed-to' || item.borrowToId || filter === 'borrowed-to') && item.borrowStatus !== 'returned' && ActionItem({ label: 'Return Borrowed To', icon: 'return-up-forward-outline', onClick: async () => {
                      const hasPermission = await permissionChecker.checkPermission('CanReturnBorrowedToStock', { actionName: 'return borrowed to items' });
                      if (hasPermission) { props.viewModel.openStockDrawer(item, 'return-borrowed-to'); props.setLocalState('actionId', null); } else { props.setLocalState('actionId', null); }
                    } }),
                    !(item.status === 'borrowed-from' || item.status === 'borrowed-to' || item.borrowFromId || item.borrowToId || filter === 'borrowed-from' || filter === 'borrowed-to') && ActionItem({ label: 'Adjust Stock', icon: 'create-outline', onClick: async () => {
                      const hasPermission = await permissionChecker.checkPermission('CanAdjustStockItemQuantities', { actionName: 'adjust stock quantities' });
                      if (hasPermission) { props.viewModel.openStockDrawer(item, 'adjust-stock'); props.setLocalState('actionId', null); } else { props.setLocalState('actionId', null); }
                    } }),
                    !(item.status === 'borrowed-from' || item.status === 'borrowed-to' || item.borrowFromId || item.borrowToId || filter === 'borrowed-from' || filter === 'borrowed-to') && ActionItem({ label: 'Transfer', icon: 'swap-horizontal-outline', onClick: async () => {
                      const hasPermission = await permissionChecker.checkPermission('CanTransferItemShelf', { actionName: 'transfer stock items' });
                      if (hasPermission) { props.viewModel.openStockDrawer(item, 'transfer'); props.setLocalState('actionId', null); } else { props.setLocalState('actionId', null); }
                    } })
                  ])
                ])
              )
      )
      ])
    ])
  ])
}

// Drawer Components
function StockDrawers({ drawerType, stockItem, showSlide, onClose, ...props }) {
  const drawerComponents = {
    'view-details': ViewDetailsDrawer,
    'adjust-stock': AdjustStockDrawer,
    'transfer': TransferStockDrawer,
    'return-borrowed': ReturnBorrowedDrawer,
    'return-borrowed-to': ReturnBorrowedToDrawer
  };

  const DrawerComponent = drawerComponents[drawerType];
  if (!DrawerComponent) return null;

  return DrawerComponent({ stockItem, showSlide, onClose, ...props });
}

// View Details Drawer
function ViewDetailsDrawer({ stockItem, showSlide, onClose, ...props }) {
  // Get form state from viewModel
  const stockDetailsForm = props.viewModel.getState('stock-details-form');
  const detailsEditMode = props.viewModel.getState('stock-details-edit-mode');
  const pricingEditMode = props.viewModel.getState('stock-pricing-edit-mode');
  
  // Check if this is a borrowed item (from borrow_from_inventories or borrow_to_inventories)
  const isBorrowedItem = stockItem.status === 'borrowed-from' || stockItem.status === 'borrowed-to' || 
                         stockItem.borrowFromId || stockItem.borrowToId;
  
  const inventoryCode = stockDetailsForm.inventoryCode || stockItem.inventoryCode || stockItem.id?.toString() || '';
  const productCode = stockDetailsForm.productCode || stockItem.productCode || '';
  const quantity = stockDetailsForm.quantity || stockItem.quantity || 0;
  const batchNo = stockDetailsForm.batchNo !== undefined ? stockDetailsForm.batchNo : (stockItem.batchNumber || stockItem.batchNo || '');
  // Use form value if it exists (even if empty string or null), otherwise fall back to stockItem
  const expiryDate = stockDetailsForm.expiryDate !== undefined ? stockDetailsForm.expiryDate : (stockItem.expiryDate || '');
  const unitCost = stockDetailsForm.unitCost !== undefined ? stockDetailsForm.unitCost : (stockItem.unitCost || 0);
  const sellingPrice = stockDetailsForm.sellingPrice !== undefined ? stockDetailsForm.sellingPrice : (stockItem.sellingPrice || 0);

  const getTotalValue = (item) => {
    const cost = detailsEditMode ? unitCost : (item.unitCost || 0);
    const qty = detailsEditMode ? quantity : (item.quantity || 0);
    return qty * cost;
  };

  const handleEditDetails = async () => {
    // Don't allow editing borrowed items - they are historical records
    if (isBorrowedItem) {
      return;
    }
    const hasPermission = await permissionChecker.checkPermission('CanEditStockItemDetails', {
      actionName: 'edit stock item details'
    });
    if (hasPermission) {
      props.viewModel.setStockDetailsEditMode(true);
    }
  };

  const handleEditPricing = async () => {
    // Don't allow editing pricing for borrowed items - they are historical records
    if (isBorrowedItem) {
      return;
    }
    const hasPermission = await permissionChecker.checkPermission('CanEditStockItemPrice', {
      actionName: 'edit selling price'
    });
    if (hasPermission) {
      props.viewModel.setStockPricingEditMode(true);
    }
  };

  const handleCancelDetails = () => {
    props.viewModel.setStockDetailsEditMode(false);
  };

  const handleCancelPricing = () => {
    props.viewModel.setStockPricingEditMode(false);
  };

  const handleSaveDetails = async () => {
    // Don't allow editing borrowed items - they are historical records
    if (isBorrowedItem) {
      return;
    }
    
    const hasPermission = await permissionChecker.checkPermission('CanEditStockItemDetails', {
      actionName: 'update stock item details'
    });
    if (!hasPermission) {
      return;
    }

    try {
      // Read fresh form state directly from ViewModel (don't use stale local variables)
      const currentForm = props.viewModel.getState('stock-details-form');
      
      // Get values from form state, fallback to stockItem if not in form
      const formBatchNo = currentForm.batchNo !== undefined ? currentForm.batchNo : (stockItem.batchNumber || stockItem.batchNo || '');
      const formExpiryDate = currentForm.expiryDate !== undefined ? currentForm.expiryDate : (stockItem.expiryDate || '');
      // For borrowed items, unitCost is read-only (crucial for ledger transactions)
      // Only allow editing unitCost for non-borrowed items
      const formUnitCost = isBorrowedItem ? (stockItem.unitCost || 0) : (currentForm.unitCost !== undefined ? currentForm.unitCost : (stockItem.unitCost || 0));
      const formInventoryCode = currentForm.inventoryCode || stockItem.inventoryCode || stockItem.id?.toString() || '';
      const formProductCode = currentForm.productCode || stockItem.productCode || '';
      
      // Normalize expiryDate: empty string becomes null, otherwise use the value
      const normalizedExpiryDate = (formExpiryDate === '' || formExpiryDate === null || formExpiryDate === undefined) ? null : formExpiryDate;
      
      console.log('[Stock.js] handleSaveDetails - Using fresh form state:', {
        currentForm: JSON.stringify(currentForm, null, 2),
        formExpiryDate,
        normalizedExpiryDate,
        formBatchNo,
        formUnitCost,
        isBorrowedItem,
        staleExpiryDate: expiryDate, // This is the stale value from render
        staleBatchNo: batchNo // This is the stale value from render
      });
      
      await props.viewModel.updateStock(stockItem.id, {
        inventoryCode: formInventoryCode,
        productCode: formProductCode, // Read-only, but included for completeness
        // quantity is NOT included - it's read-only and must be changed via Adjust Stock for data integrity
        batchNo: formBatchNo,
        expiryDate: normalizedExpiryDate,
        unitCost: formUnitCost // For borrowed items, this will be the original value (read-only)
        // Note: sellingPrice is NOT included here - it's saved separately via handleSavePricing
        // Note: inventoryCode, productCode, and quantity are system-managed/controlled fields
      });
      props.viewModel.setStockDetailsEditMode(false);
    } catch (error) {
      console.error('Error updating stock details:', error);
    }
  };

  const handleSavePricing = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanEditStockItemPrice', {
      actionName: 'update selling price'
    });
    if (!hasPermission) {
      return;
    }

    // Get the current form value to ensure we're using the latest
    const currentForm = props.viewModel.getState('stock-details-form');
    const priceToSave = currentForm.sellingPrice !== undefined ? currentForm.sellingPrice : sellingPrice;

    try {
      await props.viewModel.updateStock(stockItem.id, {
        sellingPrice: priceToSave
        // Only update selling price, other fields remain unchanged
      });
      props.viewModel.setStockPricingEditMode(false);
    } catch (error) {
      console.error('Error updating selling price:', error);
    }
  };

  return Drawer({ class: 'h-full overflow-y-auto flex flex-col', openSlide: showSlide }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: 'cube-outline', class: 'text-xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, 
          detailsEditMode ? 'Edit Stock Details' : 
          pricingEditMode ? 'Edit Pricing' : 
          'Stock Details'
        ),
      ]),
      IconButton({ onClick: onClose, size: 'medium', delegator: props.delegator }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Row({ class: 'flex flex-col gap-6 max-w-3xl' }, [
        // Product Information Section (Read-only)
        Row({ class: 'bg-gray-50 rounded-lg p-4 border border-gray-200' }, [
          Row({ class: 'text-sm font-semibold text-gray-700 mb-4' }, 'Product Information'),
          Row({ class: 'grid grid-cols-2 gap-4' }, [
            DetailField({ label: 'Product Code', value: productCode, editMode: false }),
            DetailField({ label: 'Product Name', value: stockItem.name, editMode: false }),
            DetailField({ label: 'Category', value: stockItem.category, editMode: false }),
            DetailField({ label: 'Unit', value: stockItem.unit, editMode: false }),
          ])
        ]),

        // Stock Information Section (Editable)
        Row({ class: 'bg-gray-50 rounded-lg p-4 border border-gray-200' }, [
          Row({ class: 'text-sm font-semibold text-gray-700 mb-4' }, 'Stock Information'),
          Row({ class: 'flex flex-col gap-6' }, [
            // Row 1: Inventory Code (full width, centered, read-only)
            Row({ class: 'flex justify-center' }, [
              Row({ class: 'w-full max-w-md' }, [
                DetailField({ 
                  label: 'Inventory Code', 
                  value: inventoryCode || '-',
                  editMode: false // Always read-only, system-assigned
                })
              ])
            ]),
            // Row 2: Quantity and Batch No (2 columns)
            Row({ class: 'grid grid-cols-2 gap-6' }, [
              DetailField({ 
                label: 'Quantity', 
                value: (quantity?.toLocaleString() || '0'),
                editMode: false // Read-only: quantity changes must go through Adjust Stock for data integrity
              }),
              DetailField({ 
                label: 'Batch No', 
                value: detailsEditMode && !isBorrowedItem ? null : (batchNo || '-'),
                editMode: detailsEditMode && !isBorrowedItem, // Editable for regular items, read-only for borrowed items
                inputProps: detailsEditMode && !isBorrowedItem ? {
                  value: batchNo || '',
                  onChange: (e) => props.viewModel.updateStockDetailsForm('batchNo', e.target.value),
                  name: 'stock-batch-no',
                  placeholder: 'Enter batch number',
                  delegator: props.delegator
                } : undefined
              })
            ]),
            // Row 3: Unit Cost and Selling Price (2 columns)
            Row({ class: 'grid grid-cols-2 gap-6' }, [
              DetailField({ 
                label: 'Unit Cost', 
                value: `Br ${(unitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                editMode: false, // Always read-only for borrowed items, and read-only in general (price is crucial for ledger)
                // Note: Unit cost is not editable for borrowed items as it's crucial for ledger transactions
              }),
              DetailField({ 
                label: 'Selling Price', 
                value: pricingEditMode ? null : `Br ${(sellingPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                editMode: pricingEditMode,
                inputProps: {
                  type: 'number',
                  step: '0.01',
                  min: 0,
                  value: stockDetailsForm.sellingPrice !== undefined ? stockDetailsForm.sellingPrice : (sellingPrice ?? 0),
                  onChange: (e) => {
                    const newValue = e.target.value === '' ? null : parseFloat(e.target.value);
                    props.viewModel.updateStockDetailsForm('sellingPrice', newValue !== null && !isNaN(newValue) ? newValue : null);
                  },
                  name: 'stock-selling-price',
                  placeholder: 'Enter selling price',
                  delegator: props.delegator
                }
              })
            ]),
            // Row 4: Expiry Date and Total Value (2 columns)
            Row({ class: 'grid grid-cols-2 gap-6' }, [
              DetailField({ 
                label: 'Expiry Date', 
                value: detailsEditMode && !isBorrowedItem ? null : formatDateDDMMYYYY(expiryDate),
                editMode: detailsEditMode && !isBorrowedItem, // Editable for regular items, read-only for borrowed items
                inputProps: detailsEditMode && !isBorrowedItem ? {
                  type: 'date',
                  value: toDateInputValue(expiryDate),
                  onChange: (e) => {
                    const newValue = e.target.value || null;
                    console.log('[Stock.js] Expiry date onChange:', {
                      targetValue: e.target.value,
                      newValue,
                      currentFormValue: stockDetailsForm.expiryDate
                    });
                    props.viewModel.updateStockDetailsForm('expiryDate', newValue);
                  },
                  placeholder: 'Select expiry date',
                  delegator: props.delegator
                } : undefined
              }),
              DetailField({ 
                label: 'Total Value', 
                value: `Br ${getTotalValue(stockItem).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                editMode: false // Calculated field, read-only
              })
            ]),
            // Row 5: Location and Status (2 columns, both read-only)
            Row({ class: 'grid grid-cols-2 gap-6' }, [
              DetailField({ label: 'Location', value: stockItem.location, editMode: false }),
              DetailField({ label: 'Status', value: getStatusText(stockItem), editMode: false })
            ])
          ])
        ]),

        // Borrowed From Information Section (if borrowed from)
        (stockItem.status === 'borrowed-from' || stockItem.status === 'borrowed') && Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'flex items-center justify-between mb-4' }, [
            Row({ class: 'text-sm font-semibold text-blue-800' }, 'Borrowed From Information'),
            // Status Badge
            stockItem.borrowStatus && Row({ 
              class: `px-3 py-1 rounded-full text-xs font-medium ${
                stockItem.borrowStatus === 'returned' 
                  ? 'bg-green-100 text-green-700' 
                  : stockItem.borrowStatus === 'partially_returned'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-blue-100 text-blue-700'
              }` 
            }, 
              stockItem.borrowStatus === 'returned' 
                ? 'Fully Returned' 
                : stockItem.borrowStatus === 'partially_returned'
                ? 'Partially Returned'
                : 'Active'
            )
          ]),
          Row({ class: 'grid grid-cols-2 gap-4' }, [
            DetailField({ label: 'Borrowed By', value: stockItem.borrowedBy || '-' }),
            DetailField({ label: 'Borrowed Date', value: stockItem.borrowedDate || '-' }),
            DetailField({ label: 'Borrowed Quantity', value: (stockItem.quantity || 0).toLocaleString() + ' ' + stockItem.unit }),
            // Show return status if available
            stockItem.totalReturned !== undefined && stockItem.remaining !== undefined && Row({ class: 'col-span-2' }, [
              Row({ class: 'grid grid-cols-3 gap-4' }, [
                DetailField({ label: 'Total Borrowed', value: `${(stockItem.totalBorrowed || stockItem.quantity || 0).toLocaleString()} ${stockItem.unit || ''}` }),
                DetailField({ label: 'Total Returned', value: `${(stockItem.totalReturned || 0).toLocaleString()} ${stockItem.unit || ''}` }),
                DetailField({ label: 'Remaining', value: `${(stockItem.remaining || 0).toLocaleString()} ${stockItem.unit || ''}` }),
              ])
            ])
          ])
        ]),
        // Borrowed To Information Section (if borrowed to)
        (stockItem.status === 'borrowed-to' || stockItem.borrowToId) && Row({ class: 'bg-purple-50 rounded-lg p-4 border border-purple-200' }, [
          Row({ class: 'flex items-center justify-between mb-4' }, [
            Row({ class: 'text-sm font-semibold text-purple-800' }, 'Borrowed To Information'),
            // Status Badge
            stockItem.borrowStatus && Row({ 
              class: `px-3 py-1 rounded-full text-xs font-medium ${
                stockItem.borrowStatus === 'returned' 
                  ? 'bg-green-100 text-green-700' 
                  : stockItem.borrowStatus === 'partially_returned'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-purple-100 text-purple-700'
              }` 
            }, 
              stockItem.borrowStatus === 'returned' 
                ? 'Fully Returned' 
                : stockItem.borrowStatus === 'partially_returned'
                ? 'Partially Returned'
                : 'Active'
            )
          ]),
          Row({ class: 'grid grid-cols-2 gap-4' }, [
            DetailField({ label: 'Partner', value: stockItem.partnerName || '-' }),
            DetailField({ label: 'Lent Date', value: stockItem.lentDate ? formatDateDDMMYYYY(stockItem.lentDate) : '-' }),
            DetailField({ label: 'Quantity Lent', value: (stockItem.quantity || 0).toLocaleString() + ' ' + stockItem.unit }),
            DetailField({ label: 'Unit Cost', value: stockItem.unitCost ? `Br ${stockItem.unitCost.toFixed(2)}` : '-' }),
            // Show return status if available
            stockItem.totalReturned !== undefined && stockItem.remaining !== undefined && Row({ class: 'col-span-2' }, [
              Row({ class: 'grid grid-cols-3 gap-4' }, [
                DetailField({ label: 'Total Lent', value: `${(stockItem.totalBorrowed || stockItem.quantity || 0).toLocaleString()} ${stockItem.unit || ''}` }),
                DetailField({ label: 'Total Returned', value: `${(stockItem.totalReturned || 0).toLocaleString()} ${stockItem.unit || ''}` }),
                DetailField({ label: 'Remaining', value: `${(stockItem.remaining || 0).toLocaleString()} ${stockItem.unit || ''}` }),
              ])
            ])
          ])
        ])
      ])
    ]),
    Row({ class: 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3' }, [
      detailsEditMode ? [
        Button({ variant: 'secondary', onClick: handleCancelDetails, delegator: props.delegator }, 'Cancel'),
        Button({ variant: 'primary', onClick: handleSaveDetails, delegator: props.delegator }, 'Save Details')
      ] : pricingEditMode ? [
        Button({ variant: 'secondary', onClick: handleCancelPricing, delegator: props.delegator }, 'Cancel'),
        Button({ variant: 'primary', onClick: handleSavePricing, delegator: props.delegator }, 'Save Price')
      ] : [
        Button({ variant: 'secondary', onClick: onClose, delegator: props.delegator }, 'Close'),
        // Hide edit buttons for borrowed items - they are read-only historical records
        !isBorrowedItem && Row({ class: 'flex items-center gap-2' }, [
          Button({ 
            variant: 'outline', 
            onClick: handleEditDetails,
            delegator: props.delegator,
            class: 'flex items-center gap-2'
          }, [
            IonIcon({ name: 'create-outline', class: 'text-lg' }),
            'Edit Details'
          ]),
          Button({ 
            variant: 'outline', 
            onClick: handleEditPricing,
            delegator: props.delegator,
            class: 'flex items-center gap-2'
          }, [
            IonIcon({ name: 'pricetag-outline', class: 'text-lg' }),
            'Edit Price'
          ])
        ])
      ]
    ])
  ])
}

// Adjust Stock Drawer
function AdjustStockDrawer({ stockItem, showSlide, onClose, ...props }) {
  // Get form state from viewModel
  const adjustStockForm = props.viewModel.getState('adjust-stock-form');
  const adjustmentType = adjustStockForm.adjustmentType || 'add';
  const adjustAmount = adjustStockForm.amount || 0;
  const adjustReason = adjustStockForm.reason || '';
  const adjustNotes = adjustStockForm.notes || '';
  const adjustmentDate = adjustStockForm.adjustmentDate || new Date().toISOString().split('T')[0];
  const partnerId = adjustStockForm.partnerId || null;
  const partnerSearchQuery = adjustStockForm.partnerSearchQuery || '';
  const showPartnerDropdown = adjustStockForm.showPartnerDropdown || false;
  
  // Get partner list for "Borrow To" dropdown
  // For borrow-to operations, we need all customers, not just suppliers
  // The drawer opening already triggers loadPartners('all'), but we check here as a fallback
  const partnerList = props.viewModel.getPartnerList() || [];
  const selectedPartner = partnerList.find(p => p.id === partnerId) || null;
  
  // Check if we have all customer types (supplier, retailer, both, other)
  // If not, reload with 'all' to ensure all customers are available for borrow-to
  const hasAllCustomerTypes = partnerList.some(p => 
    p.customer_type && ['retailer', 'both', 'other'].includes(p.customer_type)
  );
  
  // Reload with 'all' if we don't have all customer types (fallback check)
  // This ensures customers with type 'both', 'retailer', 'other' are available
  if (!hasAllCustomerTypes && partnerList.length > 0) {
    // List exists but doesn't have all types - reload with 'all'
    props.viewModel.loadPartners('all');
  } else if (partnerList.length === 0) {
    // If no partners loaded at all, load all customers
    props.viewModel.loadPartners('all');
  }
  
  // Filter partners based on search query
  const filteredPartners = partnerList.filter(partner => {
    if (partner.type !== 'partner') return false;
    if (!partnerSearchQuery) return true;
    const query = partnerSearchQuery.toLowerCase();
    return (partner.name || '').toLowerCase().includes(query) ||
           (partner.code || '').toLowerCase().includes(query);
  });

  // Current stock quantity
  const currentQuantity = stockItem.quantity || 0;

  // Calculate new quantity based on adjustment type
  const calculateNewQuantity = () => {
    if (adjustmentType === 'add') {
      return currentQuantity + adjustAmount;
    } else if (adjustmentType === 'subtract') {
      return Math.max(0, currentQuantity - adjustAmount);
    } else { // 'set'
      return adjustAmount;
    }
  };

  const newQuantity = calculateNewQuantity();
  const quantityDifference = newQuantity - currentQuantity;

  // Reason options filtered by adjustment type
  const getReasonOptions = (type) => {
    if (type === 'add') {
      // Reasons for adding stock: Found (discovered inventory), Transfer In (moved from another location), Receive Borrow To (receiving items back that were borrowed to partner), Correction (fixing errors)
      return ['Found', 'Transfer In', 'Receive Borrow To', 'Correction', 'Other'];
    } else if (type === 'subtract') {
      // Reasons for subtracting stock: Lost (misplaced), Damaged (broken/defective), Expired (past expiry date), Borrow To (giving items to partner temporarily), Correction (fixing errors)
      return ['Lost', 'Damaged', 'Expired', 'Borrow To', 'Correction', 'Other'];
    } else { // 'set'
      // Reasons for setting stock: Physical Count (manual count), Correction (fixing errors), Stock Take (periodic inventory count), Audit (official review)
      // Stock Take: A periodic physical inventory count process where you count all items in stock and set the quantity to match the actual count
      return ['Physical Count', 'Correction', 'Stock Take', 'Audit', 'Other'];
    }
  };

  const reasonOptions = getReasonOptions(adjustmentType);

  const handleSave = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanAdjustStockItemQuantities', {
      actionName: 'adjust stock quantities'
    });
    if (!hasPermission) {
      return;
    }

    // Validate: If "Borrow To" is selected, partner must be selected
    if (adjustReason === 'Borrow To' && !partnerId) {
      showAlert({
        title: 'Partner Required',
        message: 'Please select a partner for "Borrow To" adjustment',
        variant: 'warning',
        icon: 'warning-outline'
      });
      return;
    }
    
    try {
      await props.viewModel.adjustStock(stockItem.id, {
        adjustmentType,
        amount: adjustAmount,
        newQuantity,
        reason: adjustReason,
        notes: adjustNotes,
        adjustmentDate: adjustmentDate,
        partnerId: adjustReason === 'Borrow To' ? (partnerId ? Number(partnerId) : null) : null
      });
      props.viewModel.resetAdjustStockForm();
      onClose();
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

  const isValid = adjustAmount > 0 && adjustReason.trim() !== '' && adjustmentDate.trim() !== '' && (adjustReason !== 'Borrow To' || partnerId !== null);

  // Radio Button Component Helper using IonIcon
  const RadioButton = ({ name, value, label, checked, onChange }) => {
    return Row({ 
      class: 'flex items-center gap-2 cursor-pointer',
      events: {
        click: onChange
      },
      delegator: props.delegator
    }, [
      IonIcon({ 
        name: checked ? 'radio-button-on' : 'radio-button-off', 
        class: `text-xl ${checked ? 'text-indigo-600' : 'text-gray-400'}` 
      }),
      Row({ tagType: 'label', class: `text-sm ${checked ? 'text-gray-900 font-medium' : 'text-gray-600'} cursor-pointer` }, label)
    ]);
  };

  return Drawer({ class: 'h-full overflow-y-auto flex flex-col', openSlide: showSlide }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: 'create-outline', class: 'text-xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, 'Adjust Stock'),
      ]),
      IconButton({ onClick: onClose, size: 'medium', delegator: props.delegator }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Row({ class: 'flex flex-col gap-6 max-w-2xl' }, [
        // Current Stock Info
        Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'text-sm font-semibold text-blue-800 mb-3' }, 'Current Stock Information'),
          Row({ class: 'grid grid-cols-2 gap-4' }, [
            DetailField({ label: 'Product', value: stockItem.name }),
            DetailField({ label: 'Current Quantity', value: (stockItem.quantity || 0).toLocaleString() }),
            DetailField({ label: 'Location', value: stockItem.location }),
            DetailField({ label: 'Unit', value: stockItem.unit }),
          ])
        ]),

        // Adjustment Form
        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Adjustment Type:'),
          right: Row({ class: 'flex gap-6' }, [
            RadioButton({
              name: 'adjustment-type',
              value: 'add',
              label: 'Add',
              checked: adjustmentType === 'add',
              onChange: (e) => {
                props.viewModel.updateAdjustStockForm('adjustmentType', 'add');
                // Check if current reason is valid for new type, if not clear it
                const newReasons = getReasonOptions('add');
                if (adjustReason && !newReasons.includes(adjustReason)) {
                  props.viewModel.updateAdjustStockForm('reason', '');
                }
              }
            }),
            RadioButton({
              name: 'adjustment-type',
              value: 'subtract',
              label: 'Subtract',
              checked: adjustmentType === 'subtract',
              onChange: (e) => {
                props.viewModel.updateAdjustStockForm('adjustmentType', 'subtract');
                // Check if current reason is valid for new type, if not clear it
                const newReasons = getReasonOptions('subtract');
                if (adjustReason && !newReasons.includes(adjustReason)) {
                  props.viewModel.updateAdjustStockForm('reason', '');
                }
              }
            }),
            RadioButton({
              name: 'adjustment-type',
              value: 'set',
              label: 'Set',
              checked: adjustmentType === 'set',
              onChange: (e) => {
                props.viewModel.updateAdjustStockForm('adjustmentType', 'set');
                // Check if current reason is valid for new type, if not clear it
                const newReasons = getReasonOptions('set');
                if (adjustReason && !newReasons.includes(adjustReason)) {
                  props.viewModel.updateAdjustStockForm('reason', '');
                }
              }
            })
          ])
        }),

        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 
            adjustmentType === 'set' ? 'New Quantity:' : 'Amount:'
          ),
          right: Input({
            type: 'number',
            value: adjustAmount,
            onChange: (e) => props.viewModel.updateAdjustStockForm('amount', parseInt(e.target.value) || 0),
            name: 'adjust-amount',
            class: 'w-full',
            min: 0
          })
        }),

        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Reason:'),
          right: SelectFluid({ 
            name: 'adjust-reason',
            containerClass: 'flex-1',
            value: adjustReason,
            onChange: (e) => {
              props.viewModel.updateAdjustStockForm('reason', e.target.value);
              // Clear partner when reason changes away from "Borrow To"
              if (e.target.value !== 'Borrow To') {
                props.viewModel.updateAdjustStockForm('partnerId', null);
              }
            },
            delegator: props.delegator
          }, SelectOptions({ 
            options: reasonOptions,
            selectedOption: adjustReason
          }))
        }),

        // Partner Selection (only shown when "Borrow To" is selected)
        ...(adjustReason === 'Borrow To' ? [formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Partner *:'),
          right: DropdownSearch({
            open: showPartnerDropdown,
            value: partnerSearchQuery || (selectedPartner ? selectedPartner.name : ''),
            placeholder: selectedPartner ? selectedPartner.name : 'Search or select partner...',
            onInput: (query) => {
              props.viewModel.updateAdjustStockForm('partnerSearchQuery', query);
              props.viewModel.updateAdjustStockForm('showPartnerDropdown', true);
            },
            onFocus: () => props.viewModel.updateAdjustStockForm('showPartnerDropdown', true),
            getOpenState: () => {
              const form = props.viewModel.getState('adjust-stock-form');
              return form ? (form.showPartnerDropdown || false) : false;
            },
            setOpenState: () => props.viewModel.updateAdjustStockForm('showPartnerDropdown', false),
            class: 'w-full relative',
            delegator: props.delegator
          }, filteredPartners.length > 0 ? filteredPartners.map(partner => 
            DropdownSearchItem({
              onSelect: () => {
                props.viewModel.updateAdjustStockForm('partnerId', partner.id);
                props.viewModel.updateAdjustStockForm('showPartnerDropdown', false);
                props.viewModel.updateAdjustStockForm('partnerSearchQuery', '');
              },
              key: partner.id,
              delegator: props.delegator
            }, `${partner.name} (${partner.code || 'N/A'})`)
          ) : [])
        })] : []),

        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Date *:'),
          right: Input({
            type: 'date',
            value: adjustmentDate,
            onChange: (e) => props.viewModel.updateAdjustStockForm('adjustmentDate', e.target.value),
            name: 'adjustment-date',
            class: 'w-full',
            required: true,
            delegator: props.delegator
          })
        }),

        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Notes:'),
          right: Input({
            value: adjustNotes,
            onChange: (e) => props.viewModel.updateAdjustStockForm('notes', e.target.value),
            name: 'adjust-notes',
            placeholder: 'Additional notes about this adjustment...',
            class: 'w-full'
          })
        }),

        // Preview/Feedback Section (only shown when form is filled)
        isValid && Row({ class: 'bg-indigo-50 rounded-lg p-4 border-2 border-indigo-200' }, [
          Row({ class: 'text-sm font-semibold text-indigo-800 mb-3' }, 'Adjustment Preview'),
          Row({ class: 'grid grid-cols-2 gap-4' }, [
            DetailField({ 
              label: 'Current Quantity', 
              value: `${currentQuantity.toLocaleString()} ${stockItem.unit}` 
            }),
            DetailField({ 
              label: 'Adjustment', 
              value: adjustmentType === 'add' 
                ? `+${adjustAmount.toLocaleString()} ${stockItem.unit}`
                : adjustmentType === 'subtract'
                ? `-${adjustAmount.toLocaleString()} ${stockItem.unit}`
                : `Set to ${adjustAmount.toLocaleString()} ${stockItem.unit}`
            }),
            Row({ class: 'flex flex-col gap-1' }, [
              Row({ tagType: 'label', class: 'text-xs text-gray-500 font-medium' }, 'New Quantity'),
              Row({ 
                class: `text-sm font-semibold ${
                  quantityDifference !== 0 
                    ? quantityDifference > 0 ? 'text-green-600' : 'text-red-600'
                    : 'text-gray-900'
                }`
              }, `${newQuantity.toLocaleString()} ${stockItem.unit}`)
            ]),
            Row({ class: 'flex flex-col gap-1' }, [
              Row({ tagType: 'label', class: 'text-xs text-gray-500 font-medium' }, 'Change'),
              Row({ 
                class: `text-sm font-semibold ${
                  quantityDifference !== 0 
                    ? quantityDifference > 0 ? 'text-green-600' : 'text-red-600'
                    : 'text-gray-600'
                }`
              }, quantityDifference === 0 
                ? 'No change'
                : `${quantityDifference > 0 ? '+' : ''}${quantityDifference.toLocaleString()} ${stockItem.unit}`)
            ])
          ])
        ])
      ])
    ]),
    Row({ class: 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3' }, [
      Button({ variant: 'secondary', onClick: onClose, delegator: props.delegator }, 'Cancel'),
      Button({ 
        variant: 'primary', 
        onClick: handleSave, 
        delegator: props.delegator,
        disabled: !isValid,
        class: !isValid ? 'opacity-50 cursor-not-allowed' : ''
      }, 'Save Adjustment')
    ])
  ])
}

// Transfer Stock Drawer
function TransferStockDrawer({ stockItem, showSlide, onClose, ...props }) {
  // Get form state from viewModel
  const transferStockForm = props.viewModel.getState('transfer-stock-form');
  const transferQuantity = transferStockForm.quantity || 0;
  const transferFromLocation = transferStockForm.fromLocation || stockItem.location || '';
  const transferToLocation = transferStockForm.toLocation || '';
  const transferNotes = transferStockForm.notes || '';

  // Get unique locations from stock items (real data)
  const stockList = props.viewModel.getStockList();
  const locations = [...new Set(stockList.map(item => item.location).filter(Boolean))].sort();

  const handleSave = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanTransferItemShelf', {
      actionName: 'transfer stock items'
    });
    if (!hasPermission) {
      return;
    }

    // Handle stock transfer save
    console.log('Transferring stock:', {
      item: stockItem,
      quantity: transferQuantity,
      from: transferFromLocation,
      to: transferToLocation,
      notes: transferNotes
    });
    onClose();
  };

  return Drawer({ class: 'h-full overflow-y-auto flex flex-col', openSlide: showSlide }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: 'swap-horizontal-outline', class: 'text-xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, 'Transfer Stock'),
      ]),
      IconButton({ onClick: onClose, size: 'medium', delegator: props.delegator }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Row({ class: 'flex flex-col gap-6 max-w-2xl' }, [
        // Current Stock Info
        Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'text-sm font-semibold text-blue-800 mb-3' }, 'Stock Information'),
          Row({ class: 'grid grid-cols-2 gap-4' }, [
            DetailField({ label: 'Product', value: stockItem.name }),
            DetailField({ label: 'Available Quantity', value: (stockItem.quantity || 0).toLocaleString() }),
            DetailField({ label: 'Current Location', value: stockItem.location }),
            DetailField({ label: 'Unit', value: stockItem.unit }),
          ])
        ]),

        // Transfer Form
        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'From Location:'),
          right: SelectFluid({ 
            name: 'transfer-from-location',
            containerClass: 'flex-1',
            value: transferFromLocation,
            onChange: (e) => props.viewModel.updateTransferStockForm('fromLocation', e.target.value),
            delegator: props.delegator
          }, SelectOptions({ 
            options: locations,
            selectedOption: transferFromLocation
          }))
        }),

        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'To Location:'),
          right: SelectFluid({ 
            name: 'transfer-to-location',
            containerClass: 'flex-1',
            value: transferToLocation,
            onChange: (e) => props.viewModel.updateTransferStockForm('toLocation', e.target.value),
            delegator: props.delegator
          }, SelectOptions({ 
            options: locations.filter(loc => loc !== transferFromLocation),
            selectedOption: transferToLocation
          }))
        }),

        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Quantity to Transfer:'),
          right: Row({ class: 'flex flex-col gap-2' }, [
            Input({
              type: 'number',
              min: 1,
              max: stockItem.quantity || 0,
              value: transferQuantity,
              onChange: (e) => props.viewModel.updateTransferStockForm('quantity', parseInt(e.target.value) || 0),
              name: 'transfer-quantity',
              class: 'w-full'
            }),
            Row({ class: 'text-xs text-gray-500' }, 
              `Maximum available: ${(stockItem.quantity || 0).toLocaleString()} ${stockItem.unit}`
            )
          ])
        }),

        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Notes:'),
          right: Input({
            value: transferNotes,
            onChange: (e) => props.viewModel.updateTransferStockForm('notes', e.target.value),
            name: 'transfer-notes',
            placeholder: 'Optional notes about this transfer...',
            class: 'w-full'
          })
        })
      ])
    ]),
    Row({ class: 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3' }, [
      Button({ variant: 'secondary', onClick: onClose, delegator: props.delegator }, 'Cancel'),
      Button({ 
        variant: 'primary', 
        onClick: handleSave,
        disabled: !transferToLocation || transferQuantity <= 0 || transferQuantity > (stockItem.quantity || 0),
        delegator: props.delegator
      }, 'Transfer Stock')
    ])
  ])
}

// Return Borrowed Drawer
function ReturnBorrowedDrawer({ stockItem, showSlide, onClose, ...props }) {
  // Only boolean UI states in localState (architectural rule)
  props.ensureLocalStateKey('return-status-loaded', false);
  props.ensureLocalStateKey('available-stocks-loaded', false);
  props.ensureLocalStateKey('show-borrowed-details', false);

  // Complex data types from viewModel state
  const formState = props.viewModel.getState('return-borrowed-form') || {};
  const returnStatus = formState.returnStatus || null;
  const availableStocksRaw = formState.availableStocks || [];
  const returnDate = formState.returnDate || new Date().toISOString().split('T')[0];
  const selectedStocksRaw = formState.selectedStocks || []; // Array of {inventory_id, quantity}
  const returnNotes = formState.notes || '';

  // Boolean UI states from localState
  const returnStatusLoaded = props.getLocalState('return-status-loaded');
  const availableStocksLoaded = props.getLocalState('available-stocks-loaded');
  const showBorrowedDetails = props.getLocalState('show-borrowed-details');

  // Normalize selectedStocks to use inventory_id format
  const selectedStocks = Array.isArray(selectedStocksRaw) ? selectedStocksRaw.map(s => ({
    inventory_id: s.inventory_id || s.stockId,
    quantity: s.quantity || 0
  })) : [];

  // Calculate total return quantity
  const returnQuantity = selectedStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);

  const remaining = returnStatus?.remaining ?? 0;
  const totalBorrowed = returnStatus?.totalBorrowed ?? 0;
  const totalReturned = returnStatus?.totalReturned ?? 0;
  
  // Debug logging for return status display
  console.log('[ReturnBorrowedDrawer] Return status display:', {
    returnStatus,
    remaining,
    totalBorrowed,
    totalReturned,
    returnStatusLoaded,
    formStateReturnStatus: formState.returnStatus
  });

  // Use borrowFromId when from borrowed-from list (row id = borrow_from_inventories.id)
  const borrowFromId = stockItem?.borrowFromId ?? stockItem?.id;
  const productId = stockItem?.productId ?? null;
  
  // Debug: Log stockItem to see what fields are available
  console.log('[ReturnBorrowedDrawer] stockItem:', stockItem);
  console.log('[ReturnBorrowedDrawer] stockItem.inventoryId:', stockItem?.inventoryId);
  console.log('[ReturnBorrowedDrawer] stockItem keys:', stockItem ? Object.keys(stockItem) : 'stockItem is null');
  console.log('[ReturnBorrowedDrawer] productId:', productId);
  console.log('[ReturnBorrowedDrawer] showSlide:', showSlide, 'availableStocksLoaded:', availableStocksLoaded);

  // Fetch return status when drawer opens
  // Frontend must always provide borrowFromId and borrowedInventoryId
  // stockItem.inventoryId should always be available from findBorrowedFrom
  if (showSlide && borrowFromId && !returnStatusLoaded) {
    props.setLocalState('return-status-loaded', true);
    
    // stockItem.inventoryId should always be present from findBorrowedFrom
    // Check both inventoryId and inventory_id (in case of naming inconsistency)
    const borrowedInventoryId = stockItem?.inventoryId 
      ? Number(stockItem.inventoryId) 
      : (stockItem?.inventory_id ? Number(stockItem.inventory_id) : null);
    
    console.log('[ReturnBorrowedDrawer] Extracted borrowedInventoryId:', borrowedInventoryId, 'from stockItem:', {
      inventoryId: stockItem?.inventoryId,
      inventory_id: stockItem?.inventory_id
    });
    
    if (!borrowedInventoryId) {
      console.error('[ReturnBorrowedDrawer] Error: stockItem.inventoryId is missing. Full stockItem:', JSON.stringify(stockItem, null, 2));
      showAlert({
        title: 'Data Error',
        message: 'Inventory ID is missing. Please refresh the page and try again.',
        variant: 'error',
        icon: 'alert-circle-outline'
      });
      return;
    }
    
    props.viewModel.getBorrowFromReturnStatus({ 
      borrowFromId: Number(borrowFromId),
      borrowedInventoryId: borrowedInventoryId
    }).then((status) => {
      console.log('[ReturnBorrowedDrawer] Return status received:', status);
    }).catch((error) => {
      console.error('[ReturnBorrowedDrawer] Error fetching return status:', error);
    });
  }
  // Fetch available stock from inventories by product (all have valid inventory id)
  if (showSlide && productId && !availableStocksLoaded) {
    props.setLocalState('available-stocks-loaded', true);
    console.log('[ReturnBorrowedDrawer] Loading inventories for productId:', productId);
    props.viewModel.loadInventoriesByProduct(Number(productId)).then((items) => {
      console.log('[ReturnBorrowedDrawer] Loaded inventories:', items?.length || 0, items);
    }).catch((error) => {
      console.error('[ReturnBorrowedDrawer] Error loading inventories:', error);
    });
  }
  // Reset boolean flags when drawer closes so we refetch next open
  if (!showSlide) {
    if (returnStatusLoaded) {
      props.setLocalState('return-status-loaded', false);
    }
    if (availableStocksLoaded) {
      props.setLocalState('available-stocks-loaded', false);
    }
  }

  const borrowedItemData = {
    productCode: stockItem.productCode || stockItem.inventoryCode,
    productName: stockItem.name,
    totalBorrowed,
    totalReturned,
    remaining,
    currentUnitPrice: stockItem.unitCost || 0,
    lastAdjustedPrice: stockItem.unitCost || 0,
    borrowedDate: stockItem.borrowedDate || new Date().toISOString().split('T')[0],
    borrowedBy: stockItem.borrowedBy || ''
  };

  // Match borrow (stockItem) to an inventory row by batch/expiry/unitCost when inventoryId missing
  const matchBorrowToInventory = (inv) => {
    const norm = (v) => (v == null || v === '') ? null : String(v).trim();
    const eq = (a, b) => a === b || (a == null && b == null);
    const batchOk = eq(norm(stockItem.batchNumber), norm(inv.batchNumber));
    const expiryOk = eq(norm(stockItem.expiryDate), norm(inv.expiryDate));
    const costOk = Math.abs((Number(stockItem.unitCost) || 0) - (Number(inv.unitCost) || 0)) < 1e-6;
    return batchOk && expiryOk && costOk;
  };

  // Available stock: from inventories by product (all valid ids). Mark borrowed batch.
  const availableStocksList = Array.isArray(availableStocksRaw) ? availableStocksRaw : [];
  const availableStocks = availableStocksList.map((inv) => {
    const hasLink = stockItem?.inventoryId != null;
    const isBorrowedBatch = hasLink
      ? inv.id === Number(stockItem.inventoryId)
      : matchBorrowToInventory(inv);
    // Support multiple possible field names for unit price
    const unitPrice = inv.unitCost || inv.purchaseUnitPrice || inv.purchase_price || 0;
    return {
      id: inv.id,
      inventoryCode: inv.inventoryCode,
      batchNumber: inv.batchNumber,
      purchaseUnitPrice: unitPrice, // Normalize to purchaseUnitPrice
      unitCost: unitPrice, // Also keep unitCost for compatibility
      expiryDate: inv.expiryDate,
      quantity: inv.quantity,
      location: inv.location || '',
      isBorrowedBatch
    };
  });

  // Resolve borrowed inventory id: use link when present, else match from available stock
  const resolvedBorrowedInventoryId = stockItem?.inventoryId != null
    ? Number(stockItem.inventoryId)
    : (availableStocks.find((s) => s.isBorrowedBatch)?.id ?? null);

  const toggleStockSelection = (stockId) => {
    const current = [...selectedStocks];
    const inventoryId = Number(stockId);
    const index = current.findIndex(s => s.inventory_id === inventoryId);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push({ inventory_id: inventoryId, quantity: 0 });
    }
    props.viewModel.updateReturnBorrowedForm('selectedStocks', current);
  };

  const updateStockQuantity = (stockId, quantity) => {
    const current = [...selectedStocks];
    const inventoryId = Number(stockId);
    const index = current.findIndex(s => s.inventory_id === inventoryId);
    if (index >= 0) {
      const qty = Math.max(0, parseInt(quantity, 10) || 0);
      const otherTotal = current.reduce((sum, s) => (s.inventory_id === inventoryId ? sum : sum + (s.quantity || 0)), 0);
      current[index].quantity = Math.min(qty, Math.max(0, remaining - otherTotal));
    }
    props.viewModel.updateReturnBorrowedForm('selectedStocks', current);
  };

  const isStockSelected = (stockId) => {
    const inventoryId = Number(stockId);
    return selectedStocks.some(s => s.inventory_id === inventoryId);
  };

  const getSelectedStockQuantity = (stockId) => {
    const inventoryId = Number(stockId);
    const selected = selectedStocks.find(s => s.inventory_id === inventoryId);
    return selected ? selected.quantity : 0;
  };

  const getSelectedStock = (stockId) => {
    return availableStocks.find(s => s.id === stockId);
  };

  // Calculate summary - only include items with quantity > 0
  const summaryData = selectedStocks
    .filter(s => s && s.quantity > 0)
    .map(s => {
      const stock = getSelectedStock(s.inventory_id);
      const quantity = Number(s.quantity) || 0;
      // Try multiple possible field names for unit price (normalized in availableStocks mapping)
      const unitPrice = Number(stock?.purchaseUnitPrice || stock?.unitCost || 0);
      const totalValue = quantity * unitPrice;
      
      console.log('[ReturnBorrowedDrawer] Summary item calculation:', {
        inventory_id: s.inventory_id,
        quantity,
        unitPrice,
        totalValue,
        stock: stock ? {
          id: stock.id,
          inventoryCode: stock.inventoryCode,
          purchaseUnitPrice: stock.purchaseUnitPrice,
          unitCost: stock.unitCost
        } : 'stock not found'
      });
      
      return {
        inventoryCode: stock?.inventoryCode || `ID: ${s.inventory_id}`,
        quantity: quantity,
        unitPrice: unitPrice,
        totalValue: totalValue
      };
    })
    .filter(item => item.quantity > 0); // Double-check to ensure we only show items with quantity

  const totalReturnValue = summaryData.reduce((sum, item) => {
    const value = Number(item.totalValue) || 0;
    return sum + value;
  }, 0);
  
  console.log('[ReturnBorrowedDrawer] Summary calculation:', {
    summaryData,
    totalReturnValue,
    summaryDataLength: summaryData.length
  });
  const showSummary = summaryData.length > 0 && returnDate && returnQuantity > 0;

  const handleProcessReturn = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanReturnBorrowedFromStock', {
      actionName: 'return borrowed from items'
    });
    if (!hasPermission) {
      return;
    }

    const invId = resolvedBorrowedInventoryId != null ? Number(resolvedBorrowedInventoryId) : null;
    if (!invId) {
      showAlert({
        title: 'Error',
        message: 'Could not resolve the borrowed batch in available stock. Ensure the product has inventories (same batch/expiry/cost) or that the borrow has a linked inventory.',
        tone: 'error'
      });
      return;
    }

    const toSubmit = selectedStocks.filter(s => (s && (s.quantity || 0) > 0));
    if (toSubmit.length === 0) {
      showAlert({ title: 'Validation', message: 'Select at least one returning stock and enter quantity.', tone: 'warning' });
      return;
    }
    if (returnQuantity > remaining) {
      showAlert({ title: 'Validation', message: `Return quantity (${returnQuantity}) cannot exceed remaining to return (${remaining}).`, tone: 'warning' });
      return;
    }
    if (remaining <= 0) {
      showAlert({ title: 'Validation', message: 'Nothing remaining to return for this batch.', tone: 'warning' });
      return;
    }

    // Show confirmation modal before processing
    const confirmed = await showConfirmation({
      title: 'Confirm Return',
      message: `Are you sure you want to return ${returnQuantity.toLocaleString()} ${stockItem.unit || 'units'} to the partner?\n\nThis action will update the inventory and cannot be undone.`,
      confirmText: 'Confirm Return',
      cancelText: 'Cancel',
      variant: 'warning',
      icon: 'return-down-back-outline'
    });

    if (!confirmed) {
      return;
    }

    try {
      // Send all return items in {inventory_id, quantity} format
      // The viewModel will map it to API format {returningInventoryId, quantityReturned}
      const returnItems = toSubmit.map(s => ({
        inventory_id: Number(s.inventory_id || s.stockId),
        quantity: Number(s.quantity)
      }));

      await props.viewModel.processBorrowFromReturn({
        borrowedInventoryId: invId,
        returnItems: returnItems,
        returnedOn: returnDate,
        note: returnNotes || undefined
      });
      onClose();
    } catch (err) {
      showAlert({
        title: 'Return failed',
        message: err.message || 'Failed to process borrow from return.',
        tone: 'error'
      });
    }
  };

  const canProcessReturn = remaining > 0 && resolvedBorrowedInventoryId != null &&
    selectedStocks.length > 0 && returnDate && returnQuantity > 0 &&
    returnQuantity <= remaining &&
    selectedStocks.every(s => s.quantity > 0);

  return Drawer({ class: 'h-full overflow-y-auto flex flex-col', openSlide: showSlide }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: 'return-down-back-outline', class: 'text-xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, 'Return Borrowed From Items'),
      ]),
      IconButton({ onClick: onClose, size: 'medium', delegator: props.delegator }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Row({ class: 'flex flex-col gap-6' }, [
        // a) Borrowed Item Details
        Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'text-sm font-semibold text-blue-800 mb-3' }, 'Borrowed From Item Details'),
          Row({ class: 'grid grid-cols-2 gap-4' }, [
            DetailField({ label: 'Product Code', value: borrowedItemData.productCode }),
            DetailField({ label: 'Product Name', value: borrowedItemData.productName }),
            DetailField({ 
              label: 'Remaining to return', 
              value: returnStatusLoaded 
                ? `${remaining.toLocaleString()} ${stockItem.unit || ''}` 
                : 'Loading…' 
            }),
            DetailField({ label: 'Last Adjusted Unit Price', value: `Br ${borrowedItemData.lastAdjustedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }),
          ])
        ]),

        // b) Collapsible Total Borrowed Details
        Row({ class: 'border border-gray-200 rounded-lg overflow-hidden' }, [
          Row({ 
            class: 'bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors',
            events: { click: () => props.setLocalState('show-borrowed-details', !showBorrowedDetails) }
          }, [
            Row({ class: 'text-sm font-semibold text-gray-700' }, 'Total Borrowed Details'),
            IonIcon({ 
              name: showBorrowedDetails ? 'chevron-up-outline' : 'chevron-down-outline', 
              class: 'text-gray-500' 
            })
          ]),
          showBorrowedDetails && Row({ class: 'p-4 bg-white border-t border-gray-200' }, [
            Row({ class: 'grid grid-cols-2 gap-4' }, [
              DetailField({ label: 'Total Borrowed', value: `${totalBorrowed.toLocaleString()} ${stockItem.unit || ''}` }),
              DetailField({ label: 'Already Returned', value: `${totalReturned.toLocaleString()} ${stockItem.unit || ''}` }),
              DetailField({ label: 'Remaining to Return', value: `${remaining.toLocaleString()} ${stockItem.unit || ''}` }),
              DetailField({ label: 'Current Unit Price', value: `Br ${borrowedItemData.currentUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }),
            ])
          ])
        ]),

        // c) Return Details
        Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'text-sm font-semibold text-blue-800 mb-4' }, 'Return Details'),
          Row({ class: 'flex flex-col gap-4' }, [
            // Selected Items Summary Card (replaces quantity input)
            Row({ class: 'bg-white rounded-lg p-4 border border-blue-300' }, [
              Row({ class: 'text-xs font-semibold text-gray-700 mb-3' }, 'Selected Items for Return'),
              selectedStocks.length === 0 ? (
                Row({ class: 'text-sm text-gray-500 italic' }, 'No items selected. Select items from the table below.')
              ) : (
                Row({ class: 'flex flex-col gap-2' }, [
                  Row({ class: 'flex items-center justify-between' }, [
                    Row({ class: 'text-sm font-medium text-gray-700' }, 'Total Quantity:'),
                    Row({ class: 'text-lg font-bold text-indigo-600' }, 
                      `${returnQuantity.toLocaleString()} ${stockItem.unit || ''}`
                    )
                  ]),
                  Row({ class: 'flex items-center justify-between' }, [
                    Row({ class: 'text-sm font-medium text-gray-700' }, 'Items Selected:'),
                    Row({ class: 'text-sm font-semibold text-gray-900' }, 
                      `${selectedStocks.filter(s => s.quantity > 0).length} ${selectedStocks.filter(s => s.quantity > 0).length === 1 ? 'item' : 'items'}`
                    )
                  ]),
                  Row({ class: 'pt-2 border-t border-gray-200 mt-2' }, [
                    Row({ class: 'text-xs font-medium text-gray-600 mb-2' }, 'Breakdown:'),
                    Row({ class: 'flex flex-col gap-1' }, 
                      selectedStocks
                        .filter(s => s.quantity > 0)
                        .map(s => {
                          const stock = getSelectedStock(s.inventory_id);
                          return Row({ 
                            key: s.inventory_id,
                            class: 'flex items-center justify-between text-xs' 
                          }, [
                            Row({ class: 'text-gray-600' }, 
                              `${stock?.inventoryCode || 'N/A'}: ${s.quantity} ${stockItem.unit || ''}`
                            ),
                            Row({ class: 'text-gray-500' }, 
                              `@ Br ${(stock?.purchaseUnitPrice || stock?.unitCost || 0).toFixed(2)}`
                            )
                          ]);
                        })
                    )
                  ]),
                  Row({ class: 'pt-2 border-t border-gray-200 mt-2 text-xs text-gray-500' }, 
                    `Max allowed: ${remaining.toLocaleString()} ${stockItem.unit || ''}`
                  )
                ])
              )
            ]),
            formRow({
              left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Return Date:'),
              right: Input({
                type: 'date',
                value: returnDate,
                onChange: (e) => props.viewModel.updateReturnBorrowedForm('returnDate', e.target.value),
                name: 'return-date',
                class: 'w-full'
              })
            })
          ])
        ]),

        // d) Available Stock Table
        Row({ class: 'bg-white rounded-lg border border-gray-200 overflow-hidden' }, [
          Row({ class: 'px-4 py-3 bg-gray-50 border-b border-gray-200' }, [
            Row({ class: 'text-sm font-semibold text-gray-700' }, 'Available Stock (Select items to use for return)')
          ]),
          availableStocks.length === 0 && Row({ class: 'px-4 py-6 text-sm text-amber-700 bg-amber-50 border-b border-amber-200' }, 
            availableStocksLoaded
              ? 'No inventories of this product found. Add stock first, then return.'
              : 'Loading available stock…'
          ),
          availableStocks.length > 0 && Row({ class: 'overflow-x-auto' }, [
            Table({ class: 'w-full' }, [
              TableHeader({}, [
                TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Select'),
                TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Inventory Code'),
                TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Batch Number'),
                TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase' }, 'Purchase Unit Price'),
                TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Expiry Date'),
                TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase' }, 'Available Qty'),
                TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Location'),
                TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase' }, 'Return Qty')
              ]),
              TableBody({}, 
                availableStocks.map(stock => {
                  const isSelected = isStockSelected(stock.id);
                  const selectedQty = getSelectedStockQuantity(stock.id);
                  return TableRow({ 
                    key: stock.id,
                    class: `cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`
                  }, [
                    TableDCell({ class: 'px-4 py-3' }, [
                      Row({ 
                        class: `w-5 h-5 border-2 rounded flex items-center justify-center cursor-pointer ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`,
                        events:{click: (e) => {
                          e.stopPropagation();
                          toggleStockSelection(stock.id);
                        }}
                      }, [
                        isSelected && IonIcon({ name: 'checkmark', class: 'text-white text-sm' })
                      ])
                    ]),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 font-medium' }, 
                      stock.isBorrowedBatch 
                        ? Row({ class: 'flex flex-col gap-0.5' }, [
                            Row({}, stock.inventoryCode),
                            Row({ class: 'text-xs text-blue-600' }, '(this borrowed batch)')
                          ])
                        : stock.inventoryCode
                    ),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, stock.batchNumber),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, 
                      `Br ${(stock.purchaseUnitPrice || stock.unitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, formatDateDDMMYYYY(stock.expiryDate)),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, stock.quantity.toLocaleString()),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, stock.location),
                    TableDCell({ class: 'px-4 py-3' }, [
                      isSelected ? Row({
                        class: 'inline-block',
                        events: { click: (e) => e.stopPropagation() }
                      }, [
                        Input({
                          type: 'number',
                          min: 1,
                          max: stock.quantity,
                          value: selectedQty,
                          onInput: (e) => updateStockQuantity(stock.id, e.target.value),
                          // name: `qty-${stock.id}`,
                          class: 'w-20 text-right'
                        })
                      ]) : Row({ class: 'text-sm text-gray-400' }, '-')
                    ])
                  ])
                })
              )
            ])
          ])
        ]),

        // e) Notes
        formRow({
          left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Notes:'),
          right: Input({
            value: returnNotes,
            onChange: (e) => props.viewModel.updateReturnBorrowedForm('notes', e.target.value),
            name: 'return-notes',
            placeholder: 'Optional notes about this return...',
            class: 'w-full'
          })
        }),

        // f) Summary (only when all details filled)
        showSummary && Row({ class: 'bg-green-50 rounded-lg p-4 border border-green-200' }, [
          Row({ class: 'text-sm font-semibold text-green-800 mb-4' }, 'Return Summary'),
          Row({ class: 'space-y-2 mb-4' }, 
            summaryData.length > 0 ? summaryData.map((item, idx) => {
              const qty = Number(item.quantity) || 0;
              const price = Number(item.unitPrice) || 0;
              const total = qty * price;
              return Row({ key: idx, class: 'flex justify-between text-sm' }, [
                Row({ class: 'text-gray-700' }, 
                  `${item.inventoryCode}: ${qty.toLocaleString()} ${stockItem.unit || ''} @ Br ${price.toFixed(2)}`
                ),
                Row({ class: 'font-medium text-gray-900' }, 
                  `Br ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                )
              ]);
            }) : Row({ class: 'text-sm text-gray-500 italic' }, 'No items selected')
          ),
          summaryData.length > 0 && Row({ class: 'pt-3 border-t border-green-300 flex justify-between items-center' }, [
            Row({ class: 'text-sm font-semibold text-green-800' }, 'Total Return Value:'),
            Row({ class: 'text-lg font-bold text-green-900' }, 
              `Br ${totalReturnValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            )
          ]),
          summaryData.length > 0 && Row({ class: 'mt-3 pt-3 border-t border-green-300 flex justify-between items-center' }, [
            Row({ class: 'text-sm font-semibold text-green-800' }, 'Total Quantity:'),
            Row({ class: 'text-base font-semibold text-green-900' }, 
              `${returnQuantity.toLocaleString()} ${stockItem.unit || ''}`
            )
          ]),
          Row({ class: 'mt-3 text-xs text-gray-600' }, [
            Row({ tagType: 'span', class: 'font-medium' }, 'Return Date: '),
            returnDate
          ])
        ])
      ])
    ]),
    Row({ class: 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3' }, [
      Button({ variant: 'secondary', onClick: onClose, delegator: props.delegator }, 'Cancel'),
      Button({ 
        variant: 'primary', 
        onClick: handleProcessReturn,
        disabled: !canProcessReturn,
        delegator: props.delegator
      }, 'Process Return')
    ])
  ])
}

// Return Borrowed To Drawer (for items borrowed to partners)
function ReturnBorrowedToDrawer({ stockItem, showSlide, onClose, ...props }) {
  // Only boolean UI states in localState (architectural rule)
  props.ensureLocalStateKey('return-history-loaded', false);

  // Complex data types from viewModel state
  const formState = props.viewModel.getState('return-borrowed-to-form') || {};
  const returnDate = formState.returnDate || new Date().toISOString().split('T')[0];
  const returnItems = formState.returnItems || []; // Array of {batch_number, expiry_date, quantity_returned, location}
  const returnNotes = formState.notes || '';
  const returnHistory = formState.returnHistory || [];

  // Boolean UI states from localState
  const historyLoaded = props.getLocalState('return-history-loaded');

  // Get unique locations from stock list
  const stockList = props.viewModel.getStockList();
  const locations = [...new Set(stockList.map(item => item.location).filter(Boolean))].sort();

  // Calculate remaining quantity from history
  const totalReturned = (returnHistory || []).reduce((sum, ret) => sum + (Number(ret.quantity_returned || ret.quantityReturned || 0)), 0);
  const remainingQuantity = Math.max(0, (stockItem.quantity || 0) - totalReturned);

  // Calculate total quantity in return items
  const totalReturnQuantity = returnItems.reduce((sum, item) => sum + (Number(item.quantity_returned) || 0), 0);

  // Load return history when drawer opens
  if (showSlide && !historyLoaded && stockItem.borrowToId) {
    props.setLocalState('return-history-loaded', true);
    props.viewModel.getBorrowToReturnHistory(stockItem.borrowToId)
      .then(history => {
        const historyArray = history || [];
        // Update viewModel state with history
        props.viewModel.updateReturnBorrowedToForm({
          returnHistory: historyArray
        });
        // Trigger re-render
        props.viewModel.updateState('loading', true);
        setTimeout(() => props.viewModel.updateState('loading', false), 0);
      })
      .catch(error => {
        console.error('[ReturnBorrowedToDrawer] Error loading return history:', error);
      });
  }

  // Add new return item
  const handleAddReturnItem = () => {
    const newItems = [...returnItems, {
      batch_number: '',
      expiry_date: '',
      quantity_returned: 0,
      location: ''
    }];
    props.viewModel.updateReturnBorrowedToForm({ returnItems: newItems });
  };

  // Update return item
  const handleUpdateReturnItem = (index, updates) => {
    const newItems = [...returnItems];
    newItems[index] = { ...newItems[index], ...updates };
    props.viewModel.updateReturnBorrowedToForm({ returnItems: newItems });
  };

  // Remove return item
  const handleRemoveReturnItem = (index) => {
    const newItems = returnItems.filter((_, i) => i !== index);
    props.viewModel.updateReturnBorrowedToForm({ returnItems: newItems });
  };

  const handleProcessReturn = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanReturnBorrowedToStock', {
      actionName: 'return borrowed to items'
    });
    if (!hasPermission) {
      return;
    }

    if (!returnDate) {
      showAlert({
        title: 'Validation Error',
        message: 'Please provide a return date',
        tone: 'warning'
      });
      return;
    }

    // Filter out items with zero quantity
    const validItems = returnItems.filter(item => item && (Number(item.quantity_returned) || 0) > 0);
    
    if (validItems.length === 0) {
      showAlert({
        title: 'Validation Error',
        message: 'Please add at least one returned item with quantity > 0',
        tone: 'warning'
      });
      return;
    }

    // Validate all items have required fields
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      if (!item.quantity_returned || Number(item.quantity_returned) <= 0) {
        showAlert({
          title: 'Validation Error',
          message: `Item ${i + 1}: Quantity must be greater than 0`,
          tone: 'warning'
        });
        return;
      }
    }

    if (totalReturnQuantity > remainingQuantity) {
      showAlert({
        title: 'Validation Error',
        message: `Cannot return ${totalReturnQuantity} items. Only ${remainingQuantity} items remaining`,
        tone: 'warning'
      });
      return;
    }

    try {
      if (!stockItem.borrowToId) {
        showAlert({
          title: 'Error',
          message: 'Borrow To ID is missing. Cannot process return.',
          tone: 'error'
        });
        return;
      }

      // Prepare return items with product_id and unit_cost from stockItem
      // Ensure product_id and unit_cost are numbers for consistent backend comparison
      // stockItem from findBorrowedTo has: productId (camelCase) and unitCost (camelCase)
      const productId = Number(stockItem.productId);
      const unitCost = Number(stockItem.unitCost || 0);
      
      if (!productId || productId <= 0) {
        showAlert({
          title: 'Error',
          message: 'Product ID is missing or invalid. Cannot process return.',
          tone: 'error'
        });
        return;
      }
      
      console.log('[ReturnBorrowedToDrawer] Preparing return items:', {
        stockItem: {
          productId: stockItem.productId,
          unitCost: stockItem.unitCost,
          borrowToId: stockItem.borrowToId
        },
        normalized: { productId, unitCost },
        validItemsCount: validItems.length
      });
      
      const returnItemsData = validItems.map(item => ({
        product_id: productId, // Use normalized number
        unit_cost: unitCost, // Use normalized number
        batch_number: item.batch_number || null,
        expiry_date: item.expiry_date || null,
        quantity_returned: Number(item.quantity_returned),
        location: item.location || null
      }));
      
      console.log('[ReturnBorrowedToDrawer] Sending returnItemsData:', returnItemsData);

      // Show confirmation modal before processing
      const confirmed = await showConfirmation({
        title: 'Confirm Return',
        message: `Are you sure you want to process the return of ${totalReturnQuantity.toLocaleString()} ${stockItem.unit || 'units'} from the partner?\n\nThis action will add the returned items to inventory and cannot be undone.`,
        confirmText: 'Confirm Return',
        cancelText: 'Cancel',
        variant: 'warning',
        icon: 'return-up-forward-outline'
      });

      if (!confirmed) {
        return;
      }

      await props.viewModel.processBorrowToReturn({
        borrowToInventoryId: Number(stockItem.borrowToId),
        returnItems: returnItemsData,
        returnedDate: returnDate,
        notes: returnNotes || null
      });
      
      showAlert({
        title: 'Success',
        message: 'Return processed successfully',
        tone: 'success'
      });
      
      // Reset form state (loadStock is already called in processBorrowToReturn)
      props.setLocalState('return-history-loaded', false);
      
      onClose();
    } catch (error) {
      console.error('[ReturnBorrowedToDrawer] Error processing return:', error);
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to process return',
        tone: 'error'
      });
    }
  };

  const canProcessReturn = returnDate && totalReturnQuantity > 0 && totalReturnQuantity <= remainingQuantity && returnItems.length > 0;

  return Drawer({ class: 'h-full overflow-y-auto flex flex-col', openSlide: showSlide }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: 'return-up-forward-outline', class: 'text-xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, 'Return Borrowed To Items'),
      ]),
      IconButton({ onClick: onClose, size: 'medium', delegator: props.delegator }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Row({ class: 'flex flex-col gap-6 max-w-3xl' }, [
        // Borrowed To Information
        Row({ class: 'bg-purple-50 rounded-lg p-4 border border-purple-200' }, [
          Row({ class: 'text-sm font-semibold text-purple-800 mb-4' }, 'Borrowed To Information'),
          Row({ class: 'grid grid-cols-2 gap-4' }, [
            DetailField({ label: 'Product Code', value: stockItem.productCode, editMode: false }),
            DetailField({ label: 'Product Name', value: stockItem.name, editMode: false }),
            DetailField({ label: 'Partner', value: stockItem.partnerName || '-', editMode: false }),
            DetailField({ label: 'Lent Date', value: stockItem.lentDate ? formatDateDDMMYYYY(stockItem.lentDate) : '-', editMode: false }),
            DetailField({ label: 'Quantity Lent', value: (stockItem.quantity || 0).toLocaleString(), editMode: false }),
            DetailField({ label: 'Unit Cost', value: stockItem.unitCost ? `Br ${stockItem.unitCost.toFixed(2)}` : '-', editMode: false }),
            DetailField({ label: 'Remaining Quantity', value: remainingQuantity.toLocaleString(), editMode: false }),
          ])
        ]),

        // Return History Section
        Row({ class: 'bg-gray-50 rounded-lg p-4 border border-gray-200' }, [
          Row({ class: 'text-sm font-semibold text-gray-800 mb-4' }, 'Return History'),
          returnHistory.length > 0 ? Row({ class: 'space-y-2' }, 
            returnHistory.map((ret, idx) => 
              Row({ key: idx, class: 'bg-white rounded p-3 border border-gray-200' }, [
                Row({ class: 'flex justify-between items-center mb-2' }, [
                  Row({ class: 'text-sm font-medium text-gray-900' }, 
                    `Returned: ${(ret.quantity_returned || 0).toLocaleString()} ${stockItem.unit || 'units'}`
                  ),
                  Row({ class: 'text-xs text-gray-500' }, 
                    formatDateDDMMYYYY(ret.returned_date)
                  )
                ]),
                ret.notes && Row({ class: 'text-xs text-gray-600 mt-1' }, ret.notes)
              ])
            )
          ) : Row({ class: 'text-sm text-gray-500 italic' }, 'No returns processed yet')
        ]),

        // Return Date
        Row({ class: 'bg-white rounded-lg p-4 border border-gray-200' }, [
          Row({ class: 'text-sm font-semibold text-gray-800 mb-4' }, 'Return Details'),
          Row({ class: 'flex flex-col gap-4' }, [
            formRow({
              left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Return Date:'),
              right: Input({
                type: 'date',
                value: returnDate,
                onChange: (e) => {
                  props.viewModel.updateReturnBorrowedToForm({ returnDate: e.target.value });
                },
                name: 'return-date',
                class: 'w-full'
              })
            }),
            formRow({
              left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Notes:'),
              right: Input({
                value: returnNotes,
                onChange: (e) => {
                  props.viewModel.updateReturnBorrowedToForm({ notes: e.target.value });
                },
                name: 'return-notes',
                placeholder: 'Optional notes about this return...',
                class: 'w-full'
              })
            })
          ])
        ]),

        // Returned Items Section
        Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'flex items-center justify-between mb-4' }, [
            Row({ class: 'text-sm font-semibold text-blue-800' }, 'Returned Items'),
            Button({
              variant: 'outline',
              onClick: handleAddReturnItem,
              delegator: props.delegator,
              class: 'text-xs'
            }, [
              IonIcon({ name: 'add-outline', class: 'text-sm mr-1' }),
              'Add Item'
            ])
          ]),
          returnItems.length === 0 ? (
            Row({ class: 'text-sm text-gray-500 italic text-center py-4' }, 'No items added. Click "Add Item" to add returned items.')
          ) : (
            Row({ class: 'flex flex-col gap-3' }, 
              returnItems.map((item, idx) => 
                Row({ key: idx, class: 'bg-white rounded-lg p-4 border border-blue-300' }, [
                  Row({ class: 'flex items-center justify-between mb-3' }, [
                    Row({ class: 'text-xs font-semibold text-gray-700' }, `Item ${idx + 1}`),
                    IconButton({
                      onClick: () => handleRemoveReturnItem(idx),
                      size: 'small',
                      delegator: props.delegator
                    }, [
                      IonIcon({ name: 'close-outline', class: 'text-sm text-red-600' })
                    ])
                  ]),
                  Row({ class: 'grid grid-cols-2 gap-3' }, [
                    formRow({
                      left: Row({ tagType: 'label', class: 'text-xs text-gray-700' }, 'Batch Number:'),
                      right: Input({
                        value: item.batch_number || '',
                        onChange: (e) => handleUpdateReturnItem(idx, { batch_number: e.target.value }),
                        name: `batch-${idx}`,
                        placeholder: 'Optional',
                        class: 'w-full text-sm'
                      })
                    }),
                    formRow({
                      left: Row({ tagType: 'label', class: 'text-xs text-gray-700' }, 'Expiry Date:'),
                      right: Input({
                        type: 'date',
                        value: item.expiry_date || '',
                        onChange: (e) => handleUpdateReturnItem(idx, { expiry_date: e.target.value }),
                        name: `expiry-${idx}`,
                        class: 'w-full text-sm'
                      })
                    }),
                    formRow({
                      left: Row({ tagType: 'label', class: 'text-xs text-gray-700' }, 'Quantity:'),
                      right: Input({
                        type: 'number',
                        value: item.quantity_returned || 0,
                        onChange: (e) => handleUpdateReturnItem(idx, { quantity_returned: Number(e.target.value) || 0 }),
                        name: `quantity-${idx}`,
                        min: 1,
                        max: remainingQuantity,
                        class: 'w-full text-sm'
                      })
                    }),
                    formRow({
                      left: Row({ tagType: 'label', class: 'text-xs text-gray-700' }, 'Location:'),
                      right: SelectFluid({ 
                        name: `location-${idx}`,
                        containerClass: 'flex-1',
                        value: item.location || '',
                        onChange: (e) => handleUpdateReturnItem(idx, { location: e.target.value }),
                        delegator: props.delegator
                      }, SelectOptions({ 
                        options: locations,
                        selectedOption: item.location || ''
                      }))
                    })
                  ])
                ])
              )
            )
          )
        ]),

        // Summary Card
        totalReturnQuantity > 0 && Row({ class: 'bg-green-50 rounded-lg p-4 border border-green-200' }, [
          Row({ class: 'text-sm font-semibold text-green-800 mb-3' }, 'Return Summary'),
          Row({ class: 'flex flex-col gap-2' }, [
            Row({ class: 'flex justify-between items-center' }, [
              Row({ class: 'text-sm text-gray-700' }, 'Total Quantity:'),
              Row({ class: 'text-lg font-bold text-green-900' }, 
                `${totalReturnQuantity.toLocaleString()} ${stockItem.unit || ''}`
              )
            ]),
            Row({ class: 'flex justify-between items-center' }, [
              Row({ class: 'text-sm text-gray-700' }, 'Items Count:'),
              Row({ class: 'text-base font-semibold text-green-900' }, 
                `${returnItems.filter(i => i && (Number(i.quantity_returned) || 0) > 0).length} item(s)`
              )
            ]),
            Row({ class: 'pt-2 border-t border-green-300 mt-2 text-xs text-gray-600' }, 
              `Max allowed: ${remainingQuantity.toLocaleString()} ${stockItem.unit || ''}`
            )
          ])
        ])
      ])
    ]),
    Row({ class: 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3' }, [
      Button({ variant: 'secondary', onClick: onClose, delegator: props.delegator }, 'Cancel'),
      Button({ 
        variant: 'primary', 
        onClick: handleProcessReturn,
        disabled: !canProcessReturn,
        delegator: props.delegator
      }, 'Process Return')
    ])
  ])
}

// Helper Components
function DetailField({ label, value, editMode, inputProps, customInput }) {
  return Row({ class: 'flex flex-col gap-1' }, [
    Row({ tagType: 'label', class: 'text-xs text-gray-500 font-medium' }, label),
    editMode ? (customInput || Input({ 
      class: 'w-full',
      ...inputProps 
    })) : Row({ class: 'text-sm font-medium text-gray-900' }, value || '-')
  ]);
}

function getStatusText(item) {
  const today = new Date();
  const expiry = new Date(item.expiryDate);
  const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  const totalQty = item.productTotalQuantity ?? item.quantity ?? 0;
  const lowThreshold = item.low_stock_threshold ?? 50;

  if (expiry < today) return 'Expired';
  if (daysUntilExpiry <= 30) return `Expiring in ${daysUntilExpiry} days`;
  if (totalQty === 0) return 'Out of Stock';
  if (totalQty < lowThreshold) return 'Low Stock';
  return 'In Stock';
}

const formRow = ({ left, right }) => {
  return Row({ class: 'w-full flex justify-between items-center gap-4 mb-6' }, [
    Row({ class: 'flex-1/4' }, left),
    Row({ class: 'flex-3/4' }, right)
  ]);
};

async function handleExportCSV(props) {
  try {
    await props.viewModel.exportStock();
  } catch (error) {
    console.error('Export failed:', error);
    // Error is already handled in ViewModel and shown via toast
  }
}

async function openBorrowFromModal(props) {
  // Load data before opening modal to avoid infinite re-rendering
  console.log('[Stock] openBorrowFromModal - Loading products and partners...');
  await Promise.all([
    props.viewModel.loadAllProducts(),
    props.viewModel.loadPartners()
  ]);
  console.log('[Stock] openBorrowFromModal - Data loaded, opening modal');
  Modal({}, (delegator, closeHandler) => BorrowFromModalContent(props.viewModel, delegator, closeHandler));
}

function openImportStockModal(props) {
  Modal({}, (delegator, closeHandler) => ImportModalContent(props.viewModel, delegator, closeHandler)) 
}
