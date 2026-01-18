import { ipcMain } from "electron";
import InventoryManager from "./inventory.js";
import { getToken } from "../config/authManager.js";

const inventoryManager = new InventoryManager();

export function InventoryIpcHandlers() {
  
  // Partners IPC Handlers
  ipcMain.handle('inventory:get-partners', async (event) => {
    return await inventoryManager.getPartners(getToken());
  });

  // Products IPC Handlers
  ipcMain.handle('inventory:get-products', async (event, searchParams) => {
    return await inventoryManager.getProducts(searchParams, getToken());
  });

  ipcMain.handle('inventory:create-product', async (event, productData) => {
    return await inventoryManager.createProduct(productData, getToken());
  });

  ipcMain.handle('inventory:update-product', async (event, productData) => {
    const { id, ...updateData } = productData;
    return await inventoryManager.updateProduct(id, updateData, getToken());
  });

  ipcMain.handle('inventory:bulk-import-products', async (event, { products }) => {
    return await inventoryManager.bulkImportProducts(products, getToken());
  });

  // Stock IPC Handlers
  ipcMain.handle('inventory:get-stock', async (event, searchParams) => {
    return await inventoryManager.getStock(searchParams, getToken());
  });

  ipcMain.handle('inventory:create-borrowed-from-stock', async (event, borrowData) => {
    return await inventoryManager.createBorrowedFromStock(borrowData, getToken());
  });

  ipcMain.handle('inventory:adjust-stock', async (event, adjustmentData) => {
    const { stockId, ...adjustData } = adjustmentData;
    return await inventoryManager.adjustStock(stockId, adjustData, getToken());
  });

  ipcMain.handle('inventory:transfer-stock', async (event, transferData) => {
    const { stockId, ...transferInfo } = transferData;
    return await inventoryManager.transferStock(stockId, transferInfo, getToken());
  });

  ipcMain.handle('inventory:return-borrowed-stock', async (event, returnData) => {
    const { stockId, ...returnInfo } = returnData;
    return await inventoryManager.returnBorrowedStock(stockId, returnInfo, getToken());
  });

  ipcMain.handle('inventory:bulk-import-stock', async (event, { stockItems }) => {
    return await inventoryManager.bulkImportStock(stockItems, getToken());
  });

  ipcMain.handle('inventory:update-stock', async (event, { stockId, stockData }) => {
    return await inventoryManager.updateStock(stockId, stockData, getToken());
  });
}
