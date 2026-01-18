# InventoryVM Refactoring Summary

## ✅ Completed: ViewModel Refactoring

### Architecture Pattern (Following ProfileVM.js)

**Key Principles:**
1. **All data in viewModel state** - Not in local state
2. **Re-renders triggered by 'loading' state** - StatefulRow watches `stateKeys: ['loading']`
3. **IPC communication** - All async operations use `window.ipcRenderer.invoke()`
4. **Loading pattern:**
   - Set `loading: true` at start
   - Clear `error` and `success`
   - Perform async operation via IPC
   - Update data states
   - Set `loading: false` in finally block
5. **Local state only for pure UI** - Drawer open/close, modal visibility, selected row highlighting

### State Structure

#### UI State
- `inventory-tab`: Current active tab ('products' or 'stock')
- `loading`: Loading state (triggers re-renders)
- `error`: Error object with message
- `success`: Success object with message

#### Products State
- `product-list`: Array of product objects
- `product-total-count`: Total number of products
- `product-table-config`: Pagination/sorting config
  - `limit`: Items per page
  - `offset`: Current offset
  - `sortBy`: Field to sort by
  - `orderBy`: 'asc' or 'desc'
- `product-search-query`: Current search query
- `product-form`: Form data for create/update

#### Stock State
- `stock-list`: Array of stock items
- `stock-total-count`: Total number of stock items
- `stock-table-config`: Pagination/sorting config
- `stock-search-query`: Current search query
- `stock-filter`: Current filter ('all', 'out-of-stock', etc.)
- `stock-stats`: Aggregate statistics
  - `total`, `outOfStock`, `lowStock`, `expiringSoon`, `expired`, `borrowed`, `highValue`

### Methods Implemented

#### Products Methods
- `loadProducts()` - Load products list with pagination/search
- `createProduct(productData)` - Create new product
- `updateProduct(productId, productData)` - Update existing product
- `bulkImportProducts(products)` - Bulk import products from CSV
- `updateProductSearchQuery(query)` - Update search query
- `setProductLimit(limit)` - Change items per page
- `nextProductPage()` - Go to next page
- `previousProductPage()` - Go to previous page
- `updateProductForm(key, value)` - Update form data
- `resetProductForm()` - Reset form to empty

#### Stock Methods
- `loadStock()` - Load stock list with pagination/search/filter
- `adjustStock(stockId, adjustmentData)` - Adjust stock quantity
- `transferStock(stockId, transferData)` - Transfer stock between locations
- `returnBorrowedStock(stockId, returnData)` - Return borrowed stock
- `updateStockSearchQuery(query)` - Update search query
- `updateStockFilter(filter)` - Update filter
- `setStockLimit(limit)` - Change items per page
- `nextStockPage()` - Go to next page
- `previousStockPage()` - Go to previous page

#### Utility Methods
- `getProductList()` - Get current product list
- `getStockList()` - Get current stock list
- `getStockStats()` - Get stock statistics
- `getActiveTab()` - Get current active tab
- `updateTab(value)` - Switch tabs and load data

## 📋 Next Steps: IPC Handlers in Main Process

### Required IPC Handlers

All handlers should be added to `app/electron/main.js` (or a separate handlers file).

#### Products Handlers

1. **`inventory:get-products`**
   - Parameters: `{ limit, offset, search, sortBy, orderBy }`
   - Returns: `{ success: true, products: [], total: 0 }`
   - Calls backend API: `GET /api/products`

2. **`inventory:create-product`**
   - Parameters: `{ name, description, category, unit }`
   - Returns: `{ success: true, product: {} }`
   - Calls backend API: `POST /api/products`

3. **`inventory:update-product`**
   - Parameters: `{ id, name, description, category, unit }`
   - Returns: `{ success: true, product: {} }`
   - Calls backend API: `PUT /api/products/:id`

4. **`inventory:bulk-import-products`**
   - Parameters: `{ products: [] }`
   - Returns: `{ success: true, summary: { total, successful, failed }, results: [] }`
   - Calls backend API: `POST /api/products/bulk-import`

#### Stock Handlers

5. **`inventory:get-stock`**
   - Parameters: `{ limit, offset, search, filter, sortBy, orderBy }`
   - Returns: `{ success: true, stock: [], total: 0, stats: {} }`
   - Calls backend API: `GET /api/stock`

6. **`inventory:adjust-stock`**
   - Parameters: `{ stockId, quantity, reason, notes }`
   - Returns: `{ success: true, stock: {} }`
   - Calls backend API: `POST /api/stock/:id/adjust`

7. **`inventory:transfer-stock`**
   - Parameters: `{ stockId, fromLocation, toLocation, quantity, notes }`
   - Returns: `{ success: true }`
   - Calls backend API: `POST /api/stock/:id/transfer`

8. **`inventory:return-borrowed-stock`**
   - Parameters: `{ stockId, returnDate, returnNotes, returnedStocks: [] }`
   - Returns: `{ success: true }`
   - Calls backend API: `POST /api/stock/:id/return-borrowed`

### IPC Handler Pattern

```javascript
// Example handler structure
ipcMain.handle('inventory:get-products', async (event, params) => {
  try {
    // Get API base URL from config
    const apiBaseUrl = getApiBaseUrl();
    
    // Build query string
    const queryParams = new URLSearchParams({
      limit: params.limit || 25,
      offset: params.offset || 0,
      search: params.search || '',
      sortBy: params.sortBy || 'id',
      orderBy: params.orderBy || 'desc'
    });
    
    // Make API call
    const response = await fetch(`${apiBaseUrl}/api/products?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add auth headers if needed
      }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      return {
        success: true,
        products: data.products || [],
        total: data.total || 0
      };
    }
    
    return {
      success: false,
      error: data.error || 'Failed to fetch products'
    };
  } catch (error) {
    console.error('IPC Error [inventory:get-products]:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch products'
    };
  }
});
```

### UI Updates Needed

After IPC handlers are implemented, update:

1. **Products.js**:
   - Replace local state `search-query` with `props.viewModel.getState('product-search-query')`
   - Use `props.viewModel.updateProductSearchQuery()` instead of `setLocalState`
   - Use `props.viewModel.loadProducts()` when search/pagination changes
   - Remove mock data, use `props.viewModel.getProductList()`

2. **Stock.js**:
   - Replace local state `search-query` and `selected-filter` with viewModel state
   - Use `props.viewModel.updateStockSearchQuery()` and `props.viewModel.updateStockFilter()`
   - Use `props.viewModel.loadStock()` when search/filter/pagination changes
   - Use `props.viewModel.getStockList()` and `props.viewModel.getStockStats()`

3. **CreateProductModal.js**:
   - Use `props.viewModel.createProduct()` instead of mock
   - Use `props.viewModel.updateProductForm()` for form state

4. **ImportProductsModal.js**:
   - Use `props.viewModel.bulkImportProducts()` instead of mock

### Notes

- All data fetching should go through IPC handlers
- The viewModel methods automatically handle loading/error/success states
- UI components should watch `loading` state for re-renders
- Local state should only be used for UI-only concerns (drawer open/close, modal visibility)
