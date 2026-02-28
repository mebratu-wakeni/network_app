import { Button, Spinner } from "../../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../../utils/Card";
import { IconButton, IonIcon } from "../../utils/Icon";
import { Input } from "../../utils/Input";
import { SelectFluid, SelectOptions } from "../../utils/Select";
import Label from "../../utils/Label";
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from "../../utils/Table";
import { showAlert } from "../../utils/ModalHelpers";
import { permissionChecker } from "../../utils/PermissionChecker";

const { Row, StatefulRow } = Liteframe;

// CSV Parser (handles quoted fields and commas within quotes)
function parseCSV(text) {
  // Split by newlines and filter out empty lines
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  
  // Need at least header row
  if (lines.length < 1) {
    throw new Error('CSV file must have at least a header row');
  }
  
  // Simple CSV parser that handles quoted fields
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  }
  
  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  
  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header.toLowerCase()] = values[index] || '';
    });
    rows.push(row);
  }
  
  return { headers, rows };
}

// Validation function for stock rows
function validateStockRow(row, rowIndex, existingProducts = [], existingLocations = []) {
  const errors = [];
  
  // Normalize field names (handle variations)
  const productCode = row['product code'] || row['product_code'] || row['productcode'] || row['code'] || '';
  const productName = row['product name'] || row['product_name'] || row['productname'] || row['name'] || '';
  const location = row.location || row.loc || row['stock location'] || '';
  const quantity = row.quantity || row.qty || row['stock quantity'] || '';
  const unitCost = row['unit cost'] || row['unit_cost'] || row['unitcost'] || row['cost'] || '';
  const expiryDate = row['expiry date'] || row['expiry_date'] || row['expirydate'] || row['expiry'] || '';
  const batchNumber = row['batch number'] || row['batch_number'] || row['batchnumber'] || row['batch'] || '';
  const sellingPrice = row['selling price'] || row['selling_price'] || row['sellingprice'] || row['price'] || '';
  const category = row.category || row['product category'] || row['product_category'] || '';
  const unit = row.unit || row['product unit'] || row['product_unit'] || '';
  
  // Required fields
  if (!productName || productName.trim() === '') {
    errors.push('Product name is required');
  }
  
  // Product code is optional; unknown codes are allowed (backend can auto-create product).
  
  if (!quantity || quantity.trim() === '') {
    errors.push('Quantity is required');
  } else {
    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum < 0) {
      errors.push('Quantity must be a valid positive number');
    }
  }
  
  if (!unitCost || unitCost.trim() === '') {
    errors.push('Unit cost is required');
  } else {
    const costNum = parseFloat(unitCost);
    if (isNaN(costNum) || costNum < 0) {
      errors.push('Unit cost must be a valid positive number');
    }
  }
  
  // Optional: Validate expiry date format if provided
  if (expiryDate && expiryDate.trim() !== '') {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(expiryDate.trim())) {
      errors.push('Expiry date must be in YYYY-MM-DD format');
    } else {
      const date = new Date(expiryDate.trim());
      if (isNaN(date.getTime())) {
        errors.push('Expiry date is not a valid date');
      }
    }
  }
  
  // Ensure we always return a valid object structure
  const normalizedRow = {
    productCode: (productCode || '').trim() || null,
    productName: (productName || '').trim(),
    category: (category || '').trim() || null,
    unit: (unit || '').trim() || null,
    location: (location || '').trim() || null,
    quantity: quantity ? parseFloat(quantity) : 0,
    unitCost: unitCost ? parseFloat(unitCost) : 0,
    expiryDate: (expiryDate || '').trim() || null,
    batchNumber: (batchNumber || '').trim() || null,
    sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null
  };
  
  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : [],
    normalizedRow: normalizedRow
  };
}

// --- The Modal Content Component (Child) ---
const ModalContent = (viewModel, delegator, handleClose) => {
  const render = (statefulProps) => {
    // Create props object with viewModel from StatefulRow and add delegator/handleClose
    const props = {
      ...statefulProps,
      delegator: delegator,
      handleClose: handleClose
    };
    // Use local state for import modal
    props.ensureLocalStateKey('file', null);
    props.ensureLocalStateKey('parsedData', []);
    props.ensureLocalStateKey('validationResults', []);
    props.ensureLocalStateKey('importing', false);
    props.ensureLocalStateKey('importResults', null);
    props.ensureLocalStateKey('fileInputId', `file-input-${Date.now()}`);
    props.ensureLocalStateKey('importReason', 'Initial Stock');
    props.ensureLocalStateKey('customReason', '');
    
    const file = props.getLocalState('file');
    const parsedData = props.getLocalState('parsedData');
    const validationResults = props.getLocalState('validationResults');
    const importing = props.getLocalState('importing');
    const importResults = props.getLocalState('importResults');
    const fileInputId = props.getLocalState('fileInputId');
    const importReason = props.getLocalState('importReason');
    const customReason = props.getLocalState('customReason');

    // Get existing products and locations from viewModel (would come from API)
    // For now, we'll use empty arrays and let the backend validate
    const existingProducts = []; // TODO: Get from viewModel
    const existingLocations = ['A-01', 'A-02', 'A-03', 'A-05', 'B-01', 'B-03', 'C-02', 'D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'E-01', 'E-02', 'E-03']; // Mock locations

    const handleFileSelect = (e) => {
      const selectedFile = e.target.files[0];
      if (!selectedFile) return;

      // Validate file type
      if (!selectedFile.name.endsWith('.csv')) {
        showAlert({
          title: 'Invalid File Type',
          message: 'Please select a CSV file (.csv extension required)',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
        e.target.value = '';
        return;
      }

      // Validate file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        showAlert({
          title: 'File Too Large',
          message: 'File size must be less than 5MB',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
        e.target.value = '';
        return;
      }

      // Validate file is not empty
      if (selectedFile.size === 0) {
        showAlert({
          title: 'Empty File',
          message: 'The selected file is empty',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
        e.target.value = '';
        return;
      }

      props.setLocalState('file', selectedFile);
      props.setLocalState('importResults', null);

      // Read and parse file
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target.result;
          const { headers, rows } = parseCSV(text);
          
          // Check if we have headers
          if (headers.length === 0) {
            throw new Error('CSV file appears to be empty or has no headers');
          }
          
          // Check if we have data rows
          if (rows.length === 0) {
            throw new Error('CSV file has headers but no data rows');
          }
          
          // Validate each row
          const validationResults = rows.map((row, index) => {
            try {
              return validateStockRow(row, index, existingProducts, existingLocations);
            } catch (error) {
              console.error(`Error validating row ${index}:`, error, row);
              return {
                isValid: false,
                errors: [`Validation error: ${error.message}`],
                normalizedRow: {
                  productCode: row['product code'] || row['product_code'] || '',
                  location: row.location || '',
                  quantity: 0,
                  unitCost: 0,
                  expiryDate: null
                }
              };
            }
          });

          // Ensure validationResults has the same length as rows
          if (validationResults.length !== rows.length) {
            console.error(`Mismatch: ${rows.length} rows but ${validationResults.length} validation results`);
            throw new Error('Validation failed: number of validation results does not match number of rows');
          }

          // Set both states together to ensure they're in sync
          props.setLocalState('validationResults', validationResults);
          props.setLocalState('parsedData', rows);
        } catch (error) {
          console.error('Error parsing CSV:', error);
          showAlert({
            title: 'Error Parsing CSV',
            message: `Error parsing CSV file: ${error.message}\n\nExpected format:\n- First row: Headers (Product Code, Location, Quantity, Unit Cost, Expiry Date)\n- Subsequent rows: Data values\n- Use commas to separate columns`,
            variant: 'error',
            icon: 'alert-circle-outline'
          });
          props.setLocalState('file', null);
          props.setLocalState('parsedData', []);
          props.setLocalState('validationResults', []);
        }
      };
      reader.onerror = () => {
        showAlert({
          title: 'File Read Error',
          message: 'Error reading file',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
      };
      reader.readAsText(selectedFile);
    };

    const handleImport = async () => {
      const hasPermission = await permissionChecker.checkPermission('CanImportStock', {
        actionName: 'import stock'
      });
      if (!hasPermission) {
        return;
      }

      // Filter valid rows
      const validRows = validationResults
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result && result.isValid)
        .map(({ result }) => {
          if (!result || !result.normalizedRow) {
            console.error('Invalid validation result in handleImport:', result);
            return null;
          }
          return result.normalizedRow;
        })
        .filter(row => row !== null);

      if (validRows.length === 0) {
        showAlert({
          title: 'No Valid Rows',
          message: 'No valid rows to import. Please fix errors and try again.',
          variant: 'warning',
          icon: 'warning-outline'
        });
        return;
      }

      // Validate reason - prevent submission if "Other"
      if (importReason === 'Other') {
        showAlert({
          title: 'Not Implemented',
          message: 'Import with "other" reason is not yet implemented. Please use "Initial Stock" for now.',
          variant: 'warning',
          icon: 'warning-outline'
        });
        return;
      }

      // Validate reason is provided
      const finalReason = importReason.trim();
      if (!finalReason || finalReason === '') {
        showAlert({
          title: 'Reason Required',
          message: 'Please specify the reason for importing stock',
          variant: 'warning',
          icon: 'warning-outline'
        });
        return;
      }

      props.setLocalState('importing', true);

      try {
        // Use viewModel method for bulk import with reason
        const result = await props.viewModel.bulkImportStock(validRows, finalReason);
        
        // Store results in local state for display
        props.setLocalState('importResults', {
          total: result.summary?.total || validRows.length,
          successful: result.summary?.successful || validRows.length,
          failed: result.summary?.failed || 0,
          results: result.results || []
        });
        props.setLocalState('importing', false);
      } catch (error) {
        console.error('Import error:', error);
        showAlert({
          title: 'Import Failed',
          message: error.message || 'Error importing stock. Please try again.',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
        props.setLocalState('importing', false);
      }
    };

    const handleReset = () => {
      props.setLocalState('file', null);
      props.setLocalState('parsedData', []);
      props.setLocalState('validationResults', []);
      props.setLocalState('importResults', null);
      props.setLocalState('importReason', 'Initial Stock');
      props.setLocalState('customReason', '');
      const fileInput = document.getElementById(fileInputId);
      if (fileInput) {
        fileInput.value = '';
      }
    };

    const validCount = validationResults.filter(r => r && r.isValid).length;
    
    const invalidCount = validationResults.filter(r => r && !r.isValid).length;
    const isOtherReason = importReason === 'Other';
    // Disable import if reason is "Other" (not yet implemented)
    const canImport = validCount > 0 && !importing && !importResults && !isOtherReason;

    return Card({
      class: 'bg-white rounded-lg shadow-2xl w-full max-w-5xl transform transition-all max-h-[90vh] overflow-hidden flex flex-col'
    }, [
      CardHeader({ class: 'flex justify-between items-center px-6 h-12 border-b border-gray-200' }, [
        Row({ class: 'flex items-center gap-3' }, [
          IonIcon({ name: 'cloud-upload-outline', class: 'text-xl text-indigo-600' }),
          Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Import Initial Stock'),
        ]),
        IconButton({ onClick: handleClose, size: 'medium', delegator }, [
          IonIcon({ name: 'close-outline', class: 'text-xl' })
        ])
      ]),

      CardBody({ class: 'flex-1 overflow-y-auto p-6' }, [
        Row({ class: 'flex flex-col gap-6' }, [
          // Reason Selection Section (before file selection)
          !importResults && Row({ class: 'flex flex-col gap-2' }, [
            Label({ name: 'import-reason', text: 'Import Reason *', class: 'text-sm font-medium text-gray-700' }),
            SelectFluid({ 
              name: 'import-reason',
              containerClass: 'w-full',
              value: importReason,
              onChange: (e) => props.setLocalState('importReason', e.target.value),
              delegator
            }, SelectOptions({ 
              options: ['Initial Stock', 'Other'],
              selectedOption: importReason
            })),
            ...(importReason === 'Other' ? [
              Row({ class: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-2' }, [
                Row({ class: 'flex items-start gap-3' }, [
                  IonIcon({ name: 'warning-outline', class: 'text-xl text-yellow-600 flex-shrink-0 mt-0.5' }),
                  Row({ class: 'flex flex-col gap-2 flex-1' }, [
                    Row({ class: 'text-sm font-semibold text-yellow-800' }, 'Not Yet Implemented'),
                    Row({ class: 'text-sm text-yellow-700' }, 'Import with "other" reason is not yet implemented. Please use "Initial Stock" for now.'),
                    Row({ class: 'flex flex-col gap-2 mt-2' }, [
                      Label({ name: 'custom-reason', text: 'Specify Reason (for future implementation)', class: 'text-xs font-medium text-yellow-700' }),
                      Input({
                        type: 'text',
                        name: 'custom-reason',
                        value: customReason,
                        onChange: (e) => props.setLocalState('customReason', e.target.value),
                        placeholder: 'Enter reason for importing stock...',
                        class: 'w-full',
                        disabled: true,
                        delegator
                      })
                    ])
                  ])
                ])
              ])
            ] : [])
          ]),
          
          // File Selection Section
          !importResults && Row({ class: 'flex flex-col gap-4' }, [
            Row({ class: 'text-sm font-semibold text-gray-700' }, 'Select CSV File'),
            Row({ class: 'flex items-center gap-4' }, [
              Row({ class: 'relative' }, [
                Input({
                  type: 'file',
                  name: fileInputId,
                  onChange: handleFileSelect,
                  class: 'hidden',
                  attributes: { 
                    id: fileInputId,
                    accept: '.csv'
                  },
                  delegator
                }),
                Button({
                  variant: 'outline',
                  onClick: () => {
                    const fileInput = document.getElementById(fileInputId);
                    if (fileInput) fileInput.click();
                  },
                  delegator
                }, [
                  IonIcon({ name: 'document-outline', class: 'text-lg' }),
                  'Choose File'
                ])
              ]),
              file && Row({ class: 'flex items-center gap-2 text-sm text-gray-600' }, [
                IonIcon({ name: 'checkmark-circle-outline', class: 'text-green-600' }),
                Row({}, file.name),
                Row({ class: 'text-gray-400' }, `(${(file.size / 1024).toFixed(2)} KB)`)
              ]),
              file && Button({
                variant: 'secondary',
                class: 'text-xs',
                onClick: handleReset,
                delegator
              }, 'Clear')
            ]),
            Row({ class: 'text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-200' }, [
              Row({ class: 'font-semibold text-blue-800 mb-1' }, 'CSV Format:'),
              Row({}, 'Expected columns: Product Name (required), Product Code (optional), Location (optional), Quantity (required), Unit Cost (required), Expiry Date (optional), Batch Number (optional), Selling Price (optional)'),
              Row({ class: 'mt-1' }, 'First row should contain headers. Product Name, Quantity, and Unit Cost are required. All other fields are optional.')
            ])
          ]),

          // Preview Table Section
          !importResults && parsedData.length > 0 && validationResults && validationResults.length > 0 && Row({ class: 'flex flex-col gap-4' }, [
            Row({ class: 'flex items-center justify-between' }, [
              Row({ class: 'text-sm font-semibold text-gray-700' }, 'Preview'),
              Row({ class: 'flex items-center gap-4 text-xs' }, [
                Row({ class: 'flex items-center gap-1' }, [
                  Row({ class: 'w-3 h-3 rounded-full bg-green-200' }),
                  Row({}, `${validCount} Valid`)
                ]),
                Row({ class: 'flex items-center gap-1' }, [
                  Row({ class: 'w-3 h-3 rounded-full bg-red-200' }),
                  Row({}, `${invalidCount} Invalid`)
                ])
              ])
            ]),
            Row({ class: 'border border-gray-200 rounded-lg overflow-hidden max-h-96 flex flex-col' }, [
              Table({ class: 'w-full flex flex-col' }, [
                  TableHeader({ class: 'sticky top-0 z-10 bg-white border-b border-gray-200' }, [
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Row'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Product Name'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Product Code'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Location'),
                    TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase' }, 'Quantity'),
                    TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase' }, 'Unit Cost'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Expiry Date'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Batch Number'),
                    TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase' }, 'Selling Price'),
                    TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase' }, 'Status')
                  ]),
                  TableBody({ class: 'flex-1 overflow-y-auto' },
                    parsedData.map((row, index) => {
                      if (!validationResults || !Array.isArray(validationResults) || validationResults.length <= index) {
                        return TableRow({
                          key: index,
                          class: 'bg-red-50'
                        }, [
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, index + 1),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row['product name'] || row['product_name'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row['product code'] || row['product_code'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.location || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, row.quantity || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, row['unit cost'] || row['unit_cost'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row['expiry date'] || row['expiry_date'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row['batch number'] || row['batch_number'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, row['selling price'] || row['selling_price'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-center text-red-700' }, 'Validation Error')
                        ]);
                      }
                      
                      const validation = validationResults[index];
                      
                      if (!validation) {
                        return TableRow({
                          key: index,
                          class: 'bg-red-50'
                        }, [
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, index + 1),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row['product name'] || row['product_name'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row['product code'] || row['product_code'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row.location || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, row.quantity || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, row['unit cost'] || row['unit_cost'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row['expiry date'] || row['expiry_date'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, row['batch number'] || row['batch_number'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, row['selling price'] || row['selling_price'] || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-center text-red-700' }, 'Validation Error')
                        ]);
                      }
                      
                      const normalizedRow = validation.normalizedRow || {};
                      return TableRow({
                        key: index,
                        class: validation.isValid ? 'bg-green-50' : 'bg-red-50'
                      }, [
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, index + 1),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, normalizedRow.productName || '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, normalizedRow.productCode || '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, normalizedRow.location || '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, normalizedRow.quantity?.toLocaleString() || '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, normalizedRow.unitCost ? `Br ${normalizedRow.unitCost.toFixed(2)}` : '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, normalizedRow.expiryDate || '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, normalizedRow.batchNumber || '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900 text-right' }, normalizedRow.sellingPrice ? `Br ${normalizedRow.sellingPrice.toFixed(2)}` : '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-center' },
                          validation.isValid
                            ? Row({ class: 'flex items-center justify-center gap-1 text-green-700' }, [
                                IonIcon({ name: 'checkmark-circle-outline', class: 'text-lg' }),
                                Row({}, 'Valid')
                              ])
                            : Row({ class: 'flex flex-col items-center gap-1 text-red-700' }, [
                                IonIcon({ name: 'close-circle-outline', class: 'text-lg' }),
                                Row({ class: 'text-xs' }, validation.errors && validation.errors[0] || 'Invalid')
                              ])
                        )
                      ]);
                    })
                  )
                ])
            ]),

          // Import Results Section
          importResults && Row({ class: 'flex flex-col gap-4' }, [
            Row({ class: 'text-sm font-semibold text-gray-700' }, 'Import Results'),
            Row({ class: 'bg-gray-50 rounded-lg p-4 border border-gray-200' }, [
              Row({ class: 'grid grid-cols-3 gap-4' }, [
                Row({ class: 'flex flex-col' }, [
                  Row({ class: 'text-xs text-gray-500 mb-1' }, 'Total Processed'),
                  Row({ class: 'text-2xl font-bold text-gray-800' }, importResults.total)
                ]),
                Row({ class: 'flex flex-col' }, [
                  Row({ class: 'text-xs text-gray-500 mb-1' }, 'Successful'),
                  Row({ class: 'text-2xl font-bold text-green-600' }, importResults.successful)
                ]),
                Row({ class: 'flex flex-col' }, [
                  Row({ class: 'text-xs text-gray-500 mb-1' }, 'Failed'),
                  Row({ class: 'text-2xl font-bold text-red-600' }, importResults.failed)
                ])
              ])
            ]),
            importResults.successful > 0 && Row({ class: 'bg-green-50 rounded-lg p-3 border border-green-200 flex items-center gap-2' }, [
              IonIcon({ name: 'checkmark-circle-outline', class: 'text-green-600 text-xl' }),
              Row({ class: 'text-sm text-green-800' }, `Successfully imported ${importResults.successful} stock item(s).`)
            ]),
            importResults.failed > 0 && Row({ class: 'bg-red-50 rounded-lg p-3 border border-red-200 flex items-center gap-2' }, [
              IonIcon({ name: 'alert-circle-outline', class: 'text-red-600 text-xl' }),
              Row({ class: 'text-sm text-red-800' }, `${importResults.failed} stock item(s) failed to import.`)
            ])
          ])
        ])
      ]),

      CardFooter({ class: 'flex justify-end gap-3 px-6 py-4 border-t border-gray-200' }, [
        !importResults && Button({ variant: 'secondary', onClick: handleClose, delegator }, 'Cancel'),
        !importResults && file && Button({
          variant: 'primary',
          onClick: handleImport,
          disabled: !canImport,
          delegator
        }, importing ? [Spinner(), 'Importing...'] : `Import ${validCount} Stock Item(s)`),
        importResults && Button({
          variant: 'primary',
          onClick: () => {
            handleClose();
            // Refresh stock list would happen here
          },
          delegator
        }, 'Done')
      ])
      ])
    ]);
  };
  
  // Use StatefulRow to enable reactivity with local state
  return StatefulRow({ 
    class: 'w-full h-full', 
    viewModel,
    stateKeys: ['loading']
  }, render);
};

export default ModalContent;
