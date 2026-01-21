# Network Desktop App - Project Summary

**Last Updated:** January 2025

## Project Overview

This is an Electron-based desktop application for inventory management with a Node.js/Express backend API. The system manages products, stock/inventory, customers, and includes role-based access control (RBAC) with JWT authentication.

## Tech Stack

### Frontend
- **Framework:** Electron (desktop app)
- **UI Library:** Liteframe (custom framework)
- **State Management:** ViewModel pattern with StatefulRow components
- **IPC:** Electron IPC for communication between renderer and main process

### Backend
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js 5.x
- **Database:** PostgreSQL with Knex.js ORM
- **Validation:** Zod schemas
- **Authentication:** JWT tokens
- **Authorization:** RBAC with permissions system

## Project Structure

```
network-desktop-app/
├── api/                    # Backend API
│   ├── src/
│   │   ├── modules/       # Feature modules (inventory, customers, users, auth)
│   │   ├── middleware/    # Auth, error handling
│   │   ├── routes/        # API routes
│   │   └── services/      # Business logic services
│   └── db/
│       ├── migrations/    # Database migrations
│       └── seeds/         # Seed data
├── app/                   # Electron frontend
│   ├── electron/         # Main process code
│   │   ├── inventory/    # IPC handlers for inventory
│   │   ├── customers/    # IPC handlers for customers
│   │   └── users/        # IPC handlers for users
│   └── src/
│       ├── components/   # UI components
│       │   └── modules/
│       │       ├── inventory/  # Inventory UI components
│       │       ├── customers/  # Customer UI components
│       │       └── users/       # User management UI
│       └── utils/        # Utility functions
└── db-data/              # PostgreSQL data directory
```

## Key Features Implemented

### 1. Authentication & Authorization
- JWT-based authentication
- RBAC with granular permissions
- Permission checking middleware (`requireRules`)
- Permission checker utility for frontend

### 2. Products Management
- **CRUD Operations:** Create, read, update, delete products
- **Auto-incrementing Product Codes:** Format-based sequential codes
- **Categories & Units:** Dynamic dropdowns from database
- **Bulk Import/Export:** CSV import and export
- **Search & Sort:** Real-time search with debouncing, column sorting
- **Product Details:** View/edit with expiry threshold configuration

### 3. Stock/Inventory Management
- **Stock Dashboard:** Overview with statistics
- **Stock Import:** Bulk CSV import with inventory code generation
  - Format: `I###XXXX` where `###` is variation number, `XXXX` is last 4 digits of product code
- **Stock Export:** CSV export functionality
- **Stock Statistics:**
  - Total stock value
  - Out of stock items
  - Low stock items
  - Expiring soon (product-specific threshold)
  - Expired items
  - High value items
- **Stock Actions:**
  - View details
  - Edit details (separate from pricing)
  - Edit pricing (requires `CanEditStockItemPrice` permission)
  - Adjust stock (quantity adjustments with reasons)
  - Transfer stock (between locations)
  - Borrow from partners (recently implemented)
- **Search, Sort & Filter:** Full table controls with pagination

### 4. Bin Card System
- **Transaction Tracking:** All inventory movements tracked per product
- **Transaction Types:** received, issued, adjustment
- **Reasons:** Initial Stock, Bulk Purchase, Sales, Purchase, Borrow From, Borrow To, Return Borrow From, Return Borrow To, Adjustment, Transfer
- **Features:**
  - Compact card view for transactions
  - Color-coded badges for balance and reasons
  - Search, sort, and filter capabilities
  - Pagination with icon buttons
  - CSV export
- **Display:** Shows opening balance, quantity change, new balance, unit cost, transaction date, reason, notes

### 5. Customers Management
- **CRUD Operations:** Full customer lifecycle management
- **Customer Types:** Supplier, Retailer, Both
- **Quick Add:** Simplified form (name, contact person, type only)
- **Detailed Edit:** Full customer information editing
- **Bulk Import/Export:** CSV support
- **Search & Sort:** Table controls
- **Permissions:** Granular access control

### 6. Users Management
- User CRUD operations
- Role assignment
- Avatar upload with image processing

## Database Schema Highlights

### Core Tables
- `users` - User accounts with authentication
- `roles` - User roles
- `rules` - Permissions/rules
- `role_rules` - Role-permission mapping
- `products` - Product catalog
- `categories` - Product categories
- `units` - Measurement units
- `inventories` - Current stock in warehouse
- `bin_cards` - Transaction history
- `customers` - Customer/partner information
- `borrow_from_inventories` - Stock borrowed from partners
- `borrow_to_inventories` - Stock lent to partners
- `borrow_from_returns` - Returns of borrowed-from stock
- `borrow_to_returns` - Returns of borrowed-to stock

### Key Design Decisions
- **Inventories table** only contains existing stock in warehouse
- **Borrowed inventories** stored in separate tables (`borrow_from_inventories`, `borrow_to_inventories`)
- **Foreign keys** use `ON DELETE SET NULL` for soft relationships
- **Product codes** are auto-generated and unique
- **Inventory codes** track product variations

## Permission System

### Product Management Permissions
- `CanAddProduct`
- `CanImportProducts`
- `CanExportProducts`
- `CanSeeProductDetails`
- `CanEditProductDetails`

### Stock Management Permissions
- `CanImportStock`
- `CanExportStock`
- `CanSeeStockDashboard`
- `CanSeeTotalStockStat`
- `CanSeeExpiredStockStat`
- `CanSeeHighValueStockStat`
- `CanSeeStockItemDetails`
- `CanEditStockItemDetails`
- `CanEditStockItemPrice`
- `CanAdjustStockItemQuantities`
- `CanTransferItemShelf`
- `CanReceiveBorrowedFromStock`
- `CanReturnBorrowedFromStock`
- `CanReceiveBorrowedToStock`

### Customer Management Permissions
- `CanAddCustomer`
- `CanEditCustomer`
- `CanDeleteCustomer`
- `CanImportCustomers`
- `CanExportCustomers`

## UI Patterns & Conventions

### State Management
- **ViewModel Pattern:** Each module has a ViewModel class extending base `ViewModel`
- **StatefulRow:** Root component that subscribes to ViewModel state changes
- **Loading State:** Re-renders triggered by `loading` state changes (not other states)
- **Local State:** Used only for pure UI concerns (modals, drawers, dropdowns)

### Component Structure
- **Modal Pattern:** Custom modals with `delegator` prop for event handling
- **Drawer Pattern:** Side drawers for detailed views
- **Dropdown Pattern:** Custom `DropdownSearch` with `DropdownSearchItem`
- **Table Pattern:** Paginated tables with search, sort, filter

### Event Handling
- **Event Delegation:** Use `delegator` prop when operating outside main app root (modals, drawers)
- **Row Component:** Uses `events` object, not `onClick` prop directly
- **IPC Communication:** All backend calls via `window.ipcRenderer.invoke()`

### Data Loading Pattern
- **Pre-fetch Data:** Load data in button click handlers before opening modals/drawers
- **Avoid Re-render Loops:** Never call data-fetching methods directly in render functions
- **Promise.all:** Use for parallel async operations

### Form Handling
- **onChange vs onInput:** Use `onChange` for form inputs
- **Form State:** Managed in ViewModel state, not local state
- **Validation:** Frontend validation + backend Zod schemas

## Recent Work Completed

### Borrow From Feature (Latest)
- **API Implementation:**
  - Created `borrowFromStockSchema` validation
  - Added `createBorrowFromInventory` repository method
  - Implemented `createBorrowFrom` service method with bin card transaction
  - Added POST `/stock/borrow-from` route with `CanReceiveBorrowedFromStock` permission
- **Frontend Implementation:**
  - Enhanced `BorrowFromModal` with improved dropdowns
  - Partner dropdown shows: name, customer type badge, contact person, code
  - Product dropdown shows: name, category badge, code, unit
  - Modal dimensions: `max-w-[1400px]`, `max-h-[95vh]`
  - Data loading moved to button click handler (prevents infinite re-renders)
  - Fixed: `partnerId` and `productId` converted to numbers before API call

### Customer Module
- Full CRUD operations
- Quick add form (name, contact person, type)
- Detailed edit drawer
- Import/export functionality
- Search, sort, filter
- Permission-based access control

### Stock Management Enhancements
- Currency changed from "$" to "ETB" (Ethiopian Birr)
- Date formatting helper: `dd/mm/yyyy` format
- Removed "Total Value" column from stock table
- Separate edit actions for details vs pricing
- Loading states on all save buttons

## Known Issues & Pending Work

### System Redesign: Borrowed Inventories
**Status:** Partially implemented

**Current State:**
- `borrow_from_inventories` table created
- `borrow_from` API and UI implemented
- Bin card transactions created for borrow from

**Pending:**
- `borrow_to_inventories` table and API
- `borrow_to_returns` table and API
- Rename `borrow_returns` to `borrow_from_returns`
- Update stock adjustment to record to `borrow_to_inventories` when reason is "borrow to"
- Update stock UI filters to show correct inventory types

### Locations Management
- Currently hardcoded in stock transfer
- Planned as "nice to have" feature
- Would require dedicated locations table

## Development Patterns

### API Development Pattern
1. **Schema** (`*.schema.js`): Zod validation schemas
2. **Repository** (`*.repository.js`): Database queries with Knex
3. **Service** (`*.service.js`): Business logic
4. **Controller** (`*.controller.js`): HTTP request handling
5. **Routes** (`*.routes.js`): Route definitions with middleware

### Frontend Development Pattern
1. **ViewModel** (`*VM.js`): State management and business logic
2. **IPC Handlers** (`electron/*/ipcHandlers.js`): Register IPC handlers
3. **IPC Methods** (`electron/*/*.js`): Implement IPC methods
4. **UI Components** (`components/modules/*/`): React-like components using Liteframe

### Error Handling
- Backend: Centralized error middleware
- Frontend: Try-catch with user-friendly alerts
- Console logging for debugging (remove before production)

## Testing Notes

### Common Issues Fixed
1. **Infinite Re-rendering:** Fixed by moving data loading to event handlers
2. **Type Mismatches:** Ensure IDs are numbers, not strings
3. **Event Delegation:** Use `delegator` prop in modals/drawers
4. **Form State:** Use ViewModel state, not local state
5. **Focus Issues:** Managed with `focusin`/`focusout` events

## Next Steps

1. Complete borrowed inventory system redesign
2. Implement "Borrow To" functionality
3. Implement return flows for borrowed inventories
4. Add locations management (if prioritized)
5. Remove all debug console logs
6. Add comprehensive error handling
7. Performance optimization for large datasets

## Important Files Reference

### Backend
- `api/src/modules/inventory/inventories.*` - Inventory module
- `api/src/modules/customers/customers.*` - Customer module
- `api/src/middleware/auth.js` - JWT authentication
- `api/src/services/permissions.service.js` - Permission checking

### Frontend
- `app/src/components/modules/inventory/InventoryVM.js` - Inventory ViewModel
- `app/src/components/modules/inventory/tabs/Stock.js` - Stock UI
- `app/src/components/modules/inventory/BorrowFromModal.js` - Borrow from modal
- `app/electron/inventory/inventory.js` - Inventory IPC methods
- `app/src/components/utils/permissionChecker.js` - Permission utility

## Environment Setup

- Node.js (ES Modules)
- PostgreSQL database
- Environment variables for JWT secret, database connection
- Docker support available (see `docker-compose.yml`)

---

**Note:** This summary should be used as context when starting a new conversation. Update it as the project evolves.
