import { Button } from "../../../utils/Button";
import { Input } from "../../../utils/Input";
import { SelectFluid, SelectOptions, SelectRelative } from "../../../utils/Select";
import { IconButton } from "../../../utils/Icon";
import { IonIcon } from "../../../utils/Icon";
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from "../../../utils/Table";
import Dropdown from "../../../utils/Dropdown";
import { ActionDropdown, ActionItem } from "../../../utils/Action";
import Drawer from "../../../shared/ExampleDrawer";
import { CardHeader, Card } from "../../../utils/Card";
import { DropdownSearch } from "../../../utils/DropdownSearch";
import Modal from "../../../shared/Modal";
import ModalContent from "../CreateProductModal";
import ImportModalContent from "../ImportProductsModal";
import { showConfirmation } from "../../../utils/ModalHelpers";
import { permissionChecker } from "../../../utils/PermissionChecker";
import { formatDateDDMMYYYY } from "../../../utils/DateUtils";

const { Row } = Liteframe;

export function Products(props) {
  // Get data from viewModel state (not local state)
  const tableConfig = props.viewModel.getState('product-table-config');
  const initRow = parseInt(tableConfig.offset) + 1;
  let endRow = initRow + parseInt(tableConfig.limit) - 1;
  const totalRow = props.viewModel.getState('product-total-count');

  const loading = props.viewModel.getState('loading');
  const productList = props.viewModel.getProductList();
  const searchQuery = props.viewModel.getState('product-search-query');
  const productFilter = props.viewModel.getState('product-filter') || 'all';
  const productStats = props.viewModel.getState('product-stats') || { outOfStock: 0, lowStock: 0 };
  
  // Get drawer state from viewModel
  const selectedProduct = props.viewModel.getState('selected-product');
  const productDrawerType = props.viewModel.getState('product-drawer-type');
  const productDrawerOpen = props.viewModel.getState('product-drawer-open');
  
  // Local state only for UI concerns (selected row highlighting for table, search debounce)
  // Use local state for search input value to avoid re-render issues with ViewModel state
  props.ensureLocalStateKey('selectedRowId', null);
  props.ensureLocalStateKey('searchTimeout', null);
  
  // Initialize search input value only once, then keep it in sync manually
  // const searchInputValueInitialized = props.getLocalState('searchInputValueInitialized');
  props.ensureLocalStateKey('searchInputValueInitialized', false);
  const searchInputValueInitialized = props.getLocalState('searchInputValueInitialized');

  // Initialize once from VM state; do not reset on focus/blur.
  if (!searchInputValueInitialized) {
    props.setLocalState('searchInputValue', searchQuery || '');
    props.setLocalState('searchInputValueInitialized', true);
  }
  
  const selectedRowId = props.getLocalState('selectedRowId');
  const searchInputValue = props.getLocalState('searchInputValue') || '';

  const handleSearchChange = (e) => {
    const newQuery = e.target.value;
    
    // Update local state immediately for input value (single re-render)
    props.setLocalState('searchInputValue', newQuery);
    
    // Clear existing timeout
    // const existingTimeout = props.getLocalState('searchTimeout');
    const existingTimeout = props.getLocalState('searchTimeout');
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // If search is cleared, update ViewModel and reload immediately
    if (!newQuery || newQuery.trim() === '') {
      props.viewModel.updateProductSearchQuery('');
      props.viewModel.loadProducts();
      props.setLocalState('searchTimeout', null);
      return;
    }
    
    // Debounce: wait 500ms after user stops typing before updating ViewModel and searching
    // Defer ViewModel updates (which trigger 2 updateState calls) to avoid complex re-renders during typing
    // This prevents input from losing focus while user is actively typing
    const timeout = setTimeout(() => {
      props.viewModel.updateProductSearchQuery(newQuery);
      props.viewModel.loadProducts();
      props.setLocalState('searchTimeout', null);
    }, 500);
    
    props.setLocalState('searchTimeout', timeout);
  };

  return Row({ class: 'w-full flex flex-col'}, [
    !searchInputValueInitialized && loading && productList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0 px-6' }, 'Loading products...'),
    !searchInputValueInitialized && !loading && productList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0 px-6' }, 'No products found'),
    
    // Header Section with Actions
    Row({ class: 'flex flex-wrap items-center justify-between gap-3 px-3 md:px-4 py-2 border-b border-gray-200' }, [
      Row({ class: 'flex flex-wrap items-center gap-2 md:gap-3' }, [
        Button({ 
          variant: 'primary', 
          class: 'text-nowrap flex items-center gap-2',
          onClick: async () => {
            const hasPermission = await permissionChecker.checkPermission('CanAddProduct', {
              actionName: 'add products'
            });
            if (hasPermission) {
              openAddProductModal(props);
            }
          }
        }, [
          IonIcon({ name: 'add-outline', class: 'text-lg text-white' }),
          'Add Product'
        ]),
        Button({ 
          variant: 'outline', 
          class: 'text-nowrap flex items-center gap-2',
          onClick: async () => {
            const hasPermission = await permissionChecker.checkPermission('CanImportProducts', {
              actionName: 'import products'
            });
            if (hasPermission) {
              openImportProductsModal(props);
            }
          }
        }, [
          IonIcon({ name: 'cloud-upload-outline', class: 'text-lg' }),
          'Import Products'
        ]),
      ]),
      Button({ 
        variant: 'secondary', 
        class: 'text-nowrap flex items-center gap-2',
        onClick: async () => {
          const hasPermission = await permissionChecker.checkPermission('CanExportProducts', {
            actionName: 'export products'
          });
          if (hasPermission) {
            handleExportCSV(props);
          }
        }
      }, [
        IonIcon({ name: 'download-outline', class: 'text-lg' }),
        'Export CSV'
      ])
    ]),

    // Product filter: All | Out of stock | Low stock (by bin card balance)
    Row({ class: 'flex items-center gap-2 px-3 md:px-4 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0 flex-wrap' }, [
      Button({
        variant: productFilter === 'all' ? 'primary' : 'outline',
        class: 'text-xs py-0.5 px-2 min-h-0',
        onClick: () => props.viewModel.setProductFilter('all')
      }, 'All'),
      Button({
        variant: productFilter === 'out-of-stock' ? 'primary' : 'outline',
        class: 'text-xs py-0.5 px-2 min-h-0',
        onClick: () => props.viewModel.setProductFilter('out-of-stock')
      }, `Out of Stock (${(productStats.outOfStock || 0).toLocaleString()})`),
      Button({
        variant: productFilter === 'low-stock' ? 'primary' : 'outline',
        class: 'text-xs py-0.5 px-2 min-h-0',
        onClick: () => props.viewModel.setProductFilter('low-stock')
      }, `Low Stock (${(productStats.lowStock || 0).toLocaleString()})`)
    ]),

    // Search and Pagination Section
    Row({ class: 'sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-3 md:px-4 py-3 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex-1 min-w-[220px] max-w-md' }, [
        Row({ class: 'relative' }, [
          IonIcon({ 
            name: 'search-outline', 
            class: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl pointer-events-none' 
          }),
          Input({ 
            placeholder: 'Search products by code, name, or category...', 
            class: 'pl-10 pr-4',
            value: searchInputValue,
            onInput: handleSearchChange,
            // name: 'product-search-input',
            // id: 'product-search-input'
          })
        ])
      ]),
      Row({ class: 'flex items-center gap-3 ml-auto' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, "Rows per page"),
        SelectRelative({ 
          name: 'product-limit', 
          onChange: (e) => {
            const newLimit = parseInt(e.target.value);
            props.viewModel.setProductLimit(newLimit);
            props.viewModel.loadProducts();
          }, 
          value: tableConfig.limit
        },
          SelectOptions({ 
            options: ['10', '25', '50', '100'], 
            selectedOption: String(tableConfig.limit)
          })),
        Row({ tagType: 'p', }, "|"),
        Row({ class: 'inline-flex items-center gap-1' }, [
          Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, 
            totalRow > 0 ? `${initRow}-${Math.min(endRow, totalRow)} of ${totalRow}` : '0-0 of 0'
          ),
          IconButton({ 
            onClick: () => {
              props.viewModel.previousProductPage();
              props.viewModel.loadProducts();
            },
            disabled: tableConfig.offset <= 0
          }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ 
            onClick: () => {
              props.viewModel.nextProductPage();
              props.viewModel.loadProducts();
            },
            disabled: tableConfig.offset + tableConfig.limit >= totalRow
          }, [IonIcon({ name: 'caret-forward-outline' })])
        ]),
      ]),
    ]),
    
    // Products Table
    Row({ class: 'flex flex-col' }, [
      ProductTable(props, productList)
    ]),
    
    // Product Details Drawer
    productDrawerType === 'details' && selectedProduct && ProductDetails({ 
      product: selectedProduct, 
      showSlide: productDrawerOpen,
      onClose: () => props.viewModel.closeProductDrawer(),
      ...props 
    }),
    
    // Bin Card Drawer
    productDrawerType === 'bin-card' && selectedProduct && BinCardDrawer({ 
      product: selectedProduct, 
      showSlide: productDrawerOpen,
      onClose: () => props.viewModel.closeProductDrawer(),
      ...props 
    })
  ])
}

const LOW_STOCK_THRESHOLD_DEFAULT = 50; // Match API default; later: system_settings or per-product

const statusBadgeClass = 'w-fit inline-flex px-2 py-1 rounded-full text-xs font-medium';
function getProductStatusBadge(balance, lowThreshold = LOW_STOCK_THRESHOLD_DEFAULT) {
  const qty = balance != null ? Number(balance) : 0;
  if (qty === 0) return Row({ class: `${statusBadgeClass} bg-red-100 text-red-700` }, 'Out of Stock');
  if (qty < lowThreshold) return Row({ class: `${statusBadgeClass} bg-orange-100 text-orange-700` }, 'Low Stock');
  return Row({ class: `${statusBadgeClass} bg-green-100 text-green-700` }, 'In Stock');
}

function ProductTable(props, productList = []) {
  props.ensureLocalStateKey('actionId', null);
  props.ensureLocalStateKey('selectedRowId', null);
  const selectedRowId = props.getLocalState('selectedRowId')
  const actionId = props.getLocalState('actionId');

  const sortIcon = (column) => {
    const orderBy = props.viewModel.getState('product-table-config').orderBy;
    const sortBy = props.viewModel.getState('product-table-config').sortBy;
    if (column === sortBy ) {
      return IonIcon({ name: `${orderBy === 'asc' ? 'arrow-up-outline' : 'arrow-down-outline'}`, class: 'text-xs ml-2 font-semibold' });
    }
    return false;
  };
  
  return Table({ 
    class: 'flex flex-col',
    tableClass: 'min-w-[980px]',
    pageScrollable: true
  }, [
    TableHeader({ class: 'bg-white' }, [
      TableHCell({ class: `text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer`, onClick: () => props.viewModel.setProductSort('id') }, [
        'Code',
        sortIcon('id') // product_code and id are related
      ]),
      TableHCell({ class: `text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer`, onClick: () => props.viewModel.setProductSort('name') }, [
        'Description/Name',
        sortIcon('name')
      ]),
      TableHCell({ class: `text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer`, onClick: () => props.viewModel.setProductSort('category') }, [
        'Category',
        sortIcon('category')
      ]),
      TableHCell({ class: `text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer`, onClick: () => props.viewModel.setProductSort('unit') }, [
        'Unit',
        sortIcon('unit')
      ]),
      TableHCell({ class: `text-right text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer`, onClick: () => props.viewModel.setProductSort('balance') }, [
        'Balance',
        sortIcon('balance')
      ]),
      TableHCell({ class: `text-left text-xs font-semibold text-gray-500 uppercase tracking-wide` }, 'Status'),
      TableHCell({ class: `text-center text-xs font-semibold text-gray-500 uppercase tracking-wide` }, "Action"),      
    ]),
    TableBody({
      class: '',
      showEndMarker: productList.length > 0,
      endMarkerLabel: 'End of table',
      endMarkerColspan: 7
    }, 
      productList.map(row => TableRow({ key: row.id, class: `transition-colors duration-150 cursor-pointer ${selectedRowId === row.id ? 'bg-blue-50 border-l-2 border-indigo-500' : ''} hover:bg-blue-50` }, [
        TableDCell({ class: 'px-3 md:px-4 py-2 text-sm text-gray-900' }, row.product_code),
        TableDCell({ class: 'px-3 md:px-4 py-2 text-sm text-gray-900 max-w-[260px] lg:max-w-[380px] truncate', attributes: { title: row.description || row.name || '' } }, row.description || row.name),
        TableDCell({ class: 'px-3 md:px-4 py-2 text-sm text-gray-900 max-w-[160px] truncate', attributes: { title: row.category || '' } }, row.category),
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.unit),
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right font-medium' }, (row.balance != null ? row.balance : 0).toLocaleString()),
        TableDCell({ class: 'px-4 py-3 text-sm' }, getProductStatusBadge(row.balance, row.low_stock_threshold)),
        ActionDropdown({
          actionId: row.id,
          open: row.id === actionId,
          class: 'text-center',
          onToggle: () => props.setLocalState('actionId', actionId === row.id ? null : row.id),
          class: 'px-4 py-3'
        }, [
          ActionItem({
            label: 'View',
            icon: 'eye-outline',
            onClick: async () => {
              const hasPermission = await permissionChecker.checkPermission('CanSeeProductDetails', {
                actionName: 'view product details'
              });
              if (hasPermission) {
                props.setLocalState('selectedRowId', row.id);
                props.viewModel.openProductDrawer(row, 'details');
                props.setLocalState('actionId', null);
              } else {
                props.setLocalState('actionId', null);
              }
            }
          }),
          ActionItem({
            label: 'Bin Card', 
            icon: 'reader-outline',
            danger: false,
            onClick: async () => {
              const hasPermission = await permissionChecker.checkPermission('CanSeeProductDetails', {
                actionName: 'view bin card'
              });
              if (hasPermission) {
                props.setLocalState('selectedRowId', row.id);
                props.viewModel.openProductDrawer(row, 'bin-card');
                props.setLocalState('actionId', null);
              } else {
                props.setLocalState('actionId', null);
              }
            }
          }),
          ActionItem({
            label: 'Delete',
            icon: 'trash-outline',
            danger: true,
            onClick: async () => {
              const hasPermission = await permissionChecker.checkPermission('CanEditProductDetails', {
                actionName: 'delete products'
              });
              if (!hasPermission) {
                props.setLocalState('actionId', null);
                return;
              }

              const confirmed = await showConfirmation({
                title: 'Delete Product',
                message: `Are you sure you want to delete "${row.name}"? This action cannot be undone.`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                variant: 'danger',
                icon: 'trash-outline'
              });
              
              if (confirmed) {
                try {
                  await props.viewModel.deleteProduct(row.id);
                  props.setLocalState('actionId', null);
                } catch (error) {
                  // Error is handled by viewModel and displayed via error state
                  console.error('Error deleting product:', error);
                  props.setLocalState('actionId', null);
                }
              } else {
                props.setLocalState('actionId', null);
              }
            }
          })
        ]),

      ]))
    )
  ])
}

function ProductDetails({ product, showSlide, onClose, ...props }) {
  // Get form state from viewModel
  const productDetailsForm = props.viewModel.getState('product-details-form');
  const editMode = props.viewModel.getState('product-details-edit-mode');
  const productCode = product?.product_code || '';
  
  const productName = productDetailsForm.name || '';
  const productDescription = productDetailsForm.description || '';
  const productCategory = productDetailsForm.category || '';
  const productCategoryId = productDetailsForm.category_id || null;
  const productUnit = productDetailsForm.unit || '';
  const productUnitId = productDetailsForm.unit_id || null;
  const productExpiryThreshold = productDetailsForm.expiry_threshold || 30;
  
  // Get categories and units from ViewModel
  const categories = props.viewModel.getCategoryList();
  const units = props.viewModel.getUnitList();
  
  // Load categories and units if not already loaded
  if (categories.length === 0) {
    props.viewModel.loadCategories();
  }
  if (units.length === 0) {
    props.viewModel.loadUnits();
  }
  
  // Inline form states (UI-only, can stay local)
  props.ensureLocalStateKey('show-new-category-form', false);
  props.ensureLocalStateKey('new-category-name', '');
  props.ensureLocalStateKey('new-category-description', '');
  props.ensureLocalStateKey('show-new-unit-form', false);
  props.ensureLocalStateKey('new-unit-name', '');
  props.ensureLocalStateKey('new-unit-abbreviation', '');
  props.ensureLocalStateKey('new-unit-description', '');
  
  const showNewCategoryForm = props.getLocalState('show-new-category-form');
  const newCategoryName = props.getLocalState('new-category-name');
  const newCategoryDescription = props.getLocalState('new-category-description');
  const showNewUnitForm = props.getLocalState('show-new-unit-form');
  const newUnitName = props.getLocalState('new-unit-name');
  const newUnitAbbreviation = props.getLocalState('new-unit-abbreviation');
  const newUnitDescription = props.getLocalState('new-unit-description');

  const handleEdit = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanEditProductDetails', {
      actionName: 'edit products'
    });
    if (hasPermission) {
      props.viewModel.setProductDetailsEditMode(true);
    }
  };

  const handleCancel = () => {
    props.viewModel.setProductDetailsEditMode(false);
    // Close inline forms
    props.setLocalState('show-new-category-form', false);
    props.setLocalState('show-new-unit-form', false);
  };

  const handleSaveNewCategory = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanAddProduct', {
      actionName: 'create categories'
    });
    if (!hasPermission) {
      return;
    }

    try {
      const category = await props.viewModel.createCategory({
        name: newCategoryName,
        description: newCategoryDescription
      });
      // Add to category options and select it
      props.viewModel.updateProductDetailsFormFields({
        category: category.name,
        category_id: category.id
      });
      props.setLocalState('show-new-category-form', false);
      props.setLocalState('new-category-name', '');
      props.setLocalState('new-category-description', '');
    } catch (error) {
      // Error is handled by viewModel and displayed via error state
      console.error('Error creating category:', error);
    }
  };

  const handleCancelNewCategory = () => {
    props.setLocalState('show-new-category-form', false);
    props.setLocalState('new-category-name', '');
    props.setLocalState('new-category-description', '');
  };

  const handleSaveNewUnit = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanAddProduct', {
      actionName: 'create units'
    });
    if (!hasPermission) {
      return;
    }

    try {
      const unit = await props.viewModel.createUnit({
        name: newUnitName,
        abbreviation: newUnitAbbreviation
      });
      // Add to unit options and select it
      props.viewModel.updateProductDetailsFormFields({
        unit: unit.name,
        unit_id: unit.id
      });
      props.setLocalState('show-new-unit-form', false);
      props.setLocalState('new-unit-name', '');
      props.setLocalState('new-unit-abbreviation', '');
      props.setLocalState('new-unit-description', '');
    } catch (error) {
      // Error is handled by viewModel and displayed via error state
      console.error('Error creating unit:', error);
    }
  };

  const handleCancelNewUnit = () => {
    props.setLocalState('show-new-unit-form', false);
    props.setLocalState('new-unit-name', '');
    props.setLocalState('new-unit-abbreviation', '');
    props.setLocalState('new-unit-description', '');
  };

  const handleSave = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanEditProductDetails', {
      actionName: 'update products'
    });
    if (!hasPermission) {
      return;
    }

    try {
      // Read latest form from VM so Save isn't stale: `Input` uses the `change` event,
      // which for type="number" often fires on blur—clicks can submit before that.
      const form = props.viewModel.getState('product-details-form') || {};
      const categoryName = form.category || '';
      const categoryId = form.category_id || null;
      const unitName = form.unit || '';
      const unitId = form.unit_id || null;
      const rawExpiry = form.expiry_threshold;
      const expiryNum =
        rawExpiry === '' || rawExpiry === undefined || rawExpiry === null
          ? NaN
          : parseInt(String(rawExpiry), 10);
      const expiryThreshold = Number.isFinite(expiryNum) && expiryNum >= 1 ? expiryNum : 30;

      if (!(form.name ?? '').trim()) {
        throw new Error('Product name is required');
      }

      // Prepare product data with category_id and unit_id
      const productPayload = {
        name: (form.name ?? '').trim(),
        description: form.description || null,
        remark: form.remark || null,
        expiry_threshold: expiryThreshold
      };

      // Handle category_id - use existing ID, look up by name, or clear
      if (categoryId) {
        productPayload.category_id = parseInt(categoryId, 10);
      } else if (categoryName && categoryName.trim() !== '') {
        // Category name provided - look it up by name
        try {
          const result = await window.ipcRenderer.invoke('inventory:find-category-by-name', categoryName);
          if (result.success && result.category && result.category.id) {
            productPayload.category_id = parseInt(result.category.id, 10);
          } else {
            throw new Error(`Category "${categoryName}" not found`);
          }
        } catch (error) {
          throw new Error(`Failed to find category "${categoryName}": ${error.message || 'Unknown error'}`);
        }
      } else {
        productPayload.category_id = null;
      }

      // Handle unit_id - use existing ID, look up by name, or clear
      if (unitId) {
        productPayload.unit_id = parseInt(unitId, 10);
      } else if (unitName && unitName.trim() !== '') {
        // Unit name provided - look it up by name
        try {
          const result = await window.ipcRenderer.invoke('inventory:find-unit-by-name', unitName);
          if (result.success && result.unit && result.unit.id) {
            productPayload.unit_id = parseInt(result.unit.id, 10);
          } else {
            throw new Error(`Unit "${unitName}" not found`);
          }
        } catch (error) {
          throw new Error(`Failed to find unit "${unitName}": ${error.message || 'Unknown error'}`);
        }
      } else {
        productPayload.unit_id = null;
      }

      await props.viewModel.updateProduct(product.id, productPayload);
      props.viewModel.setProductDetailsEditMode(false);
      // List reload + selected-product sync happen inside updateProduct()
    } catch (error) {
      // Error is handled by viewModel and displayed via error state
      console.error('Error updating product:', error);
    }
  };

  return Drawer({ class: 'h-full overflow-y-auto flex flex-col', openSlide: showSlide }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: 'cube-outline', class: 'text-xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, editMode ? 'Edit Product' : 'Product Details'),
      ]),
      IconButton({ onClick: onClose, size: 'medium' }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),

    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Row({ class: 'flex flex-col gap-6 max-w-3xl' }, [
        // Product Information Section
        Row({ class: 'bg-gray-50 rounded-lg p-4 border border-gray-200' }, [
          Row({ class: 'text-sm font-semibold text-gray-700 mb-4' }, 'Product Information'),
          Row({ class: 'flex flex-col gap-6' }, [
            // Row 1: Product Code (full width, centered)
            Row({ class: 'flex justify-center' }, [
              Row({ class: 'w-full max-w-md' }, [
                DetailField({ 
                  label: 'Product Code', 
                  value: productCode || '-',
                  editMode: false, // Always read-only, system-assigned
                  inputProps: null
                })
              ])
            ]),
            // Row 2: Product Name and Description (2 columns)
            Row({ class: 'grid grid-cols-2 gap-6' }, [
              DetailField({ 
                label: 'Product Name *', 
                value: editMode ? null : (productName || '-'),
                editMode: editMode,
                inputProps: {
                  value: productName,
                  onChange: (e) => props.viewModel.updateProductDetailsForm('name', e.target.value),
                  name: 'product-name',
                  placeholder: 'Enter product name'
                }
              }),
              DetailField({ 
                label: 'Description', 
                value: editMode ? null : (productDescription || '-'),
                editMode: editMode,
                inputProps: {
                  value: productDescription,
                  onChange: (e) => props.viewModel.updateProductDetailsForm('description', e.target.value),
                  name: 'product-description',
                  placeholder: 'Enter description'
                }
              })
            ]),
            // Row 3: Category and Unit (2 columns)
            Row({ class: 'grid grid-cols-2 gap-6' }, [
              DetailField({ 
                label: 'Category', 
                value: editMode ? null : (productCategory || '-'),
                editMode: editMode,
                customInput: editMode ? Row({ class: 'flex flex-col gap-2' }, [
                  !showNewCategoryForm && Row({ class: 'flex items-center gap-2' }, [
                    SelectFluid({ 
                      name: 'product-category', 
                      containerClass: 'flex-1', 
                      value: productCategoryId ? String(productCategoryId) : '',
                      onChange: (e) => {
                        const categoryId = e.target.value;
                        if (categoryId !== '') {
                          const selectedCategory = categories.find(c => String(c.id) === categoryId);
                          if (selectedCategory) {
                            props.viewModel.updateProductDetailsFormFields({
                              category: selectedCategory.name,
                              category_id: selectedCategory.id
                            });
                          }
                        } else {
                          props.viewModel.updateProductDetailsFormFields({
                            category: '',
                            category_id: null
                          });
                        }
                      },
                      delegator: props.delegator
                    }, [
                      Row({ tagType: 'option', attributes: { value: '', selected: !productCategoryId } }, 'Select Category'),
                      ...categories.map(c => 
                        Row({ 
                          tagType: 'option', 
                          attributes: { 
                            value: String(c.id), 
                            selected: productCategoryId === c.id 
                          } 
                        }, c.name)
                      )
                    ]),
                    Button({ 
                      variant: 'outline', 
                      class: 'w-20 text-nowrap text-xs',
                      onClick: () => props.setLocalState('show-new-category-form', true)
                    }, '+ New')
                  ]),
                  showNewCategoryForm && NewCategoryForm({
                    name: newCategoryName,
                    description: newCategoryDescription,
                    onNameChange: (e) => props.setLocalState('new-category-name', e.target.value),
                    onDescriptionChange: (e) => props.setLocalState('new-category-description', e.target.value),
                    onSave: handleSaveNewCategory,
                    onCancel: handleCancelNewCategory
                  })
                ]) : null
              }),
              DetailField({ 
                label: 'Unit', 
                value: editMode ? null : (productUnit || '-'),
                editMode: editMode,
                customInput: editMode ? Row({ class: 'flex flex-col gap-2' }, [
                  !showNewUnitForm && Row({ class: 'flex items-center gap-2' }, [
                    SelectFluid({ 
                      name: 'product-unit', 
                      containerClass: 'flex-1', 
                      value: productUnitId ? String(productUnitId) : '',
                      onChange: (e) => {
                        const unitId = e.target.value;
                        if (unitId !== '') {
                          const selectedUnit = units.find(u => String(u.id) === unitId);
                          if (selectedUnit) {
                            props.viewModel.updateProductDetailsFormFields({
                              unit: selectedUnit.name,
                              unit_id: selectedUnit.id
                            });
                          }
                        } else {
                          props.viewModel.updateProductDetailsFormFields({
                            unit: '',
                            unit_id: null
                          });
                        }
                      },
                      delegator: props.delegator
                    }, [
                      Row({ tagType: 'option', attributes: { value: '', selected: !productUnitId } }, 'Select Unit'),
                      ...units.map(u => 
                        Row({ 
                          tagType: 'option', 
                          attributes: { 
                            value: String(u.id), 
                            selected: productUnitId === u.id 
                          } 
                        }, u.name)
                      )
                    ]),
                    Button({ 
                      variant: 'outline', 
                      class: 'w-20 text-nowrap text-xs',
                      onClick: () => props.setLocalState('show-new-unit-form', true)
                    }, '+ New')
                  ]),
                  showNewUnitForm && NewUnitForm({
                    name: newUnitName,
                    abbreviation: newUnitAbbreviation,
                    description: newUnitDescription,
                    onNameChange: (e) => props.setLocalState('new-unit-name', e.target.value),
                    onAbbreviationChange: (e) => props.setLocalState('new-unit-abbreviation', e.target.value),
                    onDescriptionChange: (e) => props.setLocalState('new-unit-description', e.target.value),
                    onSave: handleSaveNewUnit,
                    onCancel: handleCancelNewUnit
                  })
                ]) : null
              })
            ]),
            // Row 4: Expiry Threshold (full width)
            Row({ class: 'flex justify-center' }, [
              Row({ class: 'w-full max-w-md' }, [
                DetailField({ 
                  label: 'Expiry Threshold (Days)', 
                  value: editMode ? null : `${productExpiryThreshold || 30} days`,
                  editMode: editMode,
                  inputProps: {
                    type: 'number',
                    min: 1,
                    value: productExpiryThreshold || 30,
                    // `Input` wires `change` (often blur for number); sync on `input` so Save sees latest value.
                    onInput: (e) =>
                      props.viewModel.updateProductDetailsForm(
                        'expiry_threshold',
                        parseInt(e.target.value, 10) || 30
                      ),
                    onChange: (e) =>
                      props.viewModel.updateProductDetailsForm(
                        'expiry_threshold',
                        parseInt(e.target.value, 10) || 30
                      ),
                    name: 'expiry-threshold',
                    placeholder: 'Enter number of days'
                  }
                })
              ])
            ])
          ])
        ])
      ])
    ]),

    Row({ class: 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3' }, [
      editMode ? [
        Button({ variant: 'secondary', onClick: handleCancel, delegator: props.delegator }, 'Cancel'),
        Button({ variant: 'primary', onClick: handleSave, delegator: props.delegator }, 'Save Changes')
      ] : [
        Button({ variant: 'secondary', onClick: onClose, delegator: props.delegator }, 'Close'),
        Button({ 
          variant: 'primary', 
          onClick: handleEdit,
          delegator: props.delegator,
          class: 'flex items-center gap-2'
        }, [
          IonIcon({ name: 'create-outline', class: 'text-lg text-white' }),
          'Edit'
        ])
      ]
    ])
  ])
}

const formRow = ({ left, right }) => {
  return Row({ class: 'w-full flex justify-between items-start gap-4 mb-6' }, [
    Row({ class: 'flex-1/4 pt-2' }, left),
    Row({ class: 'flex-3/4' }, right)
  ]);
};

// Helper component for detail fields
function DetailField({ label, value, editMode, inputProps, customInput }) {
  return Row({ class: 'flex flex-col gap-1' }, [
    Row({ tagType: 'label', class: 'text-xs text-gray-500 font-medium' }, label),
    editMode ? (customInput || Input({ 
      class: 'w-full',
      ...inputProps 
    })) : Row({ class: 'text-sm font-medium text-gray-900' }, value || '-')
  ]);
}

// New Category Inline Form
function NewCategoryForm({ name, description, onNameChange, onDescriptionChange, onSave, onCancel }) {
  return Row({ class: 'bg-blue-50 border border-blue-200 rounded-lg p-4' }, [
    Row({ class: 'text-xs font-semibold text-blue-800 mb-3' }, 'Add New Category'),
    Row({ class: 'flex flex-col gap-3' }, [
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Category Name:'),
        Input({
          value: name,
          onChange: onNameChange,
          name: 'new-category-name',
          placeholder: 'Enter category name',
          class: 'w-full'
        })
      ]),
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Description:'),
        Input({
          value: description,
          onChange: onDescriptionChange,
          name: 'new-category-description',
          placeholder: 'Enter category description',
          class: 'w-full'
        })
      ]),
      Row({ class: 'flex items-center gap-2 justify-end mt-2' }, [
        Button({ 
          variant: 'secondary', 
          class: 'text-xs px-3 py-1',
          onClick: onCancel 
        }, 'Cancel'),
        Button({ 
          variant: 'primary', 
          class: 'text-xs px-3 py-1',
          onClick: onSave,
          disabled: !name || name.trim() === ''
        }, 'Save Category')
      ])
    ])
  ]);
}

// New Unit Inline Form
function NewUnitForm({ name, abbreviation, description, onNameChange, onAbbreviationChange, onDescriptionChange, onSave, onCancel }) {
  return Row({ class: 'bg-blue-50 border border-blue-200 rounded-lg p-4' }, [
    Row({ class: 'text-xs font-semibold text-blue-800 mb-3' }, 'Add New Unit'),
    Row({ class: 'flex flex-col gap-3' }, [
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Unit Name:'),
        Input({
          value: name,
          onChange: onNameChange,
          name: 'new-unit-name',
          placeholder: 'Enter unit name (e.g., Bottle)',
          class: 'w-full'
        })
      ]),
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Abbreviation:'),
        Input({
          value: abbreviation,
          onChange: onAbbreviationChange,
          name: 'new-unit-abbreviation',
          placeholder: 'Enter abbreviation (e.g., BTL)',
          class: 'w-full'
        })
      ]),
      Row({ class: 'flex flex-col gap-1' }, [
        Row({ tagType: 'label', class: 'text-xs text-gray-700 font-medium' }, 'Description:'),
        Input({
          value: description,
          onChange: onDescriptionChange,
          name: 'new-unit-description',
          placeholder: 'Enter unit description',
          class: 'w-full'
        })
      ]),
      Row({ class: 'flex items-center gap-2 justify-end mt-2' }, [
        Button({ 
          variant: 'secondary', 
          class: 'text-xs px-3 py-1',
          onClick: onCancel 
        }, 'Cancel'),
        Button({ 
          variant: 'primary', 
          class: 'text-xs px-3 py-1',
          onClick: onSave,
          disabled: !name || name.trim() === '' || !abbreviation || abbreviation.trim() === ''
        }, 'Save Unit')
      ])
    ])
  ]);
}

// Bin Card Drawer
function BinCardDrawer({ product, showSlide, onClose, ...props }) {
  // Get bin card transactions from ViewModel
  const binCardTransactions = props.viewModel.getBinCardTransactions();
  const binCardTotal = props.viewModel.getBinCardTotal();
  const binCardSearchQuery = props.viewModel.getState('bin-card-search-query') || '';
  const binCardFilter = props.viewModel.getState('bin-card-filter') || {
    transactionType: [],
    reason: '',
    dateFrom: '',
    dateTo: '',
    location: ''
  };
  const binCardTableConfig = props.viewModel.getState('bin-card-table-config') || {
    limit: 50,
    offset: 0,
    sortBy: 'transaction_date',
    orderBy: 'desc'
  };

  // Local state for search input and filter UI
  props.ensureLocalStateKey('searchInputValue', '');
  props.ensureLocalStateKey('searchTimeout', null);
  props.ensureLocalStateKey('filterReasonValue', '');
  props.ensureLocalStateKey('filterLocationValue', '');
  props.ensureLocalStateKey('filterTimeout', null);
  props.ensureLocalStateKey('showFilters', false);
  props.ensureLocalStateKey('showSortMenu', false);
  
  const searchInputValue = props.getLocalState('searchInputValue') || '';
  const filterReasonValue = props.getLocalState('filterReasonValue') || binCardFilter.reason || '';
  const filterLocationValue = props.getLocalState('filterLocationValue') || binCardFilter.location || '';
  const showFilters = props.getLocalState('showFilters');
  const showSortMenu = props.getLocalState('showSortMenu');

  // Transaction type options
  const transactionTypes = [
    { value: 'received', label: 'Received (IN)' },
    { value: 'issued', label: 'Issued (OUT)' },
    { value: 'adjustment', label: 'Adjustment' },
    { value: 'opening', label: 'Opening' },
    { value: 'return', label: 'Return' },
    { value: 'transfer_in', label: 'Transfer In' },
    { value: 'transfer_out', label: 'Transfer Out' },
    { value: 'expired', label: 'Expired' },
    { value: 'damaged', label: 'Damaged' },
    { value: 'voided', label: 'Voided' }
  ];

  // Sort options
  const sortOptions = [
    { value: 'transaction_date', label: 'Transaction Date' },
    { value: 'balance', label: 'Balance' },
    { value: 'quantity_in', label: 'Quantity In' },
    { value: 'quantity_out', label: 'Quantity Out' },
    { value: 'reason', label: 'Reason' },
    { value: 'batch_no', label: 'Batch Number' },
    { value: 'document_no', label: 'Document Number' },
    { value: 'location', label: 'Location' },
    { value: 'user_name', label: 'User' },
    { value: 'created_at', label: 'Created At' }
  ];

  const handleSearchFocusIn = () => {
    props.setLocalState('searchInputValue', binCardSearchQuery || '');
  };

  const handleSearchChange = (e) => {
    const newQuery = e.target.value;
    props.setLocalState('searchInputValue', newQuery);
    
    const existingTimeout = props.getLocalState('searchTimeout');
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    if (!newQuery || newQuery.trim() === '') {
      props.viewModel.updateBinCardSearchQuery('');
      props.viewModel.loadBinCards(product.id);
      props.setLocalState('searchTimeout', null);
      return;
    }
    
    const timeout = setTimeout(() => {
      props.viewModel.updateBinCardSearchQuery(newQuery);
      props.viewModel.loadBinCards(product.id);
      props.setLocalState('searchTimeout', null);
    }, 500);

    props.setLocalState('searchTimeout', timeout);
  };

  const handleFilterChange = (filterKey, value) => {
    const newFilter = { ...binCardFilter };
    if (filterKey === 'transactionType') {
      // Toggle transaction type in array
      const currentTypes = newFilter.transactionType || [];
      if (currentTypes.includes(value)) {
        newFilter.transactionType = currentTypes.filter(t => t !== value);
      } else {
        newFilter.transactionType = [...currentTypes, value];
      }
      // Apply immediately for transaction type (button clicks)
      props.viewModel.updateBinCardFilter(newFilter);
      props.viewModel.loadBinCards(product.id);
    } else if (filterKey === 'dateFrom' || filterKey === 'dateTo') {
      // Apply immediately for date filters
      newFilter[filterKey] = value;
      props.viewModel.updateBinCardFilter(newFilter);
      props.viewModel.loadBinCards(product.id);
    } else if (filterKey === 'reason' || filterKey === 'location') {
      // Debounce text input filters
      props.setLocalState(`filter${filterKey.charAt(0).toUpperCase() + filterKey.slice(1)}Value`, value);
      
      const existingTimeout = props.getLocalState('filterTimeout');
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      const timeout = setTimeout(() => {
        newFilter[filterKey] = value;
        props.viewModel.updateBinCardFilter(newFilter);
        props.viewModel.loadBinCards(product.id);
        props.setLocalState('filterTimeout', null);
      }, 500);
      
      props.setLocalState('filterTimeout', timeout);
    } else {
      newFilter[filterKey] = value;
      props.viewModel.updateBinCardFilter(newFilter);
      props.viewModel.loadBinCards(product.id);
    }
  };

  const handleSortChange = (sortBy, orderBy) => {
    props.viewModel.updateBinCardSort(sortBy, orderBy);
    props.viewModel.loadBinCards(product.id);
    props.setLocalState('showSortMenu', false);
  };

  const handleClearFilters = () => {
    const clearedFilter = {
      transactionType: [],
      reason: '',
      dateFrom: '',
      dateTo: '',
      location: ''
    };
    props.viewModel.updateBinCardFilter(clearedFilter);
    props.viewModel.updateBinCardSearchQuery('');
    props.setLocalState('searchInputValue', '');
    props.setLocalState('filterReasonValue', '');
    props.setLocalState('filterLocationValue', '');
    // Clear any pending filter timeout
    const existingTimeout = props.getLocalState('filterTimeout');
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      props.setLocalState('filterTimeout', null);
    }
    props.viewModel.loadBinCards(product.id);
  };

  const hasActiveFilters = () => {
    return binCardSearchQuery || 
           (binCardFilter.transactionType && binCardFilter.transactionType.length > 0) ||
           binCardFilter.reason ||
           binCardFilter.dateFrom ||
           binCardFilter.dateTo ||
           binCardFilter.location;
  };
  
  // Map database transaction types to display types
  const getTransactionTypeDisplay = (type) => {
    const typeMap = {
      'received': 'IN',
      'issued': 'OUT',
      'voided': 'VOID',
      'adjustment': 'ADJ',
      'opening': 'OPEN',
      'return': 'RET',
      'transfer_in': 'TRANSFER',
      'transfer_out': 'TRANSFER',
      'expired': 'EXP',
      'damaged': 'DAM'
    };
    return typeMap[type] || type.toUpperCase();
  };

  // Calculate quantity change (positive for in, negative for out)
  const getQuantityChange = (txn) => {
    if (txn.quantity_in > 0) return txn.quantity_in;
    if (txn.quantity_out > 0) return -txn.quantity_out;
    return 0;
  };

  // Get reason badge color based on reason type
  const getReasonBadgeColor = (reason) => {
    if (!reason) return 'bg-gray-100 text-gray-700 border-gray-200';
    
    const reasonLower = reason.toLowerCase();
    
    // Purchase/Import related
    if (reasonLower.includes('purchase') || reasonLower.includes('import') || reasonLower.includes('bulk')) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    // Sales related
    if (reasonLower.includes('sale') || reasonLower.includes('sell')) {
      return 'bg-purple-100 text-purple-700 border-purple-200';
    }
    // Borrow From (receiving from partner)
    if (reasonLower.includes('borrow from') || reasonLower.includes('receive borrow')) {
      return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    }
    // Borrow To (giving to partner)
    if (reasonLower.includes('borrow to')) {
      return 'bg-orange-100 text-orange-700 border-orange-200';
    }
    // Return Borrow From (returning items borrowed from partner)
    if (reasonLower.includes('return borrow from') || reasonLower.includes('return borrowed from')) {
      return 'bg-teal-100 text-teal-700 border-teal-200';
    }
    // Return Borrow To (receiving back items borrowed to partner)
    if (reasonLower.includes('return borrow to') || reasonLower.includes('receive borrow to')) {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    }
    // Found/Correction/Physical Count
    if (reasonLower.includes('found') || reasonLower.includes('correction') || reasonLower.includes('physical count') || reasonLower.includes('stock take')) {
      return 'bg-green-100 text-green-700 border-green-200';
    }
    // Lost/Damaged/Expired
    if (reasonLower.includes('lost') || reasonLower.includes('damaged') || reasonLower.includes('expired')) {
      return 'bg-red-100 text-red-700 border-red-200';
    }
    // Transfer
    if (reasonLower.includes('transfer')) {
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
    // Default
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return Drawer({ class: 'h-full overflow-y-auto flex flex-col', openSlide: showSlide }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: 'reader-outline', class: 'text-xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, 'Bin Card'),
      ]),
      IconButton({ onClick: onClose, size: 'medium' }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    Row({ class: 'px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex items-center gap-6 flex-wrap mb-3' }, [
        Row({ class: 'text-sm text-gray-600' }, [
          Row({ tagType: 'span', class: 'font-medium' }, 'Product: '),
          product.description || product.name
        ]),
        Row({ class: 'text-sm text-gray-600' }, [
          Row({ tagType: 'span', class: 'font-medium' }, 'Code: '),
          product.product_code
        ]),
        product.category && Row({ class: 'text-sm text-gray-600' }, [
          Row({ tagType: 'span', class: 'font-medium' }, 'Category: '),
          product.category
        ]),
        product.unit && Row({ class: 'text-sm text-gray-600' }, [
          Row({ tagType: 'span', class: 'font-medium' }, 'Unit: '),
          product.unit
        ])
      ]),
      // Search and Filter Controls
      Row({ class: 'flex items-center gap-3 flex-wrap' }, [
        // Search Input
        Row({ class: 'flex-1 min-w-[200px]' }, [
          Input({
            type: 'text',
            placeholder: 'Search by reason, batch, location, user...',
            value: searchInputValue,
            onFocus: handleSearchFocusIn,
            onInput: handleSearchChange,
            class: 'w-full'
          })
        ]),
        // Filter Button
        Button({
          variant: hasActiveFilters() ? 'primary' : 'outline',
          onClick: () => props.setLocalState('showFilters', !showFilters),
          class: 'flex items-center gap-2'
        }, [
          IonIcon({ name: 'filter-outline', class: 'text-sm' }),
          'Filter',
          hasActiveFilters() && Row({ class: 'ml-1 px-1.5 py-0.5 bg-white rounded text-xs' }, 
            (binCardFilter.transactionType?.length || 0) + 
            (binCardFilter.reason ? 1 : 0) + 
            (binCardFilter.dateFrom ? 1 : 0) + 
            (binCardFilter.dateTo ? 1 : 0) + 
            (binCardFilter.location ? 1 : 0)
          )
        ]),
        // Sort Button with Dropdown
        Row({ class: 'relative' }, [
          Button({
            variant: 'outline',
            onClick: () => props.setLocalState('showSortMenu', !showSortMenu),
            class: 'flex items-center gap-2'
          }, [
            IonIcon({ name: 'swap-vertical-outline', class: 'text-sm' }),
            'Sort'
          ]),
          // Sort Menu (dropdown)
          showSortMenu && Row({ 
            class: 'absolute top-full right-0 mt-2 p-2 bg-white rounded-lg border border-gray-200 shadow-lg z-10 min-w-[200px]',
            events: {
              click: (e) => e.stopPropagation() // Prevent clicks inside menu from closing it
            }
          }, [
            Row({ class: 'text-xs font-medium text-gray-500 mb-2 px-2' }, 'Sort By'),
            ...sortOptions.map((option, idx) => {
              const isSelected = binCardTableConfig.sortBy === option.value;
              const isAsc = isSelected && binCardTableConfig.orderBy === 'asc';
              const isDesc = isSelected && binCardTableConfig.orderBy === 'desc';
              return Row({
                key: `sort-option-${option.value}-${idx}`,
                class: `px-3 py-2 cursor-pointer hover:bg-gray-50 rounded ${isSelected ? 'bg-indigo-50' : ''}`,
                events: { 
                  click: () => handleSortChange(
                    option.value, 
                    isSelected && isDesc ? 'asc' : 'desc'
                  )
                }
              }, [
                Row({ class: 'flex items-center justify-between' }, [
                  Row({ class: 'text-sm' }, option.label),
                  isSelected && IonIcon({ 
                    name: isAsc ? 'chevron-up-outline' : 'chevron-down-outline', 
                    class: 'text-sm text-indigo-600' 
                  })
                ])
              ]);
            })
          ])
        ]),
        // Clear Filters Button (only show if filters are active)
        hasActiveFilters() && Button({
          variant: 'outline',
          onClick: handleClearFilters,
          class: 'text-red-600 hover:text-red-700'
        }, 'Clear')
      ]),
      // Filter Panel (collapsible)
      showFilters && Row({ class: 'mt-4 p-4 bg-white rounded-lg border border-gray-200' }, [
        Row({ class: 'grid grid-cols-2 gap-4' }, [
          // Transaction Type Filter
          Row({ class: 'flex flex-col' }, [
            Row({ class: 'text-sm font-medium text-gray-700 mb-2' }, 'Transaction Type'),
            Row({ class: 'flex flex-wrap gap-2' }, 
              transactionTypes.map(type => {
                const isSelected = binCardFilter.transactionType?.includes(type.value);
                return Button({
                  variant: isSelected ? 'primary' : 'outline',
                  onClick: () => handleFilterChange('transactionType', type.value),
                  class: 'text-xs px-2 py-1'
                }, type.label);
              })
            )
          ]),
          // Reason Filter
          Row({ class: 'flex flex-col' }, [
            Row({ class: 'text-sm font-medium text-gray-700 mb-2' }, 'Reason'),
            Input({
              type: 'text',
              placeholder: 'Filter by reason...',
              value: filterReasonValue,
              onInput: (e) => handleFilterChange('reason', e.target.value),
              class: 'w-full'
            })
          ]),
          // Date From Filter
          Row({ class: 'flex flex-col' }, [
            Row({ class: 'text-sm font-medium text-gray-700 mb-2' }, 'Date From'),
            Input({
              type: 'date',
              value: binCardFilter.dateFrom || '',
              onInput: (e) => handleFilterChange('dateFrom', e.target.value),
              class: 'w-full'
            })
          ]),
          // Date To Filter
          Row({ class: 'flex flex-col' }, [
            Row({ class: 'text-sm font-medium text-gray-700 mb-2' }, 'Date To'),
            Input({
              type: 'date',
              value: binCardFilter.dateTo || '',
              onInput: (e) => handleFilterChange('dateTo', e.target.value),
              class: 'w-full'
            })
          ]),
          // Location Filter
          Row({ class: 'flex flex-col col-span-2' }, [
            Row({ class: 'text-sm font-medium text-gray-700 mb-2' }, 'Location'),
            Input({
              type: 'text',
              placeholder: 'Filter by location...',
              value: filterLocationValue,
              onInput: (e) => handleFilterChange('location', e.target.value),
              class: 'w-full'
            })
          ])
        ])
      ]),
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-4' }, [
      binCardTransactions.length === 0 
        ? Row({ class: 'flex items-center justify-center py-12' }, [
            Row({ class: 'text-sm text-gray-500' }, 'No bin card transactions found for this product')
          ])
        : Row({ class: 'flex flex-col gap-3' }, 
            binCardTransactions.map((txn, idx) => {
              const typeDisplay = getTransactionTypeDisplay(txn.transaction_type);
              const quantityChange = getQuantityChange(txn);
              const transactionDate = formatDateDDMMYYYY(txn.transaction_date);
              const isIn = quantityChange > 0;
              const typeColorClass = 
                typeDisplay === 'IN' || typeDisplay === 'OPEN' || typeDisplay === 'TRANSFER' ? 'bg-green-100 text-green-700 border-green-200' :
                typeDisplay === 'OUT' || typeDisplay === 'EXP' || typeDisplay === 'DAM' ? 'bg-red-100 text-red-700 border-red-200' :
                typeDisplay === 'ADJ' || typeDisplay === 'RET' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                'bg-gray-100 text-gray-700 border-gray-200';
              
              return Card({ 
                key: txn.id || idx, 
                class: 'border border-gray-200 hover:shadow-md transition-shadow' 
              }, [
                Row({ class: 'p-3' }, [
                  // Header row: Date, Type badge, and Balance badge
                  Row({ class: 'flex items-center justify-between mb-2' }, [
                    Row({ class: 'flex items-center gap-2' }, [
                      Row({ class: 'text-xs font-medium text-gray-500' }, transactionDate),
                      Row({ class: `px-2 py-0.5 rounded text-xs font-semibold border ${typeColorClass}` }, typeDisplay)
                    ]),
                    Row({ class: `px-2 py-0.5 rounded text-xs font-semibold border bg-indigo-100 text-indigo-700 border-indigo-200` }, 
                      `Balance: ${txn.balance || 0}`
                    )
                  ]),
                  
                  // Reason badge (full width if present)
                  txn.reason && Row({ class: 'mb-2' }, [
                    Row({ class: `px-2 py-0.5 rounded text-xs font-semibold border inline-block ${getReasonBadgeColor(txn.reason)}` }, txn.reason)
                  ]),
                  
                  // Quantity change row
                  Row({ class: 'flex items-center gap-2 mb-2' }, [
                    Row({ class: 'text-xs text-gray-500' }, 'Quantity:'),
                    Row({ 
                      class: `text-sm font-semibold ${isIn ? 'text-green-600' : 'text-red-600'}` 
                    }, isIn ? `+${quantityChange}` : quantityChange)
                  ]),
                  
                  // Details grid: Reference, Location, Batch, User (3 columns)
                  Row({ class: 'grid grid-cols-3 gap-2 text-xs' }, [
                    txn.document_no || txn.reference_table ? Row({ class: 'flex flex-col' }, [
                      Row({ class: 'text-gray-500 mb-0.5' }, 'Reference'),
                      Row({ class: 'text-gray-900 font-medium truncate' }, txn.document_no || txn.reference_table)
                    ]) : null,
                    txn.location ? Row({ class: 'flex flex-col' }, [
                      Row({ class: 'text-gray-500 mb-0.5' }, 'Location'),
                      Row({ class: 'text-gray-900 font-medium truncate' }, txn.location)
                    ]) : null,
                    txn.batch_no ? Row({ class: 'flex flex-col' }, [
                      Row({ class: 'text-gray-500 mb-0.5' }, 'Batch'),
                      Row({ class: 'text-gray-900 font-medium truncate' }, txn.batch_no)
                    ]) : null,
                    txn.user_name ? Row({ class: 'flex flex-col' }, [
                      Row({ class: 'text-gray-500 mb-0.5' }, 'User'),
                      Row({ class: 'text-gray-900 font-medium truncate' }, txn.user_name)
                    ]) : null
                  ].filter(Boolean))
                ])
              ]);
            })
          )
    ]),
    Row({ class: 'px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3' }, [
      // Pagination Controls (IconButtons only)
      IconButton({
        onClick: () => {
          props.viewModel.previousBinCardPage();
          props.viewModel.loadBinCards(product.id);
        },
        disabled: binCardTableConfig.offset <= 0,
        size: 'medium'
      }, [
        IonIcon({ name: 'chevron-back-outline', class: 'text-xl' })
      ]),
      IconButton({
        onClick: () => {
          props.viewModel.nextBinCardPage();
          props.viewModel.loadBinCards(product.id);
        },
        disabled: binCardTableConfig.offset + binCardTableConfig.limit >= binCardTotal,
        size: 'medium'
      }, [
        IonIcon({ name: 'chevron-forward-outline', class: 'text-xl' })
      ]),
      // Actions
      Button({ 
        variant: 'outline', 
        onClick: async () => {
          try {
            await props.viewModel.exportBinCards(product.id);
          } catch (error) {
            console.error('Export failed:', error);
            // Error is already handled in ViewModel and shown via toast
          }
        },
        class: 'flex items-center gap-2'
      }, [
        IonIcon({ name: 'download-outline', class: 'text-sm' }),
        'Export CSV'
      ]),
      Button({ variant: 'secondary', onClick: onClose }, 'Close')
    ])
  ])
}

async function openAddProductModal(props) {
  props.viewModel.resetProductForm();
  await props.viewModel.loadCategories();
  await props.viewModel.loadUnits();
  Modal({}, (delegator, closeHandler) => ModalContent(props.viewModel, delegator, closeHandler));
}

function openImportProductsModal(props) {
  Modal({}, (delegator, closeHandler) => ImportModalContent(props.viewModel, delegator, closeHandler)) 
}

async function handleExportCSV(props) {
  try {
    await props.viewModel.exportProducts();
  } catch (error) {
    console.error('Export failed:', error);
    // Error is already handled in ViewModel and shown via toast
  }
}

export { formRow}