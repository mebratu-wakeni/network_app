import { Button, Spinner } from "../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../utils/Card";
import { IconButton, IonIcon } from "../utils/Icon";
import { Input } from "../utils/Input";
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from "../utils/Table";
import { showAlert } from "../utils/ModalHelpers";
import { permissionChecker } from "../utils/PermissionChecker";

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

// Validation function
function validateCustomerRow(row, rowIndex) {
  const errors = [];
  
  // Normalize field names (handle variations)
  const name = row.name || row['customer name'] || row['customer_name'] || row['customername'] || '';
  const contact_person = row['contact person'] || row['contact_person'] || row['contactperson'] || '';
  const phone = row.phone || '';
  const email = row.email || '';
  const address = row.address || '';
  const license_no = row['license no'] || row['license_no'] || row['licenseno'] || '';
  const tin_no = row['tin no'] || row['tin_no'] || row['tinno'] || '';
  const website = row.website || '';
  const fax = row.fax || '';
  const country = row.country || '';
  const customer_type = row['customer type'] || row['customer_type'] || row['customertype'] || 'supplier';
  
  if (!name || name.trim() === '') {
    errors.push('Customer name is required');
  }
  
  // Validate email format if provided
  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Invalid email format');
    }
  }
  
  // Validate customer_type
  const validTypes = ['supplier', 'retailer', 'both', 'other'];
  if (customer_type && !validTypes.includes(customer_type.toLowerCase())) {
    errors.push(`Invalid customer type. Must be one of: ${validTypes.join(', ')}`);
  }
  
  // Ensure we always return a valid object structure
  const normalizedRow = {
    name: (name || '').trim(),
    contact_person: (contact_person || '').trim() || null,
    phone: (phone || '').trim() || null,
    email: (email || '').trim() || null,
    address: (address || '').trim() || null,
    license_no: (license_no || '').trim() || null,
    tin_no: (tin_no || '').trim() || null,
    website: (website || '').trim() || null,
    fax: (fax || '').trim() || null,
    country: (country || '').trim() || null,
    customer_type: (customer_type || 'supplier').toLowerCase()
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
    
    const file = props.getLocalState('file');
    const parsedData = props.getLocalState('parsedData');
    const validationResults = props.getLocalState('validationResults');
    const importing = props.getLocalState('importing');
    const importResults = props.getLocalState('importResults');
    const fileInputId = props.getLocalState('fileInputId');

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
              return validateCustomerRow(row, index);
            } catch (error) {
              return {
                isValid: false,
                errors: [`Validation error: ${error.message}`],
                normalizedRow: {
                  name: row.name || '',
                  contact_person: row['contact person'] || '',
                  phone: row.phone || '',
                  email: row.email || '',
                  address: row.address || '',
                  license_no: row['license no'] || '',
                  tin_no: row['tin no'] || '',
                  website: row.website || '',
                  fax: row.fax || '',
                  country: row.country || '',
                  customer_type: row['customer type'] || 'supplier'
                }
              };
            }
          });

          props.setLocalState('validationResults', validationResults);
          props.setLocalState('parsedData', rows);
        } catch (error) {
          console.error('Error parsing CSV:', error);
          showAlert({
            title: 'Error Parsing CSV',
            message: `Error parsing CSV file: ${error.message}\n\nExpected format:\n- First row: Headers (Name, Contact Person, Phone, Email, Address, License No, TIN No, Website, Fax, Country, Customer Type)\n- Subsequent rows: Data values\n- Use commas to separate columns`,
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
      const hasPermission = await permissionChecker.checkPermission('CanImportCustomers', {
        actionName: 'import customers'
      });
      if (!hasPermission) {
        return;
      }

      // Filter valid rows
      const validRows = validationResults
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result && result.isValid)
        .map(({ result }) => result.normalizedRow)
        .filter(row => row !== null);

      if (validRows.length === 0) {
        showAlert({
          title: 'No Valid Rows',
          message: 'No valid rows found to import. Please fix validation errors and try again.',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
        return;
      }

      props.setLocalState('importing', true);
      try {
        const result = await viewModel.bulkImportCustomers(validRows);
        
        props.setLocalState('importResults', result);
        
        if (result.summary.failed > 0) {
          showAlert({
            title: 'Import Completed with Errors',
            message: `Successfully imported ${result.summary.successful} customer(s). ${result.summary.failed} customer(s) failed.`,
            variant: 'warning',
            icon: 'warning-outline'
          });
        } else {
          showAlert({
            title: 'Import Successful',
            message: `Successfully imported ${result.summary.successful} customer(s).`,
            variant: 'success',
            icon: 'checkmark-circle-outline'
          });
          handleClose();
        }
      } catch (error) {
        console.error('Error importing customers:', error);
        showAlert({
          title: 'Import Failed',
          message: error.message || 'Failed to import customers',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
      } finally {
        props.setLocalState('importing', false);
      }
    };

    const validCount = validationResults.filter(r => r && r.isValid).length;
    const invalidCount = validationResults.filter(r => r && !r.isValid).length;

    return Card({
      class: 'bg-white rounded-lg shadow-2xl w-full max-w-4xl transform transition-all max-h-[90vh] overflow-hidden flex flex-col'
    }, [
      CardHeader({ class: 'flex justify-between items-center px-6 h-12 border-b border-gray-200' }, [
        Row({ class: 'flex items-center gap-3' }, [
          IonIcon({ name: 'cloud-upload-outline', class: 'text-xl text-indigo-600' }),
          Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Import Customers'),
        ]),
        IconButton({ onClick: handleClose, size: 'medium', delegator }, [
          IonIcon({ name: 'close-outline', class: 'text-xl' })
        ])
      ]),

      CardBody({ class: 'flex-1 overflow-y-auto p-6' }, [
        Row({ class: 'flex flex-col gap-6' }, [
          // File Selection
          Row({ class: 'flex flex-col gap-2' }, [
            Row({ tagType: 'label', class: 'text-sm font-medium text-gray-700' }, 'Select CSV File'),
            Row({ class: 'flex items-center gap-3' }, [
              Input({
                type: 'file',
                accept: '.csv',
                id: fileInputId,
                onChange: handleFileSelect,
                class: 'flex-1',
                delegator
              }),
            ])
          ]),

          // File Info
          file && Row({ class: 'bg-blue-50 border border-blue-200 rounded-lg p-4' }, [
            Row({ class: 'flex items-center gap-2 text-sm text-blue-800' }, [
              IonIcon({ name: 'document-outline', class: 'text-lg' }),
              Row({}, `Selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)
            ])
          ]),

          // CSV Format Description
          Row({ class: 'bg-gray-50 border border-gray-200 rounded-lg p-4' }, [
            Row({ class: 'text-sm font-semibold text-gray-700 mb-2' }, 'CSV Format:'),
            Row({ class: 'text-xs text-gray-600' }, [
              'Required columns: Name\n',
              'Optional columns: Contact Person, Phone, Email, Address, License No, TIN No, Website, Fax, Country, Customer Type (supplier/retailer/both/other)'
            ])
          ]),

          // Validation Summary
          validationResults.length > 0 && Row({ class: 'flex items-center gap-4 p-4 bg-gray-50 rounded-lg' }, [
            Row({ class: `px-3 py-1 rounded text-sm font-semibold ${validCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}` }, 
              `${validCount} valid`
            ),
            invalidCount > 0 && Row({ class: 'px-3 py-1 rounded text-sm font-semibold bg-red-100 text-red-700' }, 
              `${invalidCount} invalid`
            )
          ]),

          // Preview Table
          parsedData.length > 0 && Row({ class: 'flex flex-col gap-2' }, [
            Row({ tagType: 'h3', class: 'text-sm font-semibold text-gray-700' }, 'Preview (first 10 rows):'),
            Table({ class: 'border border-gray-200 rounded-lg overflow-hidden' }, [
              TableHeader({ class: 'bg-gray-50' }, [
                TableHCell({ class: 'px-3 py-2 text-xs font-semibold text-gray-600' }, 'Row'),
                TableHCell({ class: 'px-3 py-2 text-xs font-semibold text-gray-600' }, 'Name'),
                TableHCell({ class: 'px-3 py-2 text-xs font-semibold text-gray-600' }, 'Contact Person'),
                TableHCell({ class: 'px-3 py-2 text-xs font-semibold text-gray-600' }, 'Phone'),
                TableHCell({ class: 'px-3 py-2 text-xs font-semibold text-gray-600' }, 'Email'),
                TableHCell({ class: 'px-3 py-2 text-xs font-semibold text-gray-600' }, 'Type'),
                TableHCell({ class: 'px-3 py-2 text-xs font-semibold text-gray-600' }, 'Status')
              ]),
              TableBody({}, [
                ...parsedData.slice(0, 10).map((row, index) => {
                  const validation = validationResults[index];
                  const isValid = validation && validation.isValid;
                  return TableRow({
                    class: isValid ? '' : 'bg-red-50'
                  }, [
                    TableDCell({ class: 'px-3 py-2 text-xs text-gray-600' }, index + 1),
                    TableDCell({ class: 'px-3 py-2 text-xs text-gray-900' }, row.name || row['customer name'] || '—'),
                    TableDCell({ class: 'px-3 py-2 text-xs text-gray-600' }, row['contact person'] || '—'),
                    TableDCell({ class: 'px-3 py-2 text-xs text-gray-600' }, row.phone || '—'),
                    TableDCell({ class: 'px-3 py-2 text-xs text-gray-600' }, row.email || '—'),
                    TableDCell({ class: 'px-3 py-2 text-xs text-gray-600' }, row['customer type'] || 'supplier'),
                    TableDCell({ class: 'px-3 py-2 text-xs' }, [
                      isValid ? 
                        Row({ class: 'px-2 py-1 rounded bg-green-100 text-green-700 font-semibold' }, 'Valid') :
                        Row({ class: 'px-2 py-1 rounded bg-red-100 text-red-700 font-semibold' }, 
                          validation && validation.errors.length > 0 ? validation.errors[0] : 'Invalid'
                        )
                    ])
                  ])
                })
              ])
            ])
          ]),

          // Import Results
          importResults && Row({ class: 'bg-blue-50 border border-blue-200 rounded-lg p-4' }, [
            Row({ class: 'text-sm font-semibold text-blue-800 mb-2' }, 'Import Results:'),
            Row({ class: 'text-sm text-blue-700' }, 
              `Total: ${importResults.summary.total}, Successful: ${importResults.summary.successful}, Failed: ${importResults.summary.failed}`
            )
          ])
        ])
      ]),

      CardFooter({ class: 'flex justify-end gap-3 px-6 py-4 border-t border-gray-200' }, [
        Button({ variant: 'secondary', onClick: handleClose, delegator }, 'Close'),
        Button({ 
          variant: 'primary', 
          delegator, 
          onClick: handleImport, 
          disabled: importing || validCount === 0 || !file
        }, importing ? [Spinner(), ' Importing...'] : 'Import Customers'),
      ])
    ]);
  }
  
  return StatefulRow({ 
    class: 'fixed inset-0 bg-gray-800/0 flex items-center justify-center', 
    viewModel, 
    stateKeys: ['loading'] 
  }, render) 
};

export default ModalContent;
