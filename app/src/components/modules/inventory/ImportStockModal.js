import { Button, Spinner } from '../../utils/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../../utils/Card';
import { IconButton, IonIcon } from '../../utils/Icon';
import { Input } from '../../utils/Input';
import { SelectFluid, SelectOptions } from '../../utils/Select';
import Label from '../../utils/Label';
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../../utils/Table';
import { permissionChecker } from '../../utils/PermissionChecker';

const { Row, StatefulRow } = Liteframe;

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const STOCK_TEMPLATE_CSV =
  'product name,unit,unit cost,quantity,category,location,expiry date,batch number,selling price,product code\r\n' +
  'Example Paracetamol 500mg,Box,125.50,24,Analgesics,Main Store,31/12/2026,B001,,\r\n';

const REASON_OPTIONS = ['Initial Stock', 'Replenishment', 'Stock correction', 'Other'];

function downloadStockImportTemplate() {
  const blob = new Blob([STOCK_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stock_import_template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const ModalContent = (viewModel, delegator, handleClose) => {
  const render = (statefulProps) => {
    const props = {
      ...statefulProps,
      delegator,
      handleClose
    };

    props.ensureLocalStateKey('phase', 'pick');
    props.ensureLocalStateKey('selectedFile', null);
    props.ensureLocalStateKey('uploadResponse', null);
    props.ensureLocalStateKey('dragOver', false);
    props.ensureLocalStateKey('fileInputId', `import-stock-${Date.now()}`);
    props.ensureLocalStateKey('importReasonPreset', 'Initial Stock');
    props.ensureLocalStateKey('importReasonOther', '');

    const phase = props.getLocalState('phase');
    const selectedFile = props.getLocalState('selectedFile');
    const uploadResponse = props.getLocalState('uploadResponse');
    const dragOver = props.getLocalState('dragOver');
    const fileInputId = props.getLocalState('fileInputId');
    const importReasonPreset = props.getLocalState('importReasonPreset');
    const importReasonOther = props.getLocalState('importReasonOther');
    const isOtherReason = importReasonPreset === 'Other';

    const effectiveReason = isOtherReason
      ? (importReasonOther || '').trim()
      : (importReasonPreset || '').trim();

    const assignFile = (file) => {
      if (!file) return;
      const name = (file.name || '').toLowerCase();
      if (!name.endsWith('.csv')) {
        props.setLocalState('selectedFile', null);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        props.setLocalState('selectedFile', null);
        return;
      }
      if (file.size === 0) return;
      props.setLocalState('selectedFile', file);
      props.setLocalState('uploadResponse', null);
    };

    const onInputChange = (e) => {
      assignFile(e.target?.files?.[0]);
    };

    const onDrop = (e) => {
      e.preventDefault();
      e.stopPropagation?.();
      props.setLocalState('dragOver', false);
      assignFile(e.dataTransfer?.files?.[0]);
    };

    const removeFile = () => {
      props.setLocalState('selectedFile', null);
      props.setLocalState('uploadResponse', null);
      const input = document.getElementById(fileInputId);
      if (input) input.value = '';
    };

    const handleConfirm = async () => {
      const f = props.getLocalState('selectedFile');
      if (!f || !effectiveReason) return;
      const hasPermission = await permissionChecker.checkPermission('CanImportStock', {
        actionName: 'import stock'
      });
      if (!hasPermission) return;

      props.setLocalState('phase', 'uploading');
      try {
        const result = await props.viewModel.bulkImportStockFromFile(
          f,
          effectiveReason,
          null,
          null
        );
        props.setLocalState('uploadResponse', result ?? {
          success: false,
          error: 'Import did not return a result',
          summary: null,
          rowErrors: [],
          results: []
        });
        props.setLocalState('phase', 'done');
      } catch (_err) {
        props.setLocalState('uploadResponse', {
          success: false,
          error: _err?.message || 'Upload failed',
          summary: null,
          rowErrors: [],
          results: []
        });
        props.setLocalState('phase', 'done');
      }
    };

    const rowErrorRows = uploadResponse?.rowErrors || [];
    const failedResults =
      uploadResponse?.results?.filter((r) => r && r.success === false) || [];
    const rawIssueRows = rowErrorRows.length ? rowErrorRows : failedResults;
    const stockErrorRows = rawIssueRows
      .map((r) => ({
        line: r.rowNumber ?? (r.index != null ? r.index + 2 : null),
        message: r.error || '—',
        issueKind: r.issueKind === 'warning' ? 'warning' : 'error'
      }))
      .filter((r) => r.issueKind === 'error');
    const stockSummary = uploadResponse?.summary || {};
    const stockErrorCount =
      typeof stockSummary.errors === 'number' ? stockSummary.errors : stockErrorRows.length;

    const doneBody =
      uploadResponse &&
      Row({ class: 'flex flex-col gap-4' }, [
        Row({ class: 'text-sm font-semibold text-gray-800' }, 'Import result'),
        Row(
          { class: 'text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3' },
          'Stock import is all-or-nothing: every row is committed together or the whole import is rolled back. Finance and ledger entries are tied to this batch; fix any errors and upload again.'
        ),
        uploadResponse.error &&
          Row({ class: 'text-sm text-red-600' }, uploadResponse.error),
        uploadResponse.summary &&
          Row({ class: 'bg-gray-50 rounded-lg p-4 border border-gray-200' }, [
            Row({ class: 'grid grid-cols-3 gap-4' }, [
              Row({ class: 'flex flex-col' }, [
                Row({ class: 'text-xs text-gray-500 mb-1' }, 'Total rows'),
                Row({ class: 'text-2xl font-bold text-gray-800' }, String(uploadResponse.summary.total ?? 0))
              ]),
              Row({ class: 'flex flex-col' }, [
                Row({ class: 'text-xs text-gray-500 mb-1' }, 'Imported'),
                Row({ class: 'text-2xl font-bold text-green-600' }, String(uploadResponse.summary.successful ?? 0))
              ]),
              Row({ class: 'flex flex-col' }, [
                Row({ class: 'text-xs text-gray-500 mb-1' }, 'Errors'),
                Row({ class: 'text-2xl font-bold text-red-600' }, String(stockErrorCount))
              ])
            ])
          ]),
        stockErrorRows.length > 0 &&
          Row({ class: 'flex flex-col gap-2' }, [
            Row({ class: 'text-sm font-medium text-red-800' }, 'Errors (by row)'),
            Row({ class: 'border border-red-200 rounded-lg overflow-hidden max-h-72 flex flex-col' }, [
              Table({ class: 'w-full text-sm' }, [
                TableHeader({ class: 'bg-red-50 sticky top-0' }, [
                  TableHCell({ class: 'px-3 py-2 text-left font-semibold text-gray-600' }, 'CSV line'),
                  TableHCell({ class: 'px-3 py-2 text-left font-semibold text-gray-600' }, 'Detail')
                ]),
                TableBody(
                  {},
                  stockErrorRows.map((r) =>
                    TableRow({ class: 'border-t border-red-100' }, [
                      TableDCell({ class: 'px-3 py-2' }, String(r.line ?? '—')),
                      TableDCell({ class: 'px-3 py-2 text-red-800' }, r.message)
                    ])
                  )
                )
              ])
            ])
          ]),
        uploadResponse.success &&
          Row({ class: 'bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800' }, [
            'Stock import completed successfully.'
          ])
      ]);

    const pickBody = Row({ class: 'flex flex-col gap-4' }, [
      Row(
        { class: 'text-xs text-gray-500' },
        'CSV only. Maximum file size 50MB. Required: product name, quantity, and unit cost (purchase cost). Unit, category, location, batch, expiry, selling price, and product code are optional. If unit is omitted, the system uses a default unit (e.g. first available). Expiry (and purchase date when used) must be dd/mm/yyyy. Empty location defaults to Main Store. New products, categories, and units are created when names are provided. Column aliases: purchase cost, purchase price, etc. for unit cost.'
      ),
      Row({ class: 'flex flex-wrap items-center gap-2' }, [
        Button(
          {
            variant: 'secondary',
            delegator,
            onClick: () => downloadStockImportTemplate()
          },
          Row({ class: 'flex items-center gap-2' }, [
            IonIcon({ name: 'download-outline', class: 'text-lg' }),
            'Download CSV template'
          ])
        )
      ]),
      Row(
        { class: 'rounded-lg border border-gray-200 bg-gray-50/80 p-4 flex flex-col gap-3' },
        [
          Row({ class: 'text-sm font-medium text-gray-800' }, 'Import reason'),
          Row({ class: 'flex flex-col gap-2' }, [
            Label({ name: 'import-reason', text: 'Reason *', class: 'text-xs font-medium text-gray-600' }),
            SelectFluid({
              name: 'import-reason',
              containerClass: 'w-full',
              value: importReasonPreset,
              onChange: (e) => {
                const v = e.target.value;
                props.setLocalState('importReasonPreset', v);
                if (v !== 'Other') {
                  props.setLocalState('importReasonOther', '');
                }
              },
              delegator
            }, SelectOptions({
              options: REASON_OPTIONS,
              selectedOption: importReasonPreset
            })),
            isOtherReason &&
              Input({
                type: 'text',
                name: 'import-reason-other',
                placeholder: 'Describe the reason for this stock upload',
                value: importReasonOther,
                onChange: (e) => props.setLocalState('importReasonOther', e.target?.value ?? ''),
                class: 'w-full',
                delegator
              }),
            isOtherReason &&
              Row({ class: 'text-xs text-gray-500' }, 'A short label is stored on stock and ledger notes.')
          ])
        ]
      ),
      Row({ class: 'text-xs text-gray-500' }, 'Validation and import run on the server in a single transaction.'),
      Input({
        type: 'file',
        name: fileInputId,
        accept: '.csv',
        onChange: onInputChange,
        class: 'hidden',
        delegator
      }),
      Row({
        class: `rounded-xl border-2 min-h-[200px] w-full flex flex-col items-center justify-center px-6 py-12 transition-colors ${
          selectedFile
            ? 'border-gray-200 border-solid bg-white'
            : `border-dashed cursor-pointer ${
                dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:border-indigo-300'
              }`
        }`,
        events: {
          dragover: (ev) => {
            ev.preventDefault();
            props.setLocalState('dragOver', true);
          },
          dragleave: () => props.setLocalState('dragOver', false),
          drop: onDrop
        },
        delegator
      }, [
        !selectedFile &&
          Row({
            tagType: 'label',
            attributes: { for: fileInputId },
            class: 'flex flex-col items-center justify-center gap-3 w-full cursor-pointer',
            delegator
          }, [
            IonIcon({ name: 'cloud-upload-outline', class: 'text-5xl text-indigo-500' }),
            Row({ class: 'text-center text-sm font-medium text-gray-700' }, 'Drop your CSV here, or click to browse'),
            Row({ class: 'text-center text-xs text-gray-500' }, 'Max 50MB')
          ]),
        selectedFile &&
          Row({ class: 'flex flex-col items-center justify-center gap-3 w-full max-w-md mx-auto text-center' }, [
            IonIcon({ name: 'document-text-outline', class: 'text-5xl text-gray-400' }),
            Row({ class: 'text-sm font-medium text-gray-900 break-all' }, selectedFile.name),
            Row({ class: 'text-xs text-gray-500' }, `${(selectedFile.size / 1024).toFixed(1)} KB`),
            Row({
              tagType: 'button',
              attributes: { type: 'button' },
              class:
                'text-sm text-red-600 hover:text-red-800 font-medium bg-transparent border-0 cursor-pointer p-0 mx-auto',
              events: { click: removeFile },
              delegator
            }, 'Remove file')
          ])
      ].filter(Boolean))
    ]);

    const canConfirm = !!selectedFile && effectiveReason.length > 0;

    return Card(
      { class: 'bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shrink-0' },
      [
        CardHeader({ class: 'flex justify-between items-center px-6 h-12 border-b border-gray-200' }, [
          Row({ class: 'flex items-center gap-3' }, [
            IonIcon({ name: 'cloud-upload-outline', class: 'text-xl text-indigo-600' }),
            Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Import stock')
          ]),
          IconButton({ onClick: handleClose, size: 'medium', delegator }, [
            IonIcon({ name: 'close-outline', class: 'text-xl' })
          ])
        ]),
        CardBody({ class: 'flex-1 overflow-y-auto p-6' }, [
          phase === 'pick' && pickBody,
          phase === 'uploading' &&
            Row({ class: 'flex flex-col items-center justify-center gap-4 py-16' }, [
              Spinner({ class: 'w-8 h-8' }),
              Row({ class: 'text-sm text-gray-600' }, 'Uploading and validating…')
            ]),
          phase === 'done' && doneBody
        ]),
        CardFooter({ class: 'flex justify-end gap-3 px-6 py-4 border-t border-gray-200' }, [
          phase === 'pick' && Button({ variant: 'secondary', onClick: handleClose, delegator }, 'Cancel'),
          phase === 'pick' &&
            Button(
              {
                variant: 'primary',
                delegator,
                disabled: !canConfirm,
                onClick: handleConfirm
              },
              'Confirm & Upload'
            ),
          phase === 'done' &&
            Button(
              {
                variant: 'primary',
                delegator,
                onClick: () => {
                  props.setLocalState('phase', 'pick');
                  props.setLocalState('selectedFile', null);
                  props.setLocalState('uploadResponse', null);
                  props.setLocalState('importReasonPreset', 'Initial Stock');
                  props.setLocalState('importReasonOther', '');
                  handleClose();
                }
              },
              'Done'
            )
        ])
      ]
    );
  };

  return StatefulRow({
    class: 'fixed inset-0 flex w-full items-center justify-center p-4 box-border',
    viewModel,
    delegator,
    stateKeys: ['inventory-tab']
  }, render);
};

export default ModalContent;
