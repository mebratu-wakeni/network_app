# CSV Export Backend Implementation Guide

## Overview
The frontend export button is now wired up to call a backend endpoint. The backend should generate and return a CSV file for download.

## Frontend Implementation (✅ Done)

**File:** `app/src/components/modules/inventory/tabs/Products.js`

The `handleExportCSV` function:
- Gets current table configuration (pagination, search)
- Builds query parameters
- Creates a download link to: `GET /api/products/export?limit=1000&offset=0&search=&format=csv`
- Triggers browser download

## Backend Implementation (📋 TODO)

### 1. Create Export Endpoint

**Route:** `GET /api/products/export`

**Query Parameters:**
- `limit` (optional): Number of rows to export (default: all)
- `offset` (optional): Starting offset (default: 0)
- `search` (optional): Search query to filter products
- `format` (optional): Export format, currently only 'csv' supported

**Response:**
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="products_export_YYYY-MM-DD.csv"`
- Body: CSV file content

### 2. Implementation Example

```javascript
// In api/src/modules/products/products.routes.js (or similar)
router.get(
  '/export',
  requireRole(['admin', 'viewer']), // Adjust permissions as needed
  productsController.exportCSV
);

// In api/src/modules/products/products.controller.js
exportCSV = async (req, res, next) => {
  try {
    const { limit, offset = 0, search = '' } = req.query;
    
    // Get products from service (with filters)
    const products = await this.service.listForExport({
      limit: limit ? parseInt(limit) : null, // null = all
      offset: parseInt(offset),
      search
    });
    
    // Generate CSV
    const csv = this.generateCSV(products);
    
    // Set headers for file download
    const filename = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// Helper method to generate CSV
generateCSV(products) {
  // CSV Header
  const headers = ['Product Code', 'Product Name', 'Description', 'Category', 'Unit'];
  let csv = headers.join(',') + '\n';
  
  // CSV Rows
  products.forEach(product => {
    const row = [
      product.product_code || '',
      product.name || '',
      product.description || '',
      product.category || '',
      product.unit || ''
    ];
    // Escape commas and quotes in values
    csv += row.map(val => {
      const str = String(val || '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',') + '\n';
  });
  
  return csv;
}
```

### 3. Service Method

```javascript
// In api/src/modules/products/products.service.js
async listForExport({ limit, offset, search }) {
  let query = this.repository.knex('products')
    .select(
      'products.product_code',
      'products.name',
      'products.description',
      'categories.name as category',
      'units.name as unit'
    )
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .leftJoin('units', 'products.unit_id', 'units.id');
  
  // Apply search filter
  if (search) {
    query = query.where(function() {
      this.where('products.name', 'ilike', `%${search}%`)
        .orWhere('products.product_code', 'ilike', `%${search}%`)
        .orWhere('products.description', 'ilike', `%${search}%`);
    });
  }
  
  // Apply pagination (if limit specified)
  if (limit) {
    query = query.limit(limit).offset(offset);
  }
  
  return await query;
}
```

### 4. Alternative: Use a CSV Library

For more robust CSV generation, consider using a library like `csv-stringify` or `papaparse`:

```bash
npm install csv-stringify
```

```javascript
import { stringify } from 'csv-stringify/sync';

generateCSV(products) {
  const data = products.map(p => [
    p.product_code || '',
    p.name || '',
    p.description || '',
    p.category || '',
    p.unit || ''
  ]);
  
  return stringify(data, {
    header: true,
    columns: ['Product Code', 'Product Name', 'Description', 'Category', 'Unit']
  });
}
```

## Security Considerations

1. **Authentication**: Ensure the endpoint requires authentication
2. **Authorization**: Check user permissions (e.g., require 'viewer' or 'admin' role)
3. **Rate Limiting**: Consider rate limiting for export endpoints to prevent abuse
4. **Data Size**: For very large datasets, consider:
   - Streaming the response
   - Adding a maximum limit
   - Using background jobs for large exports

## Testing

Test the endpoint with:
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4000/api/products/export?limit=10&search=test" \
  --output products.csv
```

## Notes

- The frontend currently uses `http://localhost:4000` as the API base URL. This should be replaced with a configurable API base URL from your app configuration.
- The export respects current search/filter state from the UI
- The filename includes the current date for easy identification
