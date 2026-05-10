import { Button, Spinner } from '../utils/Button'
import { Card, CardHeader, CardBody, CardFooter } from '../utils/Card'
import { IconButton, IonIcon } from '../utils/Icon'
import { Input } from '../utils/Input'
import { Table, TableBody, TableHeader, TableHCell, TableRow, TableDCell } from '../utils/Table'
import { permissionChecker } from '../utils/PermissionChecker'

const { Row, StatefulRow } = Liteframe

const MAX_FILE_BYTES = 50 * 1024 * 1024

const CUSTOMER_TEMPLATE_CSV =
  'Name,Contact Person,Phone,Email,Address,License No,TIN No,Website,Fax,Country,Customer Type\r\n' +
  'Example Pharmacy PLC,Jane Buyer,+251911000000,buyer@example.com,"Bole, Addis Ababa",,,,,Ethiopia,supplier\r\n'

function downloadCustomerImportTemplate () {
  const blob = new Blob([CUSTOMER_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'customers_import_template.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const ModalContent = (viewModel, delegator, handleClose) => {
  const render = (statefulProps) => {
    const props = {
      ...statefulProps,
      delegator,
      handleClose
    }

    props.ensureLocalStateKey('phase', 'pick')
    props.ensureLocalStateKey('selectedFile', null)
    props.ensureLocalStateKey('uploadResponse', null)
    props.ensureLocalStateKey('dragOver', false)
    props.ensureLocalStateKey('fileInputId', `import-customers-${Date.now()}`)

    const phase = props.getLocalState('phase')
    const selectedFile = props.getLocalState('selectedFile')
    const uploadResponse = props.getLocalState('uploadResponse')
    const dragOver = props.getLocalState('dragOver')
    const fileInputId = props.getLocalState('fileInputId')

    const assignFile = (file) => {
      if (!file) return
      const name = (file.name || '').toLowerCase()
      if (!name.endsWith('.csv')) {
        props.setLocalState('selectedFile', null)
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        props.setLocalState('selectedFile', null)
        return
      }
      if (file.size === 0) return
      props.setLocalState('selectedFile', file)
      props.setLocalState('uploadResponse', null)
    }

    const onInputChange = (e) => {
      assignFile(e.target?.files?.[0])
    }

    const onDrop = (e) => {
      e.preventDefault()
      e.stopPropagation?.()
      props.setLocalState('dragOver', false)
      assignFile(e.dataTransfer?.files?.[0])
    }

    const removeFile = () => {
      props.setLocalState('selectedFile', null)
      props.setLocalState('uploadResponse', null)
      const input = document.getElementById(fileInputId)
      if (input) input.value = ''
    }

    const handleConfirm = async () => {
      const f = props.getLocalState('selectedFile')
      if (!f) return
      const hasPermission = await permissionChecker.checkPermission('CanImportCustomers', {
        actionName: 'import customers'
      })
      if (!hasPermission) return

      props.setLocalState('phase', 'uploading')
      try {
        const result = await props.viewModel.bulkImportCustomersFromFile(f)
        props.setLocalState('uploadResponse', result ?? {
          success: false,
          error: 'Import did not return a result',
          summary: null,
          results: []
        })
        props.setLocalState('phase', 'done')
      } catch (_err) {
        const msg = _err?.message || 'Upload failed'
        props.setLocalState('uploadResponse', {
          success: false,
          error: msg.includes('maxContentLength') || msg.includes('maxBodyLength')
            ? 'Server response was too large for the client. Try again after updating the app, or split the CSV into smaller files.'
            : msg,
          summary: null,
          results: []
        })
        props.setLocalState('phase', 'done')
      }
    }

    const skippedRows =
      uploadResponse?.results?.filter((r) => r && r.success === false && r.skipped) || []
    const errorRowsHard =
      uploadResponse?.results?.filter((r) => r && r.success === false && !r.skipped) || []
    const allProblemRows =
      uploadResponse?.results?.filter((r) => r && r.success === false) || []

    const summary = uploadResponse?.summary || {}
    const skippedCount =
      typeof summary.skipped === 'number' ? summary.skipped : skippedRows.length
    const validationFailed = summary.validationFailed ?? 0
    const errorCount =
      typeof summary.errors === 'number'
        ? summary.errors
        : errorRowsHard.length

    const doneBody =
      uploadResponse &&
      Row({ class: 'flex flex-col gap-4' }, [
        Row({ class: 'text-sm font-semibold text-gray-800' }, 'Import result'),
        Row(
          { class: 'text-xs text-gray-600 bg-slate-50 border border-slate-200 rounded p-3' },
          'Valid rows are saved; invalid or duplicate rows are skipped. Duplicate = same contact person as an existing customer or repeated in this file. Name and contact person are required; other columns optional. Re-export from the app is supported (Created At / Last Updated are ignored on import).'
        ),
        uploadResponse.error &&
          Row({ class: 'text-sm text-red-600' }, uploadResponse.error),
        uploadResponse.summary &&
          Row({ class: 'bg-gray-50 rounded-lg p-4 border border-gray-200' }, [
            Row({ class: 'grid grid-cols-2 sm:grid-cols-4 gap-4' }, [
              Row({ class: 'flex flex-col' }, [
                Row({ class: 'text-xs text-gray-500 mb-1' }, 'Total rows'),
                Row({ class: 'text-2xl font-bold text-gray-800' }, String(uploadResponse.summary.total ?? 0))
              ]),
              Row({ class: 'flex flex-col' }, [
                Row({ class: 'text-xs text-gray-500 mb-1' }, 'Imported'),
                Row({ class: 'text-2xl font-bold text-green-600' }, String(uploadResponse.summary.successful ?? 0))
              ]),
              Row({ class: 'flex flex-col' }, [
                Row({ class: 'text-xs text-gray-500 mb-1' }, 'Validation / errors'),
                Row({ class: 'text-2xl font-bold text-red-600' }, String(errorCount))
              ]),
              Row({ class: 'flex flex-col' }, [
                Row({ class: 'text-xs text-gray-500 mb-1' }, 'Skipped (duplicate)'),
                Row({ class: 'text-2xl font-bold text-amber-600' }, String(skippedCount))
              ])
            ]),
            validationFailed > 0 &&
              Row({ class: 'text-xs text-gray-500 mt-2' }, `${validationFailed} row(s) failed validation before insert.`)
          ]),
        allProblemRows.length > 0 &&
          Row({ class: 'flex flex-col gap-2' }, [
            Row({ class: 'text-sm font-medium text-red-800' }, 'Rows not imported (by CSV line)'),
            Row({ class: 'border border-red-200 rounded-lg overflow-hidden max-h-72 flex flex-col' }, [
              Table({ class: 'w-full text-sm' }, [
                TableHeader({ class: 'bg-red-50 sticky top-0' }, [
                  TableHCell({ class: 'px-3 py-2 text-left font-semibold text-gray-600' }, 'CSV line'),
                  TableHCell({ class: 'px-3 py-2 text-left font-semibold text-gray-600' }, 'Detail')
                ]),
                TableBody({},
                  allProblemRows.map((r) =>
                    TableRow({ key: `c-imp-${r.csvRowNumber}-${r.index}`, class: 'border-t border-red-100' }, [
                      TableDCell({ class: 'px-3 py-2' }, String(r.csvRowNumber ?? '—')),
                      TableDCell({ class: 'px-3 py-2 text-red-800' },
                        `${r.error || '—'}${r.skipped ? ' (duplicate / skipped)' : ''}`)
                    ])
                  )
                )
              ])
            ])
          ]),
        uploadResponse.summary &&
          (uploadResponse.summary.failed ?? 0) === 0 &&
          (uploadResponse.summary.successful ?? 0) > 0 &&
          Row({ class: 'bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800' }, [
            'All rows imported successfully.'
          ])
      ])

    const pickBody = Row({ class: 'flex flex-col gap-4' }, [
      Row({ class: 'text-xs text-gray-500' }, 'CSV only. Maximum file size 50MB. Required: Name, Contact Person. Other columns match export (Phone, Email, Address, …). Import runs on the server; valid rows are inserted and the rest are reported below.'),
      Row({ class: 'flex flex-wrap items-center gap-2' }, [
        Button(
          {
            variant: 'secondary',
            delegator,
            onClick: () => downloadCustomerImportTemplate()
          },
          Row({ class: 'flex items-center gap-2' }, [
            IonIcon({ name: 'download-outline', class: 'text-lg' }),
            'Download CSV template'
          ])
        )
      ]),
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
            ev.preventDefault()
            props.setLocalState('dragOver', true)
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
    ])

    return Card(
      { class: 'bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shrink-0' },
      [
        CardHeader({ class: 'flex justify-between items-center px-6 h-12 border-b border-gray-200' }, [
          Row({ class: 'flex items-center gap-3' }, [
            IonIcon({ name: 'cloud-upload-outline', class: 'text-xl text-indigo-600' }),
            Row({ tagType: 'h2', class: 'text-xl font-semibold text-gray-800' }, 'Import customers')
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
              Row({ class: 'text-sm text-gray-600' }, 'Uploading and importing…')
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
                disabled: !selectedFile,
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
                  props.setLocalState('phase', 'pick')
                  props.setLocalState('selectedFile', null)
                  props.setLocalState('uploadResponse', null)
                  handleClose()
                }
              },
              'Done'
            )
        ])
      ]
    )
  }

  return StatefulRow({
    class: 'fixed inset-0 flex w-full items-center justify-center p-4 box-border',
    viewModel,
    delegator,
    stateKeys: ['loading']
  }, render)
}

export default ModalContent
