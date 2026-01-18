import { Button, Spinner } from "../../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../../utils/Card";
import { IconButton, IonIcon } from "../../utils/Icon";
import { Input } from "../../utils/Input";
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from "../../utils/Table";

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
function validateProductRow(row, rowIndex, existingCategories = [], existingUnits = []) {
  const errors = [];
  
  // Normalize field names (handle variations)
  // Headers are converted to lowercase, so "Product Name" becomes "product name"
  const name = row.name || row['product name'] || row['product_name'] || row['productname'] || '';
  const description = row.description || row.desc || row['product description'] || '';
  const category = row.category || row.cat || row['product category'] || '';
  const unit = row.unit || row['unit of measure'] || row['unit_of_measure'] || row['unitofmeasure'] || '';
  
  // Debug: Log if we can't find the name field
  if (!name && rowIndex === 0) {
    console.log('Available row keys:', Object.keys(row));
    console.log('Row data:', row);
  }
  
  if (!name || name.trim() === '') {
    errors.push('Product name is required');
  }
  
  if (!category || category.trim() === '') {
    errors.push('Category is required');
  } else if (existingCategories.length > 0 && !existingCategories.includes(category.trim())) {
    errors.push(`Category "${category}" does not exist`);
  }
  
  if (!unit || unit.trim() === '') {
    errors.push('Unit is required');
  } else if (existingUnits.length > 0 && !existingUnits.includes(unit.trim())) {
    errors.push(`Unit "${unit}" does not exist`);
  }
  
  // Ensure we always return a valid object structure
  const normalizedRow = {
    name: (name || '').trim(),
    description: (description || '').trim(),
    category: (category || '').trim(),
    unit: (unit || '').trim()
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
    // Use local state for import modal (will migrate to viewModel later)
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

    // Mock existing categories and units (would come from viewModel/API)
    const existingCategories = ['Regent', 'Supplies'];
    const existingUnits = ['Bottle', 'PK', 'Kit', 'Box', 'Unit'];

    const handleFileSelect = (e) => {
      const selectedFile = e.target.files[0];
      if (!selectedFile) return;

      // Validate file type
      if (!selectedFile.name.endsWith('.csv')) {
        alert('Please select a CSV file (.csv extension required)');
        e.target.value = ''; // Clear the input
        return;
      }

      // Validate file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        e.target.value = ''; // Clear the input
        return;
      }

      // Validate file is not empty
      if (selectedFile.size === 0) {
        alert('The selected file is empty');
        e.target.value = ''; // Clear the input
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
          
          // Debug: Log parsed data (can be removed in production)
          console.log('Parsed headers:', headers);
          console.log('Parsed rows count:', rows.length);
          if (rows.length > 0) {
            console.log('First row sample:', rows[0]);
            console.log('First row keys:', Object.keys(rows[0]));
          }
          
          // Validate each row
          const validationResults = rows.map((row, index) => {
            try {
              return validateProductRow(row, index, existingCategories, existingUnits);
            } catch (error) {
              console.error(`Error validating row ${index}:`, error, row);
              // Return an invalid validation result if validation throws an error
              return {
                isValid: false,
                errors: [`Validation error: ${error.message}`],
                normalizedRow: {
                  name: row.name || row['product name'] || '',
                  description: row.description || '',
                  category: row.category || '',
                  unit: row.unit || ''
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
          // Set validationResults first, then parsedData to ensure validation is ready when preview renders
          props.setLocalState('validationResults', validationResults);
          props.setLocalState('parsedData', rows);
          
          // Debug: Verify state was set correctly
          console.log('Set validationResults:', validationResults.length, 'results');
          console.log('Set parsedData:', rows.length, 'rows');
          if (validationResults.length > 0) {
            console.log('First validation result:', validationResults[0]);
          }
        } catch (error) {
          console.error('Error parsing CSV:', error);
          alert(`Error parsing CSV file: ${error.message}\n\nExpected format:\n- First row: Headers (Product Name, Description, Category, Unit)\n- Subsequent rows: Data values\n- Use commas to separate columns`);
          props.setLocalState('file', null);
          props.setLocalState('parsedData', []);
          props.setLocalState('validationResults', []);
        }
      };
      reader.onerror = () => {
        alert('Error reading file');
      };
      reader.readAsText(selectedFile);
    };

    const handleImport = async () => {
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
        .filter(row => row !== null); // Remove any null entries

      if (validRows.length === 0) {
        alert('No valid rows to import. Please fix errors and try again.');
        return;
      }

      props.setLocalState('importing', true);

      try {
        // Use viewModel method for bulk import (it handles the actual import)
        const result = await props.viewModel.bulkImportProducts(validRows);
        
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
        alert('Error importing products. Please try again.');
        props.setLocalState('importing', false);
      }
    };

    const handleReset = () => {
      props.setLocalState('file', null);
      props.setLocalState('parsedData', []);
      props.setLocalState('validationResults', []);
      props.setLocalState('importResults', null);
      // Reset file input
      const fileInput = document.getElementById(fileInputId);
      if (fileInput) {
        fileInput.value = '';
      }
    };

    const validCount = validationResults.filter(r => r && r.isValid).length;
    const invalidCount = validationResults.filter(r => r && !r.isValid).length;
    const canImport = validCount > 0 && !importing && !importResults;

    return Card({
      class: 'bg-white rounded-lg shadow-2xl w-full max-w-5xl transform transition-all max-h-[90vh] overflow-hidden flex flex-col'
    }, [
      CardHeader({ class: 'flex justify-between items-center px-6 h-12 border-b border-gray-200' }, [
        Row({ class: 'flex items-center gap-3' }, [
          IonIcon({ name: 'cloud-upload-outline', class: 'text-xl text-indigo-600' }),
          Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Import Products'),
        ]),
        IconButton({ onClick: handleClose, size: 'medium', delegator }, [
          IonIcon({ name: 'close-outline', class: 'text-xl' })
        ])
      ]),
      

      CardBody({ class: 'flex-1 overflow-y-auto p-6' }, [
        Row({ class: 'flex flex-col gap-6' }, [
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
              Row({}, 'Expected columns: Product Name, Description, Category, Unit'),
              Row({ class: 'mt-1' }, 'First row should contain headers. Product Name, Category, and Unit are required.')
            ])
          ]),

          // Preview Table Section
          // Only show preview when both parsedData and validationResults are ready
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
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Description'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Category'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase' }, 'Unit'),
                    TableHCell({ class: 'text-center text-xs font-semibold text-gray-500 uppercase' }, 'Status')
                  ]),
                  TableBody({ class: 'flex-1 overflow-y-auto' },
                    parsedData.map((row, index) => {
                      // Ensure validationResults exists and has the right length
                      if (!validationResults || !Array.isArray(validationResults) || validationResults.length <= index) {
                        console.error(`Validation result missing for row ${index}:`, {
                          row,
                          validationResultsLength: validationResults?.length || 0,
                          parsedDataLength: parsedData.length,
                          validationResultsExists: !!validationResults
                        });
                        // Create a default invalid validation result
                        const defaultValidation = {
                          isValid: false,
                          errors: ['Validation result not available'],
                          normalizedRow: {
                            name: row.name || row['product name'] || '',
                            description: row.description || '',
                            category: row.category || '',
                            unit: row.unit || ''
                          }
                        };
                        return TableRow({
                          key: index,
                          class: 'bg-red-50'
                        }, [
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, index + 1),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, defaultValidation.normalizedRow.name || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, defaultValidation.normalizedRow.description || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, defaultValidation.normalizedRow.category || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, defaultValidation.normalizedRow.unit || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-center text-red-700' }, 'Validation Error')
                        ]);
                      }
                      
                      const validation = validationResults[index];
                      
                      // Safety check: if validation doesn't exist for this index, create a default invalid one
                      if (!validation) {
                        console.error(`Validation result is null/undefined for row ${index}:`, row);
                        // Create a default invalid validation result
                        const defaultValidation = {
                          isValid: false,
                          errors: ['Validation result is null'],
                          normalizedRow: {
                            name: row.name || row['product name'] || '',
                            description: row.description || '',
                            category: row.category || '',
                            unit: row.unit || ''
                          }
                        };
                        return TableRow({
                          key: index,
                          class: 'bg-red-50'
                        }, [
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, index + 1),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, defaultValidation.normalizedRow.name || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, defaultValidation.normalizedRow.description || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, defaultValidation.normalizedRow.category || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, defaultValidation.normalizedRow.unit || '-'),
                          TableDCell({ class: 'px-4 py-3 text-sm text-center text-red-700' }, 'Validation Error')
                        ]);
                      }
                      
                      const normalizedRow = validation.normalizedRow || {};
                      return TableRow({
                        key: index,
                        class: validation.isValid ? 'bg-green-50' : 'bg-red-50'
                      }, [
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, index + 1),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, normalizedRow.name || '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, normalizedRow.description || '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, normalizedRow.category || '-'),
                        TableDCell({ class: 'px-4 py-3 text-sm text-gray-900' }, normalizedRow.unit || '-'),
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
              Row({ class: 'text-sm text-green-800' }, `Successfully imported ${importResults.successful} product(s).`)
            ]),
            importResults.failed > 0 && Row({ class: 'bg-red-50 rounded-lg p-3 border border-red-200 flex items-center gap-2' }, [
              IonIcon({ name: 'alert-circle-outline', class: 'text-red-600 text-xl' }),
              Row({ class: 'text-sm text-red-800' }, `${importResults.failed} product(s) failed to import.`)
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
        }, importing ? [Spinner(), 'Importing...'] : `Import ${validCount} Product(s)`),
        importResults && Button({
          variant: 'primary',
          onClick: () => {
            handleClose();
            // Refresh product list would happen here
          },
          delegator
        }, 'Done')
      ])
      ])
    ]);
  };
  
  // Use StatefulRow to enable reactivity with local state
  // Watch loading state from viewModel to trigger re-renders during import
  return StatefulRow({ 
    class: 'w-full h-full', 
    viewModel,
    stateKeys: ['loading'] // Watch loading to trigger re-renders during import
  }, render);
};

export default ModalContent;
