import { ipcMain } from "electron";
import CustomersManager from "./customers.js";
import { getToken } from "../config/authManager.js";

const customersManager = new CustomersManager();

export function CustomersIpcHandlers() {
  
  // Get customers
  ipcMain.handle('customers:get-customers', async (event, params) => {
    return await customersManager.getCustomers(params, getToken());
  });

  // Create customer
  ipcMain.handle('customers:create-customer', async (event, customerData) => {
    return await customersManager.createCustomer(customerData, getToken());
  });

  // Update customer
  ipcMain.handle('customers:update-customer', async (event, customerData) => {
    const { id, ...updateData } = customerData;
    return await customersManager.updateCustomer(id, updateData, getToken());
  });

  // Delete customer
  ipcMain.handle('customers:delete-customer', async (event, customerId) => {
    return await customersManager.deleteCustomer(customerId, getToken());
  });

  // Bulk import customers (CSV upload — server parse)
  ipcMain.handle('customers:bulk-import-customers-upload', async (event, { fileBuffer, fileName }) => {
    return await customersManager.bulkImportCustomersUpload(fileBuffer, fileName, getToken());
  });

  // Bulk import customers (JSON)
  ipcMain.handle('customers:bulk-import-customers', async (event, { customers }) => {
    return await customersManager.bulkImportCustomers(customers, getToken());
  });

  // Export customers
  ipcMain.handle('customers:export-customers', async (event, params) => {
    return await customersManager.exportCustomers(params, getToken());
  });
}
