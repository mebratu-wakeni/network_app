import { ipcMain } from "electron";
import PurchaseManager from "./purchase.js";
import { getToken } from "../config/authManager.js";

const purchaseManager = new PurchaseManager();

export function PurchaseIpcHandlers() {
  
  // Product & Supplier Lookup IPC Handlers
  ipcMain.handle('purchase:get-products', async (event, searchParams) => {
    return await purchaseManager.getProducts(searchParams, getToken());
  });

  ipcMain.handle('purchase:get-suppliers', async (event, searchParams) => {
    return await purchaseManager.getSuppliers(searchParams, getToken());
  });

  ipcMain.handle('purchase:get-withhold-percentage', async (event) => {
    return await purchaseManager.getWithholdPercentage(getToken());
  });

  // Purchase Orders IPC Handlers
  ipcMain.handle('purchase:create-order', async (event, orderData) => {
    return await purchaseManager.createOrder(orderData, getToken());
  });

  ipcMain.handle('purchase:get-orders', async (event, searchParams) => {
    return await purchaseManager.getOrders(searchParams, getToken());
  });

  ipcMain.handle('purchase:get-order-by-id', async (event, orderId) => {
    return await purchaseManager.getOrderById(orderId, getToken());
  });

  ipcMain.handle('purchase:get-order-receipt', async (event, orderId) => {
    return await purchaseManager.getOrderReceipt(orderId, getToken());
  });

  ipcMain.handle('purchase:pay-order', async (event, { orderId, paymentData }) => {
    return await purchaseManager.payOrder(orderId, paymentData, getToken());
  });

  ipcMain.handle('purchase:reverse-order', async (event, { orderId, reverseData }) => {
    return await purchaseManager.reverseOrder(orderId, reverseData, getToken());
  });

  ipcMain.handle('purchase:get-payment-history', async (event, orderId) => {
    return await purchaseManager.getPaymentHistory(orderId, getToken());
  });

  // Hold Orders IPC Handlers
  ipcMain.handle('purchase:create-hold-order', async (event, snapshot) => {
    return await purchaseManager.createHoldOrder(snapshot, getToken());
  });

  ipcMain.handle('purchase:get-hold-orders', async (event, searchParams) => {
    return await purchaseManager.getHoldOrders(searchParams, getToken());
  });

  ipcMain.handle('purchase:get-hold-order-by-id', async (event, holdOrderId) => {
    return await purchaseManager.getHoldOrderById(holdOrderId, getToken());
  });

  ipcMain.handle('purchase:archive-hold-order', async (event, holdOrderId) => {
    return await purchaseManager.archiveHoldOrder(holdOrderId, getToken());
  });

  // Bulk Import IPC Handler
  ipcMain.handle('purchase:bulk-import', async (event, importData) => {
    return await purchaseManager.bulkImportPurchases(importData, getToken());
  });

  // Import from spreadsheet (orders with supplier/product names; resolved on server)
  ipcMain.handle('purchase:import-from-spreadsheet', async (event, payload) => {
    return await purchaseManager.importFromSpreadsheet(payload, getToken());
  });

  // Statistics IPC Handler
  ipcMain.handle('purchase:get-stats', async (event, searchParams) => {
    return await purchaseManager.getStats(searchParams, getToken());
  });

  ipcMain.handle('purchase:export-purchase-order', async () => {
    try {
      return await purchaseManager.exportPurchaseOrder(getToken());
    } catch (error) {
      console.error('[Purchase IPC] export-purchase-order:', error);
      return { success: false, error: error.message };
    }
  });
}
