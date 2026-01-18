import { Button } from "../../../utils/Button";
import { Input } from "../../../utils/Input";
import { SelectFluid, SelectOptions, SelectRelative } from "../../../utils/Select";
import { IconButton } from "../../../utils/Icon";
import { IonIcon } from "../../../utils/Icon";
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from "../../../utils/Table";
import Dropdown from "../../../utils/Dropdown";
import { ActionDropdown, ActionItem } from "../../../utils/Action";
import Drawer from "../../../shared/ExampleDrawer";
import { CardHeader } from "../../../utils/Card";
import { DropdownSearch } from "../../../utils/DropdownSearch";
import Modal from "../../../shared/Modal";
import ModalContent from "../CreateProductModal";
import ImportModalContent from "../ImportProductsModal";

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
  
  // Get drawer state from viewModel
  const selectedProduct = props.viewModel.getState('selected-product');
  const productDrawerType = props.viewModel.getState('product-drawer-type');
  const productDrawerOpen = props.viewModel.getState('product-drawer-open');
  
  // Local state only for UI concerns (selected row highlighting for table, search debounce)
  // Use local state for search input value to avoid re-render issues with ViewModel state
  props.ensureLocalStateKey('selectedRowId', null);
  props.ensureLocalStateKey('searchTimeout', null);
  
  // Initialize search input value only once, then keep it in sync manually
  const searchInputValueInitialized = props.getLocalState('searchInputValueInitialized');
  if (!searchInputValueInitialized) {
    props.setLocalState('searchInputValue', searchQuery || '');
    props.setLocalState('searchInputValueInitialized', true);
  }
  
  const selectedRowId = props.getLocalState('selectedRowId');
  const searchInputValue = props.getLocalState('searchInputValue') || '';

  const handleSearchChange = (e) => {
    const newQuery = e.target.value;
    console.log('newQuery', newQuery);
    // Update local state immediately for input value
    props.setLocalState('searchInputValue', newQuery);
    // Update ViewModel state for actual search
    props.viewModel.updateProductSearchQuery(newQuery);
    
    // Clear existing timeout
    const existingTimeout = props.getLocalState('searchTimeout');
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    console.log('product-limit', tableConfig.limit);
    
    // If search is cleared, reload immediately
    if (!newQuery || newQuery.trim() === '') {
      props.viewModel.loadProducts();
      props.setLocalState('searchTimeout', null);
      return;
    }
    
    // Debounce: wait 500ms after user stops typing before searching
    const timeout = setTimeout(() => {
      props.viewModel.loadProducts();
      props.setLocalState('searchTimeout', null);
    }, 500);
    
    props.setLocalState('searchTimeout', timeout);
  };

  return Row({ class: 'w-full flex-1 flex flex-col overflow-hidden'}, [
    loading && productList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0 px-6' }, 'Loading products...'),
    !loading && productList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0 px-6' }, 'No products found'),
    
    // Header Section with Actions
    Row({ class: 'flex items-center justify-between gap-6 p-6 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-4' }, [
        Button({ 
          variant: 'primary', 
          class: 'text-nowrap flex items-center gap-2',
          onClick: () => openAddProductModal(props)
        }, [
          IonIcon({ name: 'add-outline', class: 'text-lg text-white' }),
          'Add Product'
        ]),
        Button({ 
          variant: 'outline', 
          class: 'text-nowrap flex items-center gap-2',
          onClick: () => openImportProductsModal(props)
        }, [
          IonIcon({ name: 'cloud-upload-outline', class: 'text-lg' }),
          'Import Products'
        ]),
      ]),
      Button({ 
        variant: 'secondary', 
        class: 'text-nowrap flex items-center gap-2',
        onClick: () => handleExportCSV(props)
      }, [
        IonIcon({ name: 'download-outline', class: 'text-lg' }),
        'Export CSV'
      ])
    ]),

    // Search and Pagination Section
    Row({ class: 'flex items-center justify-between gap-6 px-6 py-4 border-b border-gray-200 bg-gray-50' }, [
      Row({ class: 'flex-1 max-w-md' }, [
        Row({ class: 'relative' }, [
          IonIcon({ 
            name: 'search-outline', 
            class: 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl pointer-events-none' 
          }),
          Input({ 
            placeholder: 'Search products by code, name, or category...', 
            class: 'pl-10 pr-4',
            value: searchInputValue,
            onInput: handleSearchChange
          })
        ])
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, "Rows per page"),
        SelectRelative({ 
          name: 'product-limit', 
          onChange: (e) => {
            const newLimit = parseInt(e.target.value);
            console.log('Limit changed:', newLimit);
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
    Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }, [
      ProductTable(props)
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

function ProductTable(props) {
  const productList = props.viewModel.getProductList();
  props.ensureLocalStateKey('actionId', null);
  props.ensureLocalStateKey('selectedRowId', null);
  const selectedRowId = props.getLocalState('selectedRowId')
  const actionId = props.getLocalState('actionId');
  return Table({ 
    class: 'flex-1 flex flex-col min-h-0', 
    getOpenActionState: () => props.getLocalState('actionId'), 
    setOpenActionState: () => props.setLocalState('actionId', null)  
  }, [
    TableHeader({ class: 'sticky top-0 z-10' }, [ // 'sticky top-12 z-10 mb-10'
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Code"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Description/Name"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Category"),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Unit"),
      TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase tracking-wide' }, "Action"),      
    ]),
    TableBody({ class: 'flex-1 overflow-y-auto'}, 
      productList.map(row => TableRow({ class: `transition-colors duration-150 cursor-pointer ${selectedRowId === row.id ? 'bg-blue-50 border-l-2 border-indigo-500' : ''} hover:bg-blue-50` }, [
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.product_code),
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.description || row.name),
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.category),
        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.unit),
        ActionDropdown({
          actionId: row.id,
          open: row.id === actionId,
          class: 'text-center',
          onToggle: () => props.setLocalState('actionId', actionId === row.id ? null : row.id),
          class: 'px-4 py-3'
        }, [
          ActionItem({
            label: 'Edit',
            icon: 'create-outline',
            onClick: () => {
              props.setLocalState('selectedRowId', row.id);
              props.viewModel.openProductDrawer(row, 'details');
              props.setLocalState('actionId', null);
            }
          }),
          ActionItem({
            label: 'Bin Card', 
            icon: 'reader-outline',
            danger: false,
            onClick: () => {
              props.setLocalState('selectedRowId', row.id);
              props.viewModel.openProductDrawer(row, 'bin-card');
              props.setLocalState('actionId', null);
            }
          }),
          // ActionItem({
          //   label: 'Delete',
          //   danger: true,
          //   onClick: () => {
          //     // deactivateUser(product);
          //     props.setLocalState('actionId', null)
          //     // viewModel.updateState('openActionId', null);
          //   }
          // })
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
  const productUnit = productDetailsForm.unit || '';
  
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

  const handleEdit = () => {
    props.viewModel.setProductDetailsEditMode(true);
  };

  const handleCancel = () => {
    props.viewModel.setProductDetailsEditMode(false);
    // Close inline forms
    props.setLocalState('show-new-category-form', false);
    props.setLocalState('show-new-unit-form', false);
  };

  const handleSaveNewCategory = () => {
    // Handle saving new category
    console.log('Saving new category:', {
      name: newCategoryName,
      description: newCategoryDescription
    });
    // Add to category options and select it
    props.viewModel.updateProductDetailsForm('category', newCategoryName);
    props.setLocalState('show-new-category-form', false);
    props.setLocalState('new-category-name', '');
    props.setLocalState('new-category-description', '');
  };

  const handleCancelNewCategory = () => {
    props.setLocalState('show-new-category-form', false);
    props.setLocalState('new-category-name', '');
    props.setLocalState('new-category-description', '');
  };

  const handleSaveNewUnit = () => {
    // Handle saving new unit
    console.log('Saving new unit:', {
      name: newUnitName,
      abbreviation: newUnitAbbreviation,
      description: newUnitDescription
    });
    // Add to unit options and select it
    props.viewModel.updateProductDetailsForm('unit', newUnitName);
    props.setLocalState('show-new-unit-form', false);
    props.setLocalState('new-unit-name', '');
    props.setLocalState('new-unit-abbreviation', '');
    props.setLocalState('new-unit-description', '');
  };

  const handleCancelNewUnit = () => {
    props.setLocalState('show-new-unit-form', false);
    props.setLocalState('new-unit-name', '');
    props.setLocalState('new-unit-abbreviation', '');
    props.setLocalState('new-unit-description', '');
  };

  const handleSave = async () => {
    try {
      await props.viewModel.updateProduct(product.id, {
        name: productName,
        description: productDescription,
        category: productCategory,
        unit: productUnit
        // Note: productCode is system-assigned and not editable
      });
      props.setLocalState('edit-mode', false);
    } catch (error) {
      // Error is handled by viewModel and displayed via error state
      console.error('Error updating product:', error);
    }
    // onClose(); // Optionally close after save
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
                label: 'Product Name', 
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
                      value: productCategory,
                      onChange: (e) => props.viewModel.updateProductDetailsForm('category', e.target.value),
                      delegator: props.delegator
                    }, SelectOptions({ 
                      options: ['Regent', 'Supplies'], 
                      selectedOption: productCategory
                    })),
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
                      value: productUnit,
                      onChange: (e) => props.viewModel.updateProductDetailsForm('unit', e.target.value),
                      delegator: props.delegator
                    }, SelectOptions({ 
                      options: ['Bottle', 'PK', 'Kit', 'Box', 'Unit'], 
                      selectedOption: productUnit
                    })),
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
          IonIcon({ name: 'create-outline', class: 'text-lg' }),
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
  // Mock bin card transactions - these would come from API for the product
  const binCardTransactions = [
    { date: '2025-01-15', type: 'IN', reference: 'PO-001', quantity: 100, balance: 100, location: 'A-01', batch: 'B001', expiryDate: '2025-06-15', user: 'John Doe' },
    { date: '2025-01-20', type: 'OUT', reference: 'IS-001', quantity: -25, balance: 75, location: 'A-01', batch: 'B001', expiryDate: '2025-06-15', user: 'Jane Smith' },
    { date: '2025-01-25', type: 'IN', reference: 'PO-002', quantity: 50, balance: 125, location: 'B-03', batch: 'B002', expiryDate: '2025-08-20', user: 'John Doe' },
    { date: '2025-02-01', type: 'OUT', reference: 'IS-002', quantity: -30, balance: 95, location: 'A-01', batch: 'B001', expiryDate: '2025-06-15', user: 'Jane Smith' },
    { date: '2025-02-05', type: 'ADJ', reference: 'ADJ-001', quantity: 5, balance: 100, location: 'A-01', batch: 'B001', expiryDate: '2025-06-15', user: 'Admin' },
    { date: '2025-02-10', type: 'TRANSFER', reference: 'TR-001', quantity: -20, balance: 80, location: 'A-01', batch: 'B001', expiryDate: '2025-06-15', user: 'John Doe', toLocation: 'C-02' },
    { date: '2025-02-10', type: 'TRANSFER', reference: 'TR-001', quantity: 20, balance: 20, location: 'C-02', batch: 'B001', expiryDate: '2025-06-15', user: 'John Doe', fromLocation: 'A-01' },
  ];

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
      Row({ class: 'flex items-center gap-6 flex-wrap' }, [
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
      ])
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Table({ class: 'w-full' }, [
        TableHeader({}, [
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Date'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Type'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Reference'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Location'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Batch'),
          TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase' }, 'Quantity'),
          TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase' }, 'Balance'),
          TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'User')
        ]),
        TableBody({}, 
          binCardTransactions.map((txn, idx) => 
            TableRow({ key: idx }, [
              TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, txn.date),
              TableDCell({ class: 'px-4 py-3 text-sm' }, [
                Row({ class: `px-2 py-1 rounded text-xs font-medium ${
                  txn.type === 'IN' ? 'bg-green-100 text-green-700' :
                  txn.type === 'OUT' ? 'bg-red-100 text-red-700' :
                  txn.type === 'TRANSFER' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }` }, txn.type)
              ]),
              TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, txn.reference),
              TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, 
                txn.toLocation ? `${txn.location} → ${txn.toLocation}` : 
                txn.fromLocation ? `${txn.fromLocation} → ${txn.location}` :
                txn.location
              ),
              TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, txn.batch || '-'),
              TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right font-medium' }, 
                txn.quantity > 0 ? `+${txn.quantity}` : txn.quantity
              ),
              TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right font-semibold' }, txn.balance),
              TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, txn.user)
            ])
          )
        )
      ])
    ]),
    Row({ class: 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3' }, [
      Button({ variant: 'outline', onClick: () => {} }, 'Export'),
      Button({ variant: 'secondary', onClick: onClose }, 'Close')
    ])
  ])
}

function openAddProductModal(props) {
  Modal({}, (delegator, closeHandler) => ModalContent(props.viewModel, delegator, closeHandler)) 
}

function openImportProductsModal(props) {
  Modal({}, (delegator, closeHandler) => ImportModalContent(props.viewModel, delegator, closeHandler)) 
}

function handleExportCSV(props) {
  // Get current table config (filters, search, pagination)
  const tableConfig = props.viewModel.getState('table-config');
  const searchQuery = props.getLocalState('search-query') || '';
  
  // Build query parameters
  const params = new URLSearchParams({
    limit: tableConfig.limit || 1000, // Export more rows for CSV
    offset: tableConfig.offset || 0,
    search: searchQuery,
    format: 'csv'
  });
  
  // Create download URL
  // TODO: Replace with actual API base URL from config
  const apiBaseUrl = 'http://localhost:4000'; // This should come from app config
  const exportUrl = `${apiBaseUrl}/api/products/export?${params.toString()}`;
  
  // Create a temporary anchor element to trigger download
  const link = document.createElement('a');
  link.href = exportUrl;
  link.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export { formRow}