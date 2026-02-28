const { ViewModel, SharedStateManager } = Liteframe;
import { permissionChecker } from '../utils/PermissionChecker';

export class CustomersVM extends ViewModel {
  constructor(sharedStateManager = new SharedStateManager()) {
    super(sharedStateManager);
    this.initializeState();
    // Load user permissions on initialization
    this.loadUserPermissions();
    // Load initial data
    this.loadCustomers();
  }

  async loadUserPermissions() {
    try {
      await permissionChecker.loadPermissions();
    } catch (error) {
      console.error('Failed to load user permissions:', error);
    }
  }

  initializeState() {
    // UI State
    this.setState('loading', false);
    this.setState('error', null);
    this.setState('success', null);

    // Customers State
    this.setState('customer-list', []);
    this.setState('customer-total-count', 0);
    this.setState('customer-table-config', {
      limit: 10,
      offset: 0,
      sortBy: 'id',
      orderBy: 'desc'
    });
    this.setState('customer-search-query', '');
    this.setState('customer-form', {
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      license_no: '',
      tin_no: '',
      website: '',
      fax: '',
      country: '',
      customer_type: ''
    });

    // Drawer States
    this.setState('selected-customer', null);
    this.setState('customer-drawer-type', null); // 'details', 'edit'
    this.setState('customer-drawer-open', false);
    this.setState('customer-details-edit-mode', false);
  }

  // ==================== Customers Methods ====================

  async loadCustomers() {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const tableConfig = this.getState('customer-table-config');
      const searchQuery = this.getState('customer-search-query');
      
      const result = await window.ipcRenderer.invoke('customers:get-customers', {
        limit: tableConfig.limit,
        offset: tableConfig.offset,
        search: searchQuery,
        sortBy: tableConfig.sortBy,
        orderBy: tableConfig.orderBy
      });

      if (result.success) {
        this.updateState('customer-list', result.customers || []);
        this.updateState('customer-total-count', result.total || 0);
        return result.customers;
      }

      throw new Error(result.error || 'Failed to load customers');
    } finally {
      this.updateState('loading', false);
    }
  }

  async createCustomer(customerData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('customers:create-customer', customerData);

      if (result.success) {
        this.updateState('success', { message: 'Customer created successfully' });
        // Set loading to false so loadCustomers() can run
        this.updateState('loading', false);
        // Reload customers list
        await this.loadCustomers();
        return result.customer;
      }

      throw new Error(result.error || 'Failed to create customer');
    } catch (error) {
      console.error('Error creating customer:', error);
      this.updateState('error', { message: error.message || 'Failed to create customer' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async updateCustomer(customerId, customerData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    const payload = {
      id: customerId,
      ...customerData
    };

    try {
      const result = await window.ipcRenderer.invoke('customers:update-customer', payload);

      if (result.success) {
        this.updateState('success', { message: 'Customer updated successfully' });
        
        // Update the selected customer with the updated data
        const currentSelectedCustomer = this.getState('selected-customer');
        if (currentSelectedCustomer && currentSelectedCustomer.id === customerId && result.customer) {
          this.updateState('selected-customer', {
            ...currentSelectedCustomer,
            ...result.customer
          });
          // Also update the form with the new values
          this.updateState('customer-form', {
            name: result.customer.name || '',
            contact_person: result.customer.contact_person || '',
            phone: result.customer.phone || '',
            email: result.customer.email || '',
            address: result.customer.address || '',
            license_no: result.customer.license_no || '',
            tin_no: result.customer.tin_no || '',
            website: result.customer.website || '',
            fax: result.customer.fax || '',
            country: result.customer.country || '',
            customer_type: result.customer.customer_type || ''
          });
        }
        
        // Set loading to false so loadCustomers() can run
        this.updateState('loading', false);
        // Reload customers list
        await this.loadCustomers();
        return result.customer;
      }

      console.error('[CustomersVM] updateCustomer - Failed:', result.error);
      throw new Error(result.error || 'Failed to update customer');
    } catch (error) {
      console.error('[CustomersVM] updateCustomer - Error:', error);
      this.updateState('error', { message: error.message || 'Failed to update customer' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async deleteCustomer(customerId) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('customers:delete-customer', customerId);

      if (result.success) {
        this.updateState('success', { message: 'Customer deleted successfully' });
        // Set loading to false so loadCustomers() can run
        this.updateState('loading', false);
        // Reload customers list
        await this.loadCustomers();
        return true;
      }

      throw new Error(result.error || 'Failed to delete customer');
    } catch (error) {
      console.error('Error deleting customer:', error);
      this.updateState('error', { message: error.message || 'Failed to delete customer' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async bulkImportCustomers(customers) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('customers:bulk-import-customers', { customers });

      if (result.success) {
        this.updateState('success', { 
          message: `Successfully imported ${result.summary?.successful || 0} customer(s)` 
        });
        // Reload customers list
        await this.loadCustomers();
        return result;
      }

      throw new Error(result.error || 'Failed to import customers');
    } catch (error) {
      console.error('Error importing customers:', error);
      this.updateState('error', { message: error.message || 'Failed to import customers' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async exportCustomers() {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const tableConfig = this.getState('customer-table-config');
      const searchQuery = this.getState('customer-search-query');
      
      const result = await window.ipcRenderer.invoke('customers:export-customers', {
        limit: 10000, // Export all matching records
        offset: 0,
        search: searchQuery,
        sortBy: tableConfig.sortBy,
        orderBy: tableConfig.orderBy
      });

      if (result.success && result.csvContent) {
        // Create a blob and download
        const blob = new Blob([result.csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `customers_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.updateState('success', { message: 'Customers exported successfully' });
        return result;
      }

      throw new Error(result.error || 'Failed to export customers');
    } catch (error) {
      console.error('Error exporting customers:', error);
      this.updateState('error', { message: error.message || 'Failed to export customers' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  updateCustomerSearchQuery(query) {
    this.updateState('customer-search-query', query);
    // Reset to first page when searching
    this.updateState('customer-table-config', {
      ...this.getState('customer-table-config'),
      offset: 0
    });
  }

  setCustomerLimit(limit) {
    const tableConfig = this.getState('customer-table-config');
    this.updateState('customer-table-config', {
      ...tableConfig,
      limit: parseInt(limit),
      offset: 0 // Reset to first page
    });
  }

  setCustomerSort(sortBy, orderBy) {
    this.updateState('customer-table-config', {
      ...this.getState('customer-table-config'),
      sortBy,
      orderBy,
      offset: 0 // Reset to first page when sorting
    });
  }

  nextCustomerPage() {
    const tableConfig = this.getState('customer-table-config');
    const totalCount = this.getState('customer-total-count');
    
    if (tableConfig.offset + tableConfig.limit >= totalCount) return;
    
    this.updateState('customer-table-config', {
      ...tableConfig,
      offset: tableConfig.offset + tableConfig.limit
    });
  }

  previousCustomerPage() {
    const tableConfig = this.getState('customer-table-config');
    
    if (tableConfig.offset <= 0) return;
    
    this.updateState('customer-table-config', {
      ...tableConfig,
      offset: Math.max(0, tableConfig.offset - tableConfig.limit)
    });
  }

  openCustomerDrawer(customer, drawerType = 'details') {
    // First: Set drawer type and item (drawer appears in DOM with openSlide: false)
    this.updateState('selected-customer', customer);
    this.updateState('customer-drawer-type', drawerType);
    this.updateState('customer-drawer-open', false);
    this.updateState('loading', true); // Trigger re-render to mount drawer in DOM
    
    // Populate form with customer data
    if (customer) {
      this.updateState('customer-form', {
        name: customer.name || '',
        contact_person: customer.contact_person || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        license_no: customer.license_no || '',
        tin_no: customer.tin_no || '',
        website: customer.website || '',
        fax: customer.fax || '',
        country: customer.country || '',
        customer_type: customer.customer_type || ''
      });
      this.updateState('customer-details-edit-mode', false);
    }
    
    // After drawer is in DOM, trigger slide animation
    setTimeout(() => {
      this.updateState('customer-drawer-open', true);
      this.updateState('loading', false); // Trigger re-render to show slide animation
    }, 10);
  }

  closeCustomerDrawer() {
    // First: Set openSlide to false (triggers slide-out animation)
    this.updateState('customer-drawer-open', false);
    this.updateState('loading', true); // Trigger re-render to start slide-out animation
    
    // After animation completes, remove drawer from DOM
    setTimeout(() => {
      this.updateState('selected-customer', null);
      this.updateState('customer-drawer-type', null);
      this.updateState('customer-details-edit-mode', false);
      this.updateState('loading', false); // Trigger re-render to remove drawer from DOM
    }, 300);
  }

  setCustomerDetailsEditMode(editMode) {
    this.updateState('customer-details-edit-mode', editMode);
  }

  updateCustomerForm(key, value) {
    const form = this.getState('customer-form');
    this.updateState('customer-form', {
      ...form,
      [key]: value
    });
    // Trigger re-render
    this.updateState('loading', true);
    setTimeout(() => {
      this.updateState('loading', false);
    }, 0);
  }

  resetCustomerForm() {
    this.updateState('customer-form', {
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      license_no: '',
      tin_no: '',
      website: '',
      fax: '',
      country: '',
      customer_type: ''
    });
    // Trigger re-render
    this.updateState('loading', true);
    setTimeout(() => {
      this.updateState('loading', false);
    }, 0);
  }

  // ==================== Utility Methods ====================

  getCustomerList() {
    return this.getState('customer-list');
  }
}
