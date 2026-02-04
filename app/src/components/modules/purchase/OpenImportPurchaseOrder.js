import Modal from "../../shared/Modal";
import { Button, Spinner } from "../../utils/Button";
import { Card, CardHeader, CardBody, CardFooter } from "../../utils/Card";
import { IconButton, IonIcon } from "../../utils/Icon";
import { Input } from "../../utils/Input";
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from "../../utils/Table";
import { showAlert } from "../../utils/ModalHelpers";
import { permissionChecker } from "../../utils/PermissionChecker";
import { csvToOrderObjects } from "../../../utils/purchaseBulkImport";

const { Row, StatefulRow } = Liteframe;

export function OpenImportPurchaseOrderModal(props) {
  Modal({}, (delegator, handleClose) => {
    return ImportPurchaseOrderModal(props, delegator, handleClose);
  });
}

function ImportPurchaseOrderModal(props, delegator, handleClose) {
  const render = (statefulProps) => {
    const mergedProps = { ...statefulProps, delegator, handleClose };
    mergedProps.ensureLocalStateKey('file', null);
    mergedProps.ensureLocalStateKey('orders', []);
    mergedProps.ensureLocalStateKey('parseErrors', []);
    mergedProps.ensureLocalStateKey('importing', false);
    mergedProps.ensureLocalStateKey('importResults', null);
    mergedProps.ensureLocalStateKey('fileInputId', `purchase-import-file-${Date.now()}`);

    const file = mergedProps.getLocalState('file');
    const orders = mergedProps.getLocalState('orders');
    const parseErrors = mergedProps.getLocalState('parseErrors');
    const importing = mergedProps.getLocalState('importing');
    const importResults = mergedProps.getLocalState('importResults');
    const fileInputId = mergedProps.getLocalState('fileInputId');

    const handleFileSelect = (e) => {
      const selectedFile = e.target.files[0];
      if (!selectedFile) return;

      if (!selectedFile.name.endsWith('.csv')) {
        showAlert({
          title: 'Invalid File Type',
          message: 'Please select a CSV file (.csv extension required).',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
        e.target.value = '';
        return;
      }

      if (selectedFile.size > 5 * 1024 * 1024) {
        showAlert({
          title: 'File Too Large',
          message: 'File size must be less than 5MB.',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
        e.target.value = '';
        return;
      }

      if (selectedFile.size === 0) {
        showAlert({
          title: 'Empty File',
          message: 'The selected file is empty.',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
        e.target.value = '';
        return;
      }

      mergedProps.setLocalState('file', selectedFile);
      mergedProps.setLocalState('importResults', null);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target.result;
          const { orders: parsedOrders, errors } = csvToOrderObjects(text);

          if (errors.length > 0) {
            mergedProps.setLocalState('parseErrors', errors);
            mergedProps.setLocalState('orders', parsedOrders);
          } else {
            mergedProps.setLocalState('parseErrors', []);
            mergedProps.setLocalState('orders', parsedOrders);
          }
        } catch (err) {
          console.error('Error parsing CSV:', err);
          showAlert({
            title: 'Error Parsing CSV',
            message: err.message || 'Failed to parse CSV. Check format (see BULK_PURCHASE_IMPORT_SPEC.md).',
            variant: 'error',
            icon: 'alert-circle-outline'
          });
          mergedProps.setLocalState('file', null);
          mergedProps.setLocalState('orders', []);
          mergedProps.setLocalState('parseErrors', []);
        }
      };
      reader.onerror = () => {
        showAlert({
          title: 'File Read Error',
          message: 'Could not read the file.',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
      };
      reader.readAsText(selectedFile);
    };

    const handleImport = async () => {
      const hasPermission = await permissionChecker.checkPermission('CanImportPurchase', {
        actionName: 'import purchase orders'
      });
      if (!hasPermission) return;

      if (!orders || orders.length === 0) {
        showAlert({
          title: 'No Orders',
          message: 'No valid orders to import. Fix validation errors and try again.',
          variant: 'warning',
          icon: 'warning-outline'
        });
        return;
      }

      if (parseErrors.length > 0) {
        showAlert({
          title: 'Validation Errors',
          message: `${parseErrors.length} row(s) have errors. Only valid rows are grouped into orders. You can import the ${orders.length} valid order(s) or fix the file.`,
          variant: 'warning',
          icon: 'warning-outline'
        });
      }

      mergedProps.setLocalState('importing', true);
      try {
        const result = await props.viewModel.importFromSpreadsheet({ orders });
        mergedProps.setLocalState('importResults', {
          total: result.summary?.total ?? orders.length,
          successful: result.summary?.successful ?? 0,
          failed: result.summary?.failed ?? 0,
          successfulList: result.successful || [],
          failedList: result.failed || []
        });
      } catch (error) {
        showAlert({
          title: 'Import Failed',
          message: error.message || 'Failed to import purchase orders.',
          variant: 'error',
          icon: 'alert-circle-outline'
        });
      } finally {
        mergedProps.setLocalState('importing', false);
      }
    };

    const handleReset = () => {
      mergedProps.setLocalState('file', null);
      mergedProps.setLocalState('orders', []);
      mergedProps.setLocalState('parseErrors', []);
      mergedProps.setLocalState('importResults', null);
      const input = document.getElementById(fileInputId);
      if (input) {
        input.value = '';
      }
    };

    const canImport = orders.length > 0 && !importing && !importResults;

    return Card({
      class: 'bg-white rounded-lg shadow-2xl w-full max-w-[95vw] transform transition-all max-h-[90vh] overflow-hidden flex flex-col'
    }, [
      CardHeader({ class: 'flex justify-between items-center px-6 py-4 border-b border-gray-200' }, [
        Row({ class: 'flex items-center gap-3' }, [
          IonIcon({ name: 'document-attach-outline', class: 'text-xl text-indigo-600' }),
          Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Import Purchase Orders')
        ]),
        IconButton({ onClick: handleClose, size: 'medium', delegator }, [
          IonIcon({ name: 'close-outline', class: 'text-xl' })
        ])
      ]),

      CardBody({ class: 'flex-1 overflow-y-auto p-6 min-w-0' }, [
        Row({ class: 'flex flex-col gap-6 w-full min-w-0' }, [

          !importResults && Row({ class: 'flex flex-col gap-4' }, [
            Row({ class: 'text-sm font-semibold text-gray-700' }, 'Select CSV File'),
            Row({ class: 'flex items-center gap-4 flex-wrap' }, [
              Row({ class: 'relative' }, [
                Input({
                  type: 'file',
                  name: fileInputId,
                  onChange: handleFileSelect,
                  class: 'hidden',
                  delegator,
                  attributes: { accept: '.csv' }
                }),
                Button({
                  variant: 'outline',
                  onClick: () => {
                    const input = document.getElementById(fileInputId);
                    if (input) input.click();
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
              file && Button({ variant: 'secondary', class: 'text-xs', onClick: handleReset, delegator }, 'Clear')
            ]),
            Row({ class: 'text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-200' }, [
              Row({ class: 'font-semibold text-blue-800 mb-1' }, 'CSV format'),
              Row({}, 'Required columns: supplier name, order date (or blank), invoice number (optional), total amount, amount paid, withhold percentage, payment mode (cash/credit/cheque), product name, batch number (optional), expiry date (optional), quantity, unit price. One row per line item; rows with same supplier, total amount, withhold %, amount paid, and payment mode are grouped into one order.')
            ])
          ]),

          parseErrors.length > 0 && !importResults && Row({ class: 'flex flex-col gap-2' }, [
            Row({ class: 'text-sm font-semibold text-amber-700' }, `Validation: ${parseErrors.length} error(s)`),
            Row({ class: 'max-h-32 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800' }, [
              parseErrors.slice(0, 10).map((err, i) => Row({ key: i }, err)),
              parseErrors.length > 10 ? Row({}, `... and ${parseErrors.length - 10} more`) : null
            ].filter(Boolean))
          ]),

          !importResults && orders.length > 0 && (() => {
            // Flatten: one row per item; order meta only on first row of each order
            const flatRows = [];
            orders.forEach((ord, ordIndex) => {
              (ord.items || []).forEach((item, itemIndex) => {
                flatRows.push({
                  isFirstRowOfOrder: itemIndex === 0,
                  order: ord,
                  item: item
                });
              });
            });
            const displayRows = flatRows.slice(0, 50);
            return Row({ class: 'flex flex-col gap-4 w-full min-w-0' }, [
              Row({ class: 'flex items-center justify-between' }, [
                Row({ class: 'text-sm font-semibold text-gray-700' }, 'Preview'),
                Row({ class: 'text-sm text-gray-600' }, `${orders.length} order(s), ${flatRows.length} item(s)`)
              ]),
              Row({ class: 'border border-gray-200 rounded-lg overflow-hidden max-h-96 w-full min-w-0' }, [
                Table({ class: 'w-full', tableClass: 'w-full table-fixed' }, [
                  TableHeader({ class: 'bg-gray-50 border-b border-gray-200 sticky top-0' }, [
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3' }, 'Supplier'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3' }, 'Date'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3' }, 'Payment'),
                    TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase py-2 px-3' }, 'Total'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3 border-l border-gray-200' }, 'Product'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3' }, 'Batch'),
                    TableHCell({ class: 'text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3' }, 'Expiry'),
                    TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase py-2 px-3' }, 'Qty'),
                    TableHCell({ class: 'text-right text-xs font-semibold text-gray-500 uppercase py-2 px-3' }, 'Unit Price')
                  ]),
                  TableBody({}, displayRows.map((row, idx) =>
                    TableRow({
                      key: idx,
                      class: row.isFirstRowOfOrder ? 'border-t border-gray-200 bg-gray-50/50' : ''
                    }, [
                      TableDCell({ class: 'px-3 py-2 text-sm text-gray-900 align-top' }, row.isFirstRowOfOrder ? (row.order.supplier_name || '') : ''),
                      TableDCell({ class: 'px-3 py-2 text-sm text-gray-900 align-top' }, row.isFirstRowOfOrder ? (row.order.order_date || '') : ''),
                      TableDCell({ class: 'px-3 py-2 text-sm text-gray-900 align-top' }, row.isFirstRowOfOrder ? (row.order.payment_mode || '') : ''),
                      TableDCell({ class: 'px-3 py-2 text-sm text-gray-900 text-right align-top' }, row.isFirstRowOfOrder && row.order.total_amount != null ? Number(row.order.total_amount).toLocaleString() : ''),
                      TableDCell({ class: 'px-3 py-2 text-sm text-gray-900 border-l border-gray-100 align-top whitespace-normal' }, row.item.product_name || ''),
                      TableDCell({ class: 'px-3 py-2 text-sm text-gray-600 align-top whitespace-normal' }, row.item.batch_number || ''),
                      TableDCell({ class: 'px-3 py-2 text-sm text-gray-600 align-top whitespace-normal' }, row.item.expiry_date || ''),
                      TableDCell({ class: 'px-3 py-2 text-sm text-gray-900 text-right align-top' }, row.item.quantity != null ? String(row.item.quantity) : ''),
                      TableDCell({ class: 'px-3 py-2 text-sm text-gray-900 text-right align-top' }, row.item.unit_price != null ? Number(row.item.unit_price).toLocaleString() : '')
                    ])
                  ))
                ])
              ]),
              flatRows.length > 50 && Row({ class: 'text-xs text-gray-500' }, `Showing first 50 of ${flatRows.length} item rows.`)
            ]);
          })(),

          importResults && Row({ class: 'flex flex-col gap-4' }, [
            Row({ class: 'text-sm font-semibold text-gray-700' }, 'Import Results'),
            Row({ class: 'bg-gray-50 rounded-lg p-4 border border-gray-200' }, [
              Row({ class: 'grid grid-cols-3 gap-4' }, [
                Row({ class: 'flex flex-col' }, [
                  Row({ class: 'text-xs text-gray-500 mb-1' }, 'Total'),
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
              Row({ class: 'text-sm text-green-800' }, `Successfully imported ${importResults.successful} order(s).`)
            ]),
            importResults.failed > 0 && importResults.failedList?.length > 0 && Row({ class: 'flex flex-col gap-2' }, [
              Row({ class: 'text-sm font-semibold text-red-700' }, 'Failed orders'),
              Row({ class: 'max-h-24 overflow-y-auto rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 flex flex-col gap-1' },
                importResults.failedList.map((f, i) => Row({ key: i }, `Order ${f.index + 1}: ${f.error}`))
              )
            ])
          ])
        ])
      ]),

      CardFooter({ class: 'flex justify-end gap-3 px-6 py-4 border-t border-gray-200' }, [
        !importResults && Button({ variant: 'secondary', onClick: handleClose, delegator }, 'Cancel'),
        !importResults && file && Button({
          variant: 'primary',
          onClick: handleImport,
          disabled: !canImport || importing,
          delegator
        }, importing ? [Spinner(), ' Importing...'] : `Import ${orders.length} Order(s)`),
        importResults && Button({
          variant: 'primary',
          onClick: () => { handleClose(); },
          delegator
        }, 'Done')
      ])
    ]);
  };

  return StatefulRow({
    class: 'w-full h-full',
    viewModel: props.viewModel,
    stateKeys: ['loading']
  }, render);
}
