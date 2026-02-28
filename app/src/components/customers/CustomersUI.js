import { Button, Spinner } from "../utils/Button";
import { Input } from "../utils/Input";
import { SelectFluid, SelectOptions, SelectRelative } from "../utils/Select";
import { IconButton } from "../utils/Icon";
import { IonIcon } from "../utils/Icon";
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from "../utils/Table";
import { ActionDropdown, ActionItem } from "../utils/Action";
import Drawer from "../shared/ExampleDrawer";
import { CardHeader, Card, CardBody } from "../utils/Card";
import Modal from "../shared/Modal";
import ModalContent from "./CreateCustomerModal";
import ImportModalContent from "./ImportCustomersModal";
import { showConfirmation } from "../utils/ModalHelpers";
import { permissionChecker } from "../utils/PermissionChecker";
import { CustomersVM } from "./CustomersVM";

const { Row, StatefulRow } = Liteframe;

export function CustomersUI() {
  const viewModel = new CustomersVM();

  const render = (props) => {
    return Row({ class: 'w-full h-full flex flex-col overflow-hidden'}, [
      CardHeader({ class: 'px-6 text-gray-900 text-md font-semibold flex items-center h-12 flex-shrink-0' }, 'Customer Management'),
      CardBody({ class: 'p-6 flex flex-col overflow-hidden flex-1 min-h-0'}, [
        CustomersContent(props)
      ])
    ])
  } 

  return StatefulRow({ class: 'w-full h-full overflow-hidden', viewModel, stateKeys: ['loading', 'customer-drawer-open', 'customer-drawer-type', 'selected-customer', 'customer-details-edit-mode', 'customer-form']}, render)
}

function CustomersContent(props) {
  // Get data from viewModel state
  const tableConfig = props.viewModel.getState('customer-table-config');
  const initRow = parseInt(tableConfig.offset) + 1;
  let endRow = initRow + parseInt(tableConfig.limit) - 1;
  const totalRow = props.viewModel.getState('customer-total-count');

  const loading = props.viewModel.getState('loading');
  const customerList = props.viewModel.getCustomerList();
  const searchQuery = props.viewModel.getState('customer-search-query');
  
  // Get drawer state from viewModel
  const selectedCustomer = props.viewModel.getState('selected-customer');
  const customerDrawerType = props.viewModel.getState('customer-drawer-type');
  const customerDrawerOpen = props.viewModel.getState('customer-drawer-open');
  
  // Local state for UI concerns
  props.ensureLocalStateKey('selectedRowId', null);
  props.ensureLocalStateKey('searchTimeout', null);
  props.ensureLocalStateKey('searchInputValueInitialized', false);
  
  const selectedRowId = props.getLocalState('selectedRowId');
  const searchInputValueInitialized = props.getLocalState('searchInputValueInitialized');

  const handleSearchFocusIn = () => {
    props.setLocalState('searchInputValue', searchQuery || '');
    props.setLocalState('searchInputValueInitialized', true);
  }

  const handleSearchFocusOut = () => {
    props.setLocalState('searchInputValueInitialized', false);
  }
  
  const searchInputValue = props.getLocalState('searchInputValue') || '';

  let timeout;

  const handleSearchChange = (e) => {
    const newQuery = e.target.value;
    
    // Update local state immediately for input value
    props.setLocalState('searchInputValue', newQuery);
    
    // Clear existing timeout
    if (timeout) {
      clearTimeout(timeout);
    }
    
    // If search is cleared, update ViewModel and reload immediately
    if (!newQuery || newQuery.trim() === '') {
      props.viewModel.updateCustomerSearchQuery('');
      props.viewModel.loadCustomers();
      timeout = null;
      return;
    }
    
    // Debounce: wait 500ms after user stops typing
    timeout = setTimeout(() => {
      props.viewModel.updateCustomerSearchQuery(newQuery);
      props.viewModel.loadCustomers();
      timeout = null;
    }, 500);
  };

  const sortIcon = (column) => {
    const orderBy = props.viewModel.getState('customer-table-config').orderBy;
    const sortBy = props.viewModel.getState('customer-table-config').sortBy;
    if (column === sortBy) {
      return IonIcon({ 
        name: orderBy === 'asc' ? 'chevron-up-outline' : 'chevron-down-outline', 
        class: 'text-sm text-indigo-600 ml-1' 
      });
    }
    return null;
  };

  return Row({ class: 'w-full flex-1 flex flex-col overflow-hidden'}, [
    !searchInputValueInitialized && loading && customerList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0 px-6' }, 'Loading customers...'),
    !searchInputValueInitialized && !loading && customerList.length === 0 && Row({ class: 'py-6 text-sm text-gray-500 flex-shrink-0 px-6' }, 'No customers found'),
    
    // Header Section with Actions
    Row({ class: 'flex items-center justify-between gap-6 p-6 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-4' }, [
        Button({ 
          variant: 'primary', 
          class: 'text-nowrap flex items-center gap-2',
          onClick: async () => {
            const hasPermission = await permissionChecker.checkPermission('CanAddCustomer', {
              actionName: 'add customers'
            });
            if (hasPermission) {
              openAddCustomerModal(props);
            }
          }
        }, [
          IonIcon({ name: 'add-outline', class: 'text-lg text-white' }),
          'Add Customer'
        ]),
        Button({ 
          variant: 'outline', 
          class: 'text-nowrap flex items-center gap-2',
          onClick: async () => {
            const hasPermission = await permissionChecker.checkPermission('CanImportCustomers', {
              actionName: 'import customers'
            });
            if (hasPermission) {
              openImportCustomersModal(props);
            }
          }
        }, [
          IonIcon({ name: 'cloud-upload-outline', class: 'text-lg' }),
          'Import Customers'
        ]),
      ]),
      Button({ 
        variant: 'secondary', 
        class: 'text-nowrap flex items-center gap-2',
        onClick: async () => {
          const hasPermission = await permissionChecker.checkPermission('CanExportCustomers', {
            actionName: 'export customers'
          });
          if (hasPermission) {
            handleExportCSV(props);
          }
        },
        disabled: loading
      }, [
        loading ? Spinner({ class: 'text-lg' }) : IonIcon({ name: 'download-outline', class: 'text-lg' }),
        loading ? 'Exporting...' : 'Export CSV'
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
            placeholder: 'Search customers by name, contact, phone, email...', 
            class: 'pl-10 pr-4',
            value: searchInputValue,
            onInput: handleSearchChange,
            focusIn: handleSearchFocusIn,
            focusOut: handleSearchFocusOut,
          })
        ])
      ]),
      Row({ class: 'flex items-center gap-4' }, [
        Row({ tagType: 'p', class: 'text-sm text-gray-400 text-nowrap' }, "Rows per page"),
        SelectRelative({ 
          name: 'customer-limit', 
          onChange: (e) => {
            const newLimit = parseInt(e.target.value);
            props.viewModel.setCustomerLimit(newLimit);
            props.viewModel.loadCustomers();
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
              props.viewModel.previousCustomerPage();
              props.viewModel.loadCustomers();
            },
            disabled: tableConfig.offset <= 0
          }, [IonIcon({ name: 'caret-back-outline' })]),
          IconButton({ 
            onClick: () => {
              props.viewModel.nextCustomerPage();
              props.viewModel.loadCustomers();
            },
            disabled: tableConfig.offset + tableConfig.limit >= totalRow
          }, [IonIcon({ name: 'caret-forward-outline' })])
        ]),
      ]),
    ]),
    
    // Customers Table
    Row({ class: 'flex-1 flex flex-col min-h-0 overflow-hidden' }, [
      CustomerTable(props)
    ]),
    
    // Customer Details Drawer
    customerDrawerType === 'details' && selectedCustomer && CustomerDetailsDrawer({ 
      customer: selectedCustomer, 
      showSlide: customerDrawerOpen,
      onClose: () => props.viewModel.closeCustomerDrawer(),
      ...props 
    })
  ])
}

function CustomerTable(props) {
  const customerList = props.viewModel.getCustomerList();
  props.ensureLocalStateKey('actionId', null);
  props.ensureLocalStateKey('selectedRowId', null);
  const selectedRowId = props.getLocalState('selectedRowId')
  const actionId = props.getLocalState('actionId');

  const sortIcon = (column) => {
    const orderBy = props.viewModel.getState('customer-table-config').orderBy;
    const sortBy = props.viewModel.getState('customer-table-config').sortBy;
    if (column === sortBy) {
      return IonIcon({ 
        name: orderBy === 'asc' ? 'chevron-up-outline' : 'chevron-down-outline', 
        class: 'text-sm text-indigo-600 ml-1' 
      });
    }
    return null;
  };

  const handleRowClick = (customer) => {
    props.setLocalState('selectedRowId', customer.id);
    props.viewModel.openCustomerDrawer(customer, 'details');
  };

  const handleView = async (customer) => {
    const hasPermission = await permissionChecker.checkPermission('CanSeeCustomers', {
      actionName: 'view customers'
    });
    if (!hasPermission) {
      return;
    }
    props.setLocalState('actionId', null);
    props.setLocalState('selectedRowId', customer.id);
    props.viewModel.openCustomerDrawer(customer, 'details');
  };

  const handleDelete = async (customer) => {
    const hasPermission = await permissionChecker.checkPermission('CanDeleteCustomer', {
      actionName: 'delete customers'
    });
    if (!hasPermission) {
      return;
    }

    const confirmed = await showConfirmation({
      title: 'Delete Customer',
      message: `Are you sure you want to delete "${customer.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      try {
        await props.viewModel.deleteCustomer(customer.id);
        props.setLocalState('actionId', null);
        if (selectedRowId === customer.id) {
          props.viewModel.closeCustomerDrawer();
        }
      } catch (error) {
        // Error is handled by viewModel
      }
    }
  };

  return Table({ 
    class: 'flex-1 min-h-0', 
    id: 'customers-table',
  }, [
    TableHeader({class: 'sticky top-0 z-10 bg-white'}, [
      TableHCell({ 
        class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', 
        onClick: () => {
          const config = props.viewModel.getState('customer-table-config');
          props.viewModel.setCustomerSort('id', config.orderBy === 'asc' ? 'desc' : 'asc');
          props.viewModel.loadCustomers();
        }
      }, [
        'ID',
        sortIcon('id')
      ]),
      TableHCell({ 
        class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', 
        onClick: () => {
          const config = props.viewModel.getState('customer-table-config');
          props.viewModel.setCustomerSort('name', config.orderBy === 'asc' ? 'desc' : 'asc');
          props.viewModel.loadCustomers();
        }
      }, [
        'Name',
        sortIcon('name')
      ]),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Contact Person'),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Phone'),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Email'),
      TableHCell({ 
        class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-50', 
        onClick: () => {
          const config = props.viewModel.getState('customer-table-config');
          props.viewModel.setCustomerSort('customer_type', config.orderBy === 'asc' ? 'desc' : 'asc');
          props.viewModel.loadCustomers();
        }
      }, [
        'Type',
        sortIcon('customer_type')
      ]),
      TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase tracking-wide' }, 'Actions')
    ]),
    TableBody({}, [
      ...customerList.map(customer => {
        const isSelected = selectedRowId === customer.id;
        return TableRow({
          class: `transition-colors duration-150 cursor-pointer ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'}`,
          onClick: () => handleRowClick(customer),
        }, [
          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, customer.id),
          TableDCell({ class: 'px-4 py-3 text-sm font-medium text-gray-900' }, customer.name),
          TableDCell({ class: 'px-4 py-3 text-sm text-gray-600' }, customer.contact_person || '—'),
          TableDCell({ class: 'px-4 py-3 text-sm text-gray-600' }, customer.phone || '—'),
          TableDCell({ class: 'px-4 py-3 text-sm text-gray-600' }, customer.email || '—'),
          TableDCell({ class: 'px-4 py-3 text-sm' }, [
            Row({ 
              class: `px-2 py-1 rounded text-xs font-semibold inline-block ${
                customer.customer_type === 'supplier' ? 'bg-blue-100 text-blue-700' :
                customer.customer_type === 'retailer' ? 'bg-green-100 text-green-700' :
                customer.customer_type === 'both' ? 'bg-purple-100 text-purple-700' :
                'bg-gray-100 text-gray-700'
              }` 
            }, capitalizeCustomerType(customer.customer_type) || 'Supplier')
          ]),
          TableDCell({ class: 'px-4 py-3' }, [
            ActionDropdown({
              actionId: customer.id,
              open: actionId === customer.id,
              onToggle: () => props.setLocalState('actionId', actionId === customer.id ? null : customer.id),
              class: 'text-center'
            }, [
              ActionItem({
                icon: 'eye-outline',
                label: 'View',
                onClick: () => handleView(customer)
              }),
              ActionItem({
                icon: 'trash-outline',
                label: 'Delete',
                onClick: () => handleDelete(customer),
                danger: true
              })
            ])
          ])
        ])
      })
    ]),
  ]);
}

// Helper function to capitalize customer type
const capitalizeCustomerType = (type) => {
  if (!type) return '-';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

// Customer Details Drawer
function CustomerDetailsDrawer({ customer, showSlide, onClose, ...props }) {
  // Get customer from state to ensure we have the latest data
  const currentCustomer = props.viewModel.getState('selected-customer') || customer;
  const customerForm = props.viewModel.getState('customer-form');
  const editMode = props.viewModel.getState('customer-details-edit-mode');
  const loading = props.viewModel.getState('loading');

  const handleEdit = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanEditCustomer', {
      actionName: 'edit customers'
    });
    if (!hasPermission) {
      return;
    }
    props.viewModel.setCustomerDetailsEditMode(true);
  };

  const handleSave = async () => {
    const hasPermission = await permissionChecker.checkPermission('CanEditCustomer', {
      actionName: 'edit customers'
    });
    if (!hasPermission) {
      return;
    }

    if (!currentCustomer || !currentCustomer.id) {
      console.error('[CustomerDetailsDrawer] handleSave - Customer ID is missing. Current customer:', currentCustomer);
      return;
    }

    try {
      await props.viewModel.updateCustomer(currentCustomer.id, customerForm);
      props.viewModel.setCustomerDetailsEditMode(false);
    } catch (error) {
      // Error is handled by viewModel
      console.error('[CustomerDetailsDrawer] handleSave - Error saving customer:', error);
    }
  };

  const handleCancel = () => {
    // Reset form to original customer data from state
    const customerToUse = currentCustomer || customer;
    props.viewModel.updateState('customer-form', {
      name: customerToUse.name || '',
      contact_person: customerToUse.contact_person || '',
      phone: customerToUse.phone || '',
      email: customerToUse.email || '',
      address: customerToUse.address || '',
      license_no: customerToUse.license_no || '',
      tin_no: customerToUse.tin_no || '',
      website: customerToUse.website || '',
      fax: customerToUse.fax || '',
      country: customerToUse.country || '',
      customer_type: customerToUse.customer_type || ''
    });
    props.viewModel.setCustomerDetailsEditMode(false);
  };

  // Helper component for detail fields (cleaner pattern)
  function DetailField({ label, value, editMode = false, inputType = 'text', onChange, name, customInput, inputProps }) {
    return Row({ class: 'flex flex-col gap-1' }, [
      Row({ tagType: 'label', class: 'text-xs text-gray-500 font-medium' }, label),
      editMode ? (customInput || Input({ 
        class: 'w-full',
        ...(inputProps || { type: inputType, value: value || '', onChange, name })
      })) : Row({ class: 'text-sm font-medium text-gray-900' }, value || '-')
    ]);
  }

  return Drawer({ class: 'h-full overflow-y-auto flex flex-col', openSlide: showSlide }, [
    CardHeader({ class: 'px-6 flex items-center justify-between h-12 border-b border-gray-200' }, [
      Row({ class: 'flex items-center gap-3' }, [
        IonIcon({ name: 'person-outline', class: 'text-xl text-indigo-600' }),
        Row({ class: 'text-lg font-semibold text-gray-800' }, editMode ? 'Edit Customer' : 'Customer Details'),
      ]),
      IconButton({ onClick: onClose, size: 'medium' }, [
        IonIcon({ name: 'close-outline', class: 'text-xl' })
      ])
    ]),
    Row({ class: 'flex-1 overflow-y-auto p-6' }, [
      Row({ class: 'flex flex-col gap-6 max-w-3xl' }, [
        // Main Card - Customer Name as Header in View Mode
        Row({ class: 'bg-gray-50 rounded-lg p-6 border border-gray-200' }, [
          // Customer Name Header (View Mode) or Title (Edit Mode)
          editMode ? (
            Row({ class: 'text-sm font-semibold text-gray-700 mb-6' }, 'Customer Information')
          ) : (
            Row({ class: 'text-2xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-300' }, 
              customerForm.name || 'Customer'
            )
          ),
          
          Row({ class: 'flex flex-col gap-6' }, [
            // In edit mode, show customer name field first (full width)
            editMode && Row({ class: 'flex justify-center' }, [
              Row({ class: 'w-full max-w-md' }, [
                DetailField({ 
                  label: 'Customer Name', 
                  value: null,
                  editMode: true,
                  inputProps: {
                    value: customerForm.name || '',
                    onChange: (e) => props.viewModel.updateCustomerForm('name', e.target.value),
                    name: 'customer-name',
                    placeholder: 'Enter customer name'
                  }
                })
              ])
            ]),

            // Basic Information Section
            Row({ class: 'bg-white rounded-lg p-4 border border-gray-200' }, [
              Row({ class: 'text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4' }, 'Basic Information'),
              Row({ class: 'flex flex-col gap-4' }, [
                !editMode && Row({ class: 'grid grid-cols-2 gap-6' }, [
                  DetailField({ 
                    label: 'Contact Person', 
                    value: customerForm.contact_person || '-',
                    editMode: false
                  }),
                  DetailField({ 
                    label: 'Customer Type', 
                    value: capitalizeCustomerType(customerForm.customer_type),
                    editMode: false
                  })
                ]),
                editMode && Row({ class: 'grid grid-cols-2 gap-6' }, [
                  DetailField({ 
                    label: 'Contact Person', 
                    value: null,
                    editMode: true,
                    inputProps: {
                      value: customerForm.contact_person || '',
                      onChange: (e) => props.viewModel.updateCustomerForm('contact_person', e.target.value),
                      name: 'contact-person',
                      placeholder: 'Enter contact person'
                    }
                  }),
                  DetailField({ 
                    label: 'Customer Type', 
                    value: null,
                    editMode: true,
                    customInput: SelectFluid({
                      name: 'customer-type',
                      value: customerForm.customer_type || '',
                      onChange: (e) => props.viewModel.updateCustomerForm('customer_type', e.target.value)
                    }, [
                      Row({ tagType: 'option', attributes: { value: '', selected: !customerForm.customer_type, disabled: true } }, 'Select Customer Type'),
                      Row({ tagType: 'option', attributes: { value: 'supplier', selected: customerForm.customer_type === 'supplier' } }, 'Supplier'),
                      Row({ tagType: 'option', attributes: { value: 'retailer', selected: customerForm.customer_type === 'retailer' } }, 'Retailer'),
                      Row({ tagType: 'option', attributes: { value: 'both', selected: customerForm.customer_type === 'both' } }, 'Both'),
                      Row({ tagType: 'option', attributes: { value: 'other', selected: customerForm.customer_type === 'other' } }, 'Other')
                    ])
                  })
                ])
              ])
            ]),

            // Contact Information Section
            Row({ class: 'bg-white rounded-lg p-4 border border-gray-200' }, [
              Row({ class: 'text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4' }, 'Contact Information'),
              Row({ class: 'flex flex-col gap-4' }, [
                Row({ class: 'grid grid-cols-2 gap-6' }, [
                  DetailField({ 
                    label: 'Phone', 
                    value: editMode ? null : (customerForm.phone || '-'),
                    editMode: editMode,
                    inputType: 'tel',
                    inputProps: {
                      value: customerForm.phone || '',
                      onChange: (e) => props.viewModel.updateCustomerForm('phone', e.target.value),
                      name: 'phone',
                      placeholder: 'Enter phone number'
                    }
                  }),
                  DetailField({ 
                    label: 'Email', 
                    value: editMode ? null : (customerForm.email || '-'),
                    editMode: editMode,
                    inputType: 'email',
                    inputProps: {
                      value: customerForm.email || '',
                      onChange: (e) => props.viewModel.updateCustomerForm('email', e.target.value),
                      name: 'email',
                      placeholder: 'Enter email address'
                    }
                  })
                ]),
                Row({ class: 'flex justify-center' }, [
                  Row({ class: 'w-full max-w-md' }, [
                    DetailField({ 
                      label: 'Address', 
                      value: editMode ? null : (customerForm.address || '-'),
                      editMode: editMode,
                      inputProps: {
                        value: customerForm.address || '',
                        onChange: (e) => props.viewModel.updateCustomerForm('address', e.target.value),
                        name: 'address',
                        placeholder: 'Enter address'
                      }
                    })
                  ])
                ])
              ])
            ]),

            // Business Information Section
            Row({ class: 'bg-white rounded-lg p-4 border border-gray-200' }, [
              Row({ class: 'text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4' }, 'Business Information'),
              Row({ class: 'flex flex-col gap-4' }, [
                Row({ class: 'grid grid-cols-2 gap-6' }, [
                  DetailField({ 
                    label: 'License No', 
                    value: editMode ? null : (customerForm.license_no || '-'),
                    editMode: editMode,
                    inputProps: {
                      value: customerForm.license_no || '',
                      onChange: (e) => props.viewModel.updateCustomerForm('license_no', e.target.value),
                      name: 'license-no',
                      placeholder: 'Enter license number'
                    }
                  }),
                  DetailField({ 
                    label: 'TIN No', 
                    value: editMode ? null : (customerForm.tin_no || '-'),
                    editMode: editMode,
                    inputProps: {
                      value: customerForm.tin_no || '',
                      onChange: (e) => props.viewModel.updateCustomerForm('tin_no', e.target.value),
                      name: 'tin-no',
                      placeholder: 'Enter TIN number'
                    }
                  })
                ]),
                Row({ class: 'grid grid-cols-2 gap-6' }, [
                  DetailField({ 
                    label: 'Website', 
                    value: editMode ? null : (customerForm.website || '-'),
                    editMode: editMode,
                    inputType: 'url',
                    inputProps: {
                      value: customerForm.website || '',
                      onChange: (e) => props.viewModel.updateCustomerForm('website', e.target.value),
                      name: 'website',
                      placeholder: 'Enter website URL'
                    }
                  }),
                  DetailField({ 
                    label: 'Fax', 
                    value: editMode ? null : (customerForm.fax || '-'),
                    editMode: editMode,
                    inputProps: {
                      value: customerForm.fax || '',
                      onChange: (e) => props.viewModel.updateCustomerForm('fax', e.target.value),
                      name: 'fax',
                      placeholder: 'Enter fax number'
                    }
                  })
                ]),
                Row({ class: 'flex justify-center' }, [
                  Row({ class: 'w-full max-w-md' }, [
                    DetailField({ 
                      label: 'Country', 
                      value: editMode ? null : (customerForm.country || '-'),
                      editMode: editMode,
                      inputProps: {
                        value: customerForm.country || '',
                        onChange: (e) => props.viewModel.updateCustomerForm('country', e.target.value),
                        name: 'country',
                        placeholder: 'Enter country'
                      }
                    })
                  ])
                ])
              ])
            ])
          ])
        ])
      ])
    ]),
    Row({ class: 'px-6 py-4 border-t border-gray-200 flex justify-end gap-3' }, [
      editMode ? [
        Button({ variant: 'secondary', onClick: handleCancel, disabled: loading }, 'Cancel'),
        Button({ 
          variant: 'primary', 
          onClick: handleSave, 
          disabled: loading 
        }, loading ? [Spinner(), ' Saving...'] : 'Save Changes')
      ] : [
        Button({ variant: 'secondary', onClick: onClose }, 'Close'),
        Button({ 
          variant: 'primary', 
          onClick: handleEdit,
          class: 'flex items-center gap-2'
        }, [
          IonIcon({ name: 'create-outline', class: 'text-lg' }),
          'Edit'
        ])
      ]
    ])
  ])
}

function openAddCustomerModal(props) {
  // Clear the form before opening the modal
  props.viewModel.resetCustomerForm();
  Modal({}, (delegator, closeHandler) => ModalContent(props.viewModel, delegator, closeHandler)) 
}

function openImportCustomersModal(props) {
  Modal({}, (delegator, closeHandler) => ImportModalContent(props.viewModel, delegator, closeHandler)) 
}

async function handleExportCSV(props) {
  try {
    await props.viewModel.exportCustomers();
  } catch (error) {
    console.error('Export failed:', error);
    // Error is already handled in ViewModel and shown via toast
  }
}
