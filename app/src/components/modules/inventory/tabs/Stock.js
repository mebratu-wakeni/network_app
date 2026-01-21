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
import { showAlert } from '../../../utils/ModalHelpers';
import { permissionChecker } from '../../../utils/PermissionChecker';
import { formatDateDDMMYYYY } from '../../../utils/DateUtils';

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
  const selectedFilter = props.viewModel.getState('stock-filter');
  const searchQuery = props.viewModel.getState('stock-search-query');
  
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
      hoverBg: 'hover:bg-indigo-100'
    },
    { 
      key: 'out-of-stock', 
      title: 'Out of Stock', 
      icon: 'close-circle-outline', 
      value: (stats.outOfStock || 0).toLocaleString(), 
      subtitle: 'Items with zero quantity',
      color: 'text-red-600', 
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      hoverBg: 'hover:bg-red-100'
    },
    { 
      key: 'low-stock', 
      title: 'Low Stock', 
      icon: 'warning-outline', 
      value: (stats.lowStock || 0).toLocaleString(), 
      subtitle: 'Below reorder point',
      color: 'text-orange-600', 
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      hoverBg: 'hover:bg-orange-100'
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
      subtitle: 'Unit cost above ETB 1,000',
      color: 'text-emerald-600', 
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      hoverBg: 'hover:bg-emerald-100'
    },
  ];

  return Row({ class: 'w-full flex-1 flex flex-col overflow-hidden' }, [
    // Header Section with Actions
    Row({ class: 'flex items-center justify-between gap-6 p-6 border-b border-gray-200' }, [
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
          ' Import Stock'
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
          IonIcon({ name: 'download-outline', class: 'text-lg' }),
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
        Row({ class: 'flex items-center gap-2' }, [
          IconButton({ 
            onClick: () => props.setLocalState('view-mode', 'cards'),
            class: viewMode === 'cards' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400',
            size: 'medium'
          }, [
            IonIcon({ name: 'grid-outline' })
          ]),
          IconButton({ 
            onClick: () => props.setLocalState('view-mode', 'table'),
            class: viewMode === 'table' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400',
            size: 'medium'
          }, [
            IonIcon({ name: 'list-outline' })
          ])
        ])
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

    // Search and Filters Section
    Row({ class: 'flex items-center justify-between gap-6 px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex-1 max-w-md' }, [
        Row({ class: 'relative' }, [
          IonIcon({ 
            name: 'search-outline', 
            class: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl pointer-events-none' 
          }),
          Input({ 
            placeholder: 'Search stock by product code, name, or location...', 
            class: 'pl-10 pr-4',
            value: searchInputValue,
            onInput: handleSearchChange,
            focusIn: handleSearchFocusIn,
            focusOut: handleSearchFocusOut,
            name: 'stock-search'
          })
        ])
      ]),
      Row({ class: 'flex items-center gap-2 flex-wrap' }, [
        Row({ tagType: 'span', class: 'text-sm text-gray-600' }, 'Filter:'),
        Row({ class: 'flex items-center gap-2 flex-wrap' }, [
          Button({ 
            variant: selectedFilter === 'all' ? 'primary' : 'outline',
            class: 'text-sm px-3 py-1',
            onClick: () => handleFilterClick('all')
          }, 'All'),
          Button({ 
            variant: selectedFilter === 'out-of-stock' ? 'primary' : 'outline',
            class: 'text-sm px-3 py-1',
            onClick: () => handleFilterClick('out-of-stock')
          }, 'Out of Stock'),
          Button({ 
            variant: selectedFilter === 'low-stock' ? 'primary' : 'outline',
            class: 'text-sm px-3 py-1',
            onClick: () => handleFilterClick('low-stock')
          }, 'Low Stock'),
          Button({ 
            variant: selectedFilter === 'expiring-soon' ? 'primary' : 'outline',
            class: 'text-sm px-3 py-1',
            onClick: () => handleFilterClick('expiring-soon')
          }, 'Expiring Soon'),
          Button({ 
            variant: selectedFilter === 'expired' ? 'primary' : 'outline',
            class: 'text-sm px-3 py-1',
            onClick: () => handleFilterClick('expired')
          }, 'Expired'),
          Button({ 
            variant: selectedFilter === 'borrowed-from' ? 'primary' : 'outline',
            class: 'text-sm px-3 py-1',
            onClick: () => handleFilterClick('borrowed-from')
          }, 'Borrowed From'),
          Button({ 
            variant: selectedFilter === 'borrowed-to' ? 'primary' : 'outline',
            class: 'text-sm px-3 py-1',
            onClick: () => handleFilterClick('borrowed-to')
          }, 'Borrowed To'),
          Button({ 
            variant: selectedFilter === 'high-value' ? 'primary' : 'outline',
            class: 'text-sm px-3 py-1',
            onClick: () => handleFilterClick('high-value')
          }, 'High Value'),
        ])
      ])
    ]),

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
  onClick 
}) {
  const selectedClasses = isSelected 
    ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-md scale-105' 
    : '';
  
  return Row({ 
    class: `flex flex-col gap-2 p-3 rounded-lg border ${bgColor} ${borderColor} ${hoverBg} ${color} cursor-pointer transition-all duration-200 ${selectedClasses}`,
    onClick: onClick
  }, [
    Row({ class: 'flex items-center justify-between' }, [
      Row({ class: 'text-xs font-medium opacity-80 truncate flex-1' }, title),
      IonIcon({ 
        name: icon, 
        class: `text-xl opacity-80 flex-shrink-0 ml-2` 
      })
    ]),
    Row({ class: 'flex items-baseline gap-1' }, [
      Row({ class: 'text-xl font-bold' }, value),
      Row({ class: 'text-xs opacity-70' }, 'items')
    ]),
    Row({ class: 'text-xs opacity-70 leading-tight line-clamp-2' }, subtitle)
  ])
}

function StockTable({ filter, searchQuery, stockList = [], loading = false, ...props }) {
  // Get pagination from viewModel state (not local state)
  const tableConfig = props.viewModel.getState('stock-table-config');
  const totalCount = props.viewModel.getState('stock-total-count');
  
  const paginationOffset = tableConfig.offset || 0;
  const paginationLimit = tableConfig.limit || 25;
  
  // High value threshold - unit cost in dollars (per unit)
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

  // Helper function to check if date is expired
  const isExpired = (expiryDate) => {
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

  // Filter items based on selected filter
  const filteredItems = stockItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'out-of-stock') return item.quantity === 0;
    if (filter === 'low-stock') return item.quantity > 0 && item.quantity < 50;
    if (filter === 'expiring-soon') {
      const expiryThreshold = item.expiry_threshold || item.product?.expiry_threshold || 30;
      return isExpiringSoon(item.expiryDate, expiryThreshold);
    }
    if (filter === 'expired') return isExpired(item.expiryDate);
    if (filter === 'borrowed-from') return item.status === 'borrowed-from' || (item.acquisitionType === 'borrow' && item.borrowDirection === 'from');
    if (filter === 'borrowed-to') return item.status === 'borrowed-to' || (item.acquisitionType === 'borrow' && item.borrowDirection === 'to');
    if (filter === 'high-value') return isHighValue(item);
    return item.status === filter;
  });

  // Search filter
  const searchedItems = filteredItems.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return item.productCode.toLowerCase().includes(query) ||
           item.name.toLowerCase().includes(query) ||
           item.location.toLowerCase().includes(query);
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

  const getStatusBadge = (status, quantity, expiryDate, item = null) => {
    if (status === 'borrowed-from') {
      return Row({ class: 'px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700' }, 'Borrowed From');
    }
    if (status === 'borrowed-to') {
      return Row({ class: 'px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700' }, 'Borrowed To');
    }
    if (isExpired(expiryDate)) {
      return Row({ class: 'px-2 py-1 rounded-full text-xs font-medium bg-red-200 text-red-800' }, 'Expired');
    }
    // Use product-specific expiry_threshold if available
    const expiryThreshold = item?.expiry_threshold || item?.product?.expiry_threshold || 30;
    if (isExpiringSoon(expiryDate, expiryThreshold)) {
      return Row({ class: 'px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700' }, 'Expiring Soon');
    }
    if (quantity === 0) {
      return Row({ class: 'px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700' }, 'Out of Stock');
    }
    if (quantity < 50) {
      return Row({ class: 'px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700' }, 'Low Stock');
    }
    return Row({ class: 'px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700' }, 'In Stock');
  };

  // Sort icon helper function
  const sortIcon = (column) => {
    const tableConfig = props.viewModel.getState('stock-table-config');
    const orderBy = tableConfig.orderBy;
    const sortBy = tableConfig.sortBy;
    if (column === sortBy) {
      return IonIcon({ name: `${orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline'}`, class: 'text-xs ml-2 font-semibold' });
    }
    return false;
  };

  return Row({ class: 'flex-1 flex flex-col overflow-hidden min-h-0' }, [
    // Pagination Section
    Row({ class: 'flex items-center justify-end gap-4 px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0' }, [
      Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, "Rows per page"),
      SelectRelative({ 
        name: 'limit', 
        onChange: (e) => handleSetLimit(parseInt(e.target.value)), 
        value: paginationLimit 
      },
        SelectOptions({ 
          options: ['10', '25', '50', '100'], 
          selectedOption: paginationLimit + '' 
        })),
      Row({ tagType: 'p', }, "|"),
      Row({ class: 'inline-flex items-center gap-1' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 
          totalItems > 0 ? `${initRow}-${endRow} of ${totalItems}` : '0-0 of 0'
        ),
        IconButton({ 
          onClick: handlePreviousPage, 
          disabled: paginationOffset === 0 
        }, [IonIcon({ name: 'caret-back-outline' })]),
        IconButton({ 
          onClick: handleNextPage, 
          disabled: paginationOffset + paginationLimit >= totalItems 
        }, [IonIcon({ name: 'caret-forward-outline' })])
      ]),
    ]),

    // Stock Table
    Row({ class: 'flex-1 flex flex-col overflow-hidden min-h-0 pb-6' }, [
      Table({ 
        class: 'flex-1 flex flex-col min-h-0', 
        getOpenActionState: () => props.getLocalState('actionId'), 
        setOpenActionState: () => props.setLocalState('actionId', null)  
      }, [
      TableHeader({ class: 'sticky top-0 z-10 bg-white' }, [
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('product_code') }, [
          'Product Code',
          sortIcon('product_code')
        ]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('name') }, [
          'Product Name',
          sortIcon('name')
        ]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('category') }, [
          'Category',
          sortIcon('category')
        ]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('location') }, [
          'Location',
          sortIcon('location')
        ]),
        TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('quantity') }, [
          'Quantity',
          sortIcon('quantity')
        ]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('unit') }, [
          'Unit',
          sortIcon('unit')
        ]),
        TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', onClick: () => props.viewModel.setStockSort('expiry_date') }, [
          'Expiry Date',
          sortIcon('expiry_date')
        ]),
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
                TableDCell({ class: 'px-4 py-3 text-sm font-medium text-gray-900' }, item.productCode),
                TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, item.name),
                TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, item.category),
                TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, item.location),
                TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right font-medium' }, item.quantity.toLocaleString()),
                TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, item.unit),
                TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, formatDateDDMMYYYY(item.expiryDate)),
                TableDCell({ class: 'px-4 py-3 text-sm' }, getStatusBadge(item.status, item.quantity, item.expiryDate, item)),
                ActionDropdown({
                  actionId: item.id,
                  open: item.id === actionId,
                  class: 'text-center px-4 py-3',
                  onToggle: () => props.setLocalState('actionId', actionId === item.id ? null : item.id)
                }, [
                  ActionItem({
                    label: 'View Details',
                    icon: 'eye-outline',
                    onClick: async () => {
                      const hasPermission = await permissionChecker.checkPermission('CanSeeStockItemDetails', {
                        actionName: 'view stock details'
                      });
                      if (hasPermission) {
                        props.viewModel.openStockDrawer(item, 'view-details');
                        props.setLocalState('actionId', null);
                      } else {
                        props.setLocalState('actionId', null);
                      }
                    }
                  }),
                  (item.status === 'borrowed-from' || item.status === 'borrowed') && ActionItem({
                    label: 'Return Borrowed From',
                    icon: 'return-down-back-outline',
                    onClick: async () => {
                      const hasPermission = await permissionChecker.checkPermission('CanReturnBorrowedFromStock', {
                        actionName: 'return borrowed items'
                      });
                      if (hasPermission) {
                        props.viewModel.openStockDrawer(item, 'return-borrowed');
                        props.setLocalState('actionId', null);
                      } else {
                        props.setLocalState('actionId', null);
                      }
                    }
                  }),
                  ActionItem({
                    label: 'Adjust Stock',
                    icon: 'create-outline',
                    onClick: async () => {
                      const hasPermission = await permissionChecker.checkPermission('CanAdjustStockItemQuantities', {
                        actionName: 'adjust stock quantities'
                      });
                      if (hasPermission) {
                        props.viewModel.openStockDrawer(item, 'adjust-stock');
                        props.setLocalState('actionId', null);
                      } else {
                        props.setLocalState('actionId', null);
                      }
                    }
                  }),
                  ActionItem({
                    label: 'Transfer',
                    icon: 'swap-horizontal-outline',
                    onClick: async () => {
                      const hasPermission = await permissionChecker.checkPermission('CanTransferItemShelf', {
                        actionName: 'transfer stock items'
                      });
                      if (hasPermission) {
                        props.viewModel.openStockDrawer(item, 'transfer');
                        props.setLocalState('actionId', null);
                      } else {
                        props.setLocalState('actionId', null);
                      }
                    }
                  })
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
    'return-borrowed': ReturnBorrowedDrawer
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
    const hasPermission = await permissionChecker.checkPermission('CanEditStockItemDetails', {
      actionName: 'edit stock item details'
    });
    if (hasPermission) {
      props.viewModel.setStockDetailsEditMode(true);
    }
  };

  const handleEditPricing = async () => {
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
      const formUnitCost = currentForm.unitCost !== undefined ? currentForm.unitCost : (stockItem.unitCost || 0);
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
        staleExpiryDate: expiryDate, // This is the stale value from render
        staleBatchNo: batchNo // This is the stale value from render
      });
      
      await props.viewModel.updateStock(stockItem.id, {
        inventoryCode: formInventoryCode,
        productCode: formProductCode, // Read-only, but included for completeness
        // quantity is NOT included - it's read-only and must be changed via Adjust Stock for data integrity
        batchNo: formBatchNo,
        expiryDate: normalizedExpiryDate,
        unitCost: formUnitCost
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
                value: detailsEditMode ? null : (batchNo || '-'),
                editMode: detailsEditMode,
                inputProps: {
                  value: batchNo || '',
                  onChange: (e) => props.viewModel.updateStockDetailsForm('batchNo', e.target.value),
                  name: 'stock-batch-no',
                  placeholder: 'Enter batch number',
                  delegator: props.delegator
                }
              })
            ]),
            // Row 3: Unit Cost and Selling Price (2 columns)
            Row({ class: 'grid grid-cols-2 gap-6' }, [
              DetailField({ 
                label: 'Unit Cost', 
                value: detailsEditMode ? null : `ETB ${(unitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                editMode: detailsEditMode,
                inputProps: {
                  type: 'number',
                  step: '0.01',
                  min: 0,
                  value: unitCost ?? 0,
                  onChange: (e) => props.viewModel.updateStockDetailsForm('unitCost', parseFloat(e.target.value) || 0),
                  name: 'stock-unit-cost',
                  placeholder: 'Enter unit cost',
                  delegator: props.delegator
                }
              }),
              DetailField({ 
                label: 'Selling Price', 
                value: pricingEditMode ? null : `ETB ${(sellingPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
                value: detailsEditMode ? null : formatDateDDMMYYYY(expiryDate),
                editMode: detailsEditMode,
                inputProps: {
                  type: 'date',
                  value: expiryDate || '',
                  onChange: (e) => {
                    const newValue = e.target.value || null;
                    console.log('[Stock.js] Expiry date onChange:', {
                      targetValue: e.target.value,
                      newValue,
                      currentFormValue: stockDetailsForm.expiryDate
                    });
                    props.viewModel.updateStockDetailsForm('expiryDate', newValue);
                  },
                  name: 'stock-expiry-date',
                  placeholder: 'Select expiry date',
                  delegator: props.delegator
                }
              }),
              DetailField({ 
                label: 'Total Value', 
                value: `ETB ${getTotalValue(stockItem).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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

        // Borrowed Information Section (if borrowed)
        (stockItem.status === 'borrowed-from' || stockItem.status === 'borrowed') && Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'text-sm font-semibold text-blue-800 mb-4' }, 'Borrowed From Information'),
          Row({ class: 'grid grid-cols-2 gap-4' }, [
            DetailField({ label: 'Borrowed By', value: stockItem.borrowedBy || '-' }),
            DetailField({ label: 'Borrowed Date', value: stockItem.borrowedDate || '-' }),
            DetailField({ label: 'Borrowed Quantity', value: (stockItem.quantity || 0).toLocaleString() + ' ' + stockItem.unit }),
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
        Row({ class: 'flex items-center gap-2' }, [
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
  const partnerList = props.viewModel.getPartnerList() || [];
  const selectedPartner = partnerList.find(p => p.id === partnerId) || null;
  
  // Filter partners based on search query
  const filteredPartners = partnerList.filter(partner => {
    if (partner.type !== 'partner') return false;
    if (!partnerSearchQuery) return true;
    const query = partnerSearchQuery.toLowerCase();
    return (partner.name || '').toLowerCase().includes(query) ||
           (partner.code || '').toLowerCase().includes(query);
  });
  
  // Load partners if not loaded
  if (partnerList.length === 0) {
    props.viewModel.loadPartners();
  }

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
        partnerId: adjustReason === 'Borrow To' ? partnerId : null
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
  // TODO: Fetch borrowed item data from API
  // For now, use stockItem data
  const borrowedItemData = {
    productCode: stockItem.productCode || stockItem.inventoryCode,
    productName: stockItem.name,
    totalBorrowed: 0, // TODO: Get from API
    settled: 0, // TODO: Get from API
    sold: 0, // TODO: Get from API
    unsettled: 0, // TODO: Get from API
    currentUnitPrice: stockItem.unitCost || 0,
    lastAdjustedPrice: stockItem.unitCost || 0,
    borrowedDate: stockItem.borrowedDate || new Date().toISOString().split('T')[0],
    borrowedBy: stockItem.borrowedBy || ''
  };

  // Get available stock items with same product code from real data
  const stockList = props.viewModel.getStockList();
  const availableStocks = stockList
    .filter(item => item.productCode === stockItem.productCode && item.id !== stockItem.id)
    .map(item => ({
      id: item.id,
      inventoryCode: item.inventoryCode,
      batchNumber: item.batchNumber,
      purchaseUnitPrice: item.unitCost,
      expiryDate: item.expiryDate,
      quantity: item.quantity,
      location: item.location
    }));

  props.ensureLocalStateKey('return-date', new Date().toISOString().split('T')[0]);
  props.ensureLocalStateKey('return-quantity', 0);
  props.ensureLocalStateKey('selected-stocks', []); // Array of {stockId, quantity}
  props.ensureLocalStateKey('return-notes', '');
  props.ensureLocalStateKey('show-borrowed-details', false);

  const returnDate = props.getLocalState('return-date');
  const returnQuantity = props.getLocalState('return-quantity');
  const selectedStocks = props.getLocalState('selected-stocks');
  const returnNotes = props.getLocalState('return-notes');
  const showBorrowedDetails = props.getLocalState('show-borrowed-details');

  const toggleStockSelection = (stockId) => {
    const current = [...selectedStocks];
    const index = current.findIndex(s => s.stockId === stockId);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push({ stockId, quantity: 0 });
    }
    props.setLocalState('selected-stocks', current);
  };

  const updateStockQuantity = (stockId, quantity) => {
    const current = [...selectedStocks];
    const index = current.findIndex(s => s.stockId === stockId);
    if (index >= 0) {
      current[index].quantity = parseInt(quantity) || 0;
    }
    props.setLocalState('selected-stocks', current);
    
    // Calculate total return quantity
    const total = current.reduce((sum, s) => sum + (s.quantity || 0), 0);
    // Quantity is auto-calculated by viewModel
  };

  const isStockSelected = (stockId) => {
    return selectedStocks.some(s => s.stockId === stockId);
  };

  const getSelectedStockQuantity = (stockId) => {
    const selected = selectedStocks.find(s => s.stockId === stockId);
    return selected ? selected.quantity : 0;
  };

  const getSelectedStock = (stockId) => {
    return availableStocks.find(s => s.id === stockId);
  };

  // Calculate summary
  const summaryData = selectedStocks.map(s => {
    const stock = getSelectedStock(s.stockId);
    return {
      inventoryCode: stock?.inventoryCode || '',
      quantity: s.quantity,
      unitPrice: stock?.purchaseUnitPrice || 0,
      totalValue: (s.quantity || 0) * (stock?.purchaseUnitPrice || 0)
    };
  });

  const totalReturnValue = summaryData.reduce((sum, s) => sum + s.totalValue, 0);
  const showSummary = selectedStocks.length > 0 && returnDate && returnQuantity > 0;

  const handleProcessReturn = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanReturnBorrowedFromStock', {
      actionName: 'return borrowed items'
    });
    if (!hasPermission) {
      return;
    }

    console.log('Processing return:', {
      borrowedItem: borrowedItemData,
      returnDate,
      returnQuantity,
      selectedStocks: summaryData,
      totalValue: totalReturnValue,
      notes: returnNotes
    });
    onClose();
  };

  const canProcessReturn = selectedStocks.length > 0 && returnDate && returnQuantity > 0 && 
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
            DetailField({ label: 'Unsettled Quantity', value: `${borrowedItemData.unsettled.toLocaleString()} ${stockItem.unit}` }),
            DetailField({ label: 'Last Adjusted Unit Price', value: `ETB ${borrowedItemData.lastAdjustedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }),
          ])
        ]),

        // b) Collapsible Total Borrowed Details
        Row({ class: 'border border-gray-200 rounded-lg overflow-hidden' }, [
          Row({ 
            class: 'bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors',
            onClick: () => props.setLocalState('show-borrowed-details', !showBorrowedDetails)
          }, [
            Row({ class: 'text-sm font-semibold text-gray-700' }, 'Total Borrowed Details'),
            IonIcon({ 
              name: showBorrowedDetails ? 'chevron-up-outline' : 'chevron-down-outline', 
              class: 'text-gray-500' 
            })
          ]),
          showBorrowedDetails && Row({ class: 'p-4 bg-white border-t border-gray-200' }, [
            Row({ class: 'grid grid-cols-2 gap-4' }, [
              DetailField({ label: 'Total Borrowed', value: `${borrowedItemData.totalBorrowed.toLocaleString()} ${stockItem.unit}` }),
              DetailField({ label: 'Already Settled', value: `${borrowedItemData.settled.toLocaleString()} ${stockItem.unit}` }),
              DetailField({ label: 'Already Sold', value: `${borrowedItemData.sold.toLocaleString()} ${stockItem.unit}` }),
              DetailField({ label: 'Current Adjusted Unit Price', value: `ETB ${borrowedItemData.currentUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }),
            ])
          ])
        ]),

        // c) Return Details
        Row({ class: 'bg-blue-50 rounded-lg p-4 border border-blue-200' }, [
          Row({ class: 'text-sm font-semibold text-blue-800 mb-4' }, 'Return Details'),
          Row({ class: 'flex flex-col gap-4' }, [
            formRow({
              left: Row({ tagType: 'label', class: 'text-gray-800 font-medium' }, 'Return Quantity:'),
              right: Row({ class: 'flex flex-col gap-2' }, [
                Input({
                  type: 'number',
                  min: 1,
                  max: borrowedItemData.unsettled,
                  value: returnQuantity,
                  onChange: (e) => props.setLocalState('return-quantity', parseInt(e.target.value) || 0),
                  name: 'return-quantity',
                  class: 'w-full',
                  disabled: true // Calculated from selected stocks
                }),
                Row({ class: 'text-xs text-gray-500' }, 'Calculated from selected stock items')
              ])
            }),
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
          Row({ class: 'overflow-x-auto' }, [
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
                        onClick: (e) => {
                          e.stopPropagation();
                          toggleStockSelection(stock.id);
                        }
                      }, [
                        isSelected && IonIcon({ name: 'checkmark', class: 'text-white text-sm' })
                      ])
                    ]),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 font-medium' }, stock.inventoryCode),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, stock.batchNumber),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, 
                      `ETB ${stock.purchaseUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, formatDateDDMMYYYY(stock.expiryDate)),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, stock.quantity.toLocaleString()),
                    TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, stock.location),
                    TableDCell({ class: 'px-4 py-3' }, [
                      isSelected ? Input({
                        type: 'number',
                        min: 1,
                        max: stock.quantity,
                        value: selectedQty,
                        onChange: (e) => updateStockQuantity(stock.id, e.target.value),
                        name: `qty-${stock.id}`,
                        class: 'w-20 text-right',
                        onClick: (e) => e.stopPropagation()
                      }) : Row({ class: 'text-sm text-gray-400' }, '-')
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
            summaryData.map((item, idx) => 
              Row({ key: idx, class: 'flex justify-between text-sm' }, [
                Row({ class: 'text-gray-700' }, `${item.inventoryCode}: ${item.quantity} ${stockItem.unit} @ ETB ${item.unitPrice.toFixed(2)}`),
                Row({ class: 'font-medium text-gray-900' }, `ETB ${item.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
              ])
            )
          ),
          Row({ class: 'pt-3 border-t border-green-300 flex justify-between items-center' }, [
            Row({ class: 'text-sm font-semibold text-green-800' }, 'Total Return Value:'),
            Row({ class: 'text-lg font-bold text-green-900' }, 
              `ETB ${totalReturnValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  
  if (expiry < today) return 'Expired';
  if (daysUntilExpiry <= 30) return `Expiring in ${daysUntilExpiry} days`;
  if (item.quantity === 0) return 'Out of Stock';
  if (item.quantity < 50) return 'Low Stock';
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
