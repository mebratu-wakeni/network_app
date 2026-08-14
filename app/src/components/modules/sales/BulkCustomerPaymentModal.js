import Modal from '../../shared/Modal';
import { Button } from '../../utils/Button';
import { Input } from '../../utils/Input';
import { IconButton, IonIcon } from '../../utils/Icon';
import { SelectFluid, SelectOptions } from '../../utils/Select';
import { DropdownSearch, DropdownSearchItem } from '../../utils/DropdownSearch';
import { showAlert } from '../../utils/ModalHelpers';
import { formatDateDDMMYYYY } from '../../utils/DateUtils';
import { formatFinanceAmount, waterfillPreview } from './bulkCustomerPaymentAlloc.js';

const { Row, StatefulRow } = Liteframe;

const PAYMENT_MODE_OPTIONS = ['Cash', 'Cheque'];

const ALLOCATION_LABEL = {
  fifo: 'FIFO (oldest orders first)',
  lifo: 'LIFO (newest orders first)',
  manual: 'Manual by order',
};

const financeFormat = formatFinanceAmount;

function sectionCard(headerRow, bodyChildren, options = {}) {
  const allowOverflow = options.allowMenuOverflow === true;
  const zClass = options.elevateStack ? 'relative z-20' : 'relative z-0';
  const overflowClass = allowOverflow ? 'overflow-visible' : 'overflow-hidden';
  return Row(
    {
      class: `rounded-xl border border-slate-200/90 bg-white shadow-sm shadow-slate-900/5 ${overflowClass} flex flex-col ${zClass}`,
    },
    [
      Row(
        {
          class:
            'px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-indigo-50/40 flex-shrink-0',
        },
        [headerRow]
      ),
      Row(
        {
          class: `p-4 md:p-5 flex flex-col gap-4 ${allowOverflow ? 'overflow-visible' : ''}`,
        },
        bodyChildren
      ),
    ]
  );
}

function sectionTitle(title, hint) {
  return Row({ class: 'flex flex-col gap-0.5' }, [
    Row({ class: 'text-xs font-semibold uppercase tracking-wider text-slate-600' }, title),
    hint ? Row({ class: 'text-xs font-normal text-slate-400 normal-case tracking-normal' }, hint) : null,
  ].filter(Boolean));
}

function formField(label, control, hint) {
  return Row({ class: 'flex flex-col gap-1.5 min-w-0' }, [
    Row({ tagType: 'label', class: 'text-sm font-medium text-slate-700' }, label),
    control,
    hint ? Row({ tagType: 'p', class: 'text-xs text-slate-400' }, hint) : null,
  ].filter(Boolean));
}

/**
 * Open modal to receive one payment allocated across a customer's outstanding sales (FIFO default).
 * @param {Object} options
 * @param options.viewModel - SalesVM instance
 * @param {() => void} [options.onApplied]
 */
export async function openBulkCustomerPaymentModal({ viewModel, onApplied }) {
  const defaultDate = new Date().toISOString().split('T')[0];

  Modal({}, (delegator, handleClose) =>
    bulkModalShell(viewModel, delegator, handleClose, defaultDate, onApplied)
  );
}

function bulkModalShell(viewModel, delegator, handleClose, defaultDate, onApplied) {
  const render = (props) => {
    props.ensureLocalStateKey('bulk-search', '');
    props.ensureLocalStateKey('bulk-dd-open', false);
    props.ensureLocalStateKey('bulk-customer-id', null);
    props.ensureLocalStateKey('bulk-display-name', '');
    props.ensureLocalStateKey('bulk-orders', []);
    props.ensureLocalStateKey('bulk-total-outstanding', 0);
    props.ensureLocalStateKey('bulk-loading-orders', false);
    props.ensureLocalStateKey('bulk-amount', '');
    props.ensureLocalStateKey('bulk-allocation', 'fifo');
    props.ensureLocalStateKey('bulk-pay-mode', 'cash');
    props.ensureLocalStateKey('bulk-pay-date', defaultDate);
    props.ensureLocalStateKey('bulk-cheque-bank', '');
    props.ensureLocalStateKey('bulk-cheque-no', '');
    props.ensureLocalStateKey('bulk-cheque-date', '');
    props.ensureLocalStateKey('bulk-notes', '');
    props.ensureLocalStateKey('bulk-submitting', false);
    props.ensureLocalStateKey('bulk-manual', {});

    const searchRaw = props.getLocalState('bulk-search') || '';
    const ddOpen = props.getLocalState('bulk-dd-open');
    const customerId = props.getLocalState('bulk-customer-id');
    const displayName = props.getLocalState('bulk-display-name') || '';
    const bulkCustomerList = viewModel.getState('bulk-payment-customer-list') || [];
    const bulkCustomerDdLoading = viewModel.getState('bulk-payment-customer-dropdown-loading') === true;
    const orders = props.getLocalState('bulk-orders') || [];
    const totalOutstanding = props.getLocalState('bulk-total-outstanding') || 0;
    const loadingOrders = props.getLocalState('bulk-loading-orders');
    const amountStr = props.getLocalState('bulk-amount') ?? '';
    const allocation = props.getLocalState('bulk-allocation') || 'fifo';
    const payMode = props.getLocalState('bulk-pay-mode') || 'cash';
    const payDate = props.getLocalState('bulk-pay-date') || defaultDate;
    const notes = props.getLocalState('bulk-notes') ?? '';
    const submitting = props.getLocalState('bulk-submitting');
    const manualMap = props.getLocalState('bulk-manual') || {};

    const paymentNum = parseFloat(amountStr);

    const previewLines =
      allocation !== 'manual' && orders.length > 0
        ? waterfillPreview(orders, paymentNum, allocation)
        : [];

    const loadOutstanding = async (cid) => {
      if (!cid) {
        props.setLocalState('bulk-orders', []);
        props.setLocalState('bulk-total-outstanding', 0);
        props.setLocalState('bulk-manual', {});
        return;
      }
      props.setLocalState('bulk-loading-orders', true);
      try {
        const r = await viewModel.getCustomerOutstandingForPayment(cid);
        props.setLocalState('bulk-orders', r.orders || []);
        props.setLocalState('bulk-total-outstanding', r.total_outstanding || 0);
        props.setLocalState('bulk-manual', {});
      } catch (err) {
        await showAlert({ message: err.message || 'Failed to load outstanding orders', variant: 'error' });
        props.setLocalState('bulk-orders', []);
        props.setLocalState('bulk-total-outstanding', 0);
      } finally {
        props.setLocalState('bulk-loading-orders', false);
      }
    };

    const selectCustomer = (c) => {
      props.setLocalState('bulk-customer-id', c.id);
      props.setLocalState('bulk-display-name', c.name || c.full_name || 'Customer');
      props.setLocalState('bulk-search', '');
      props.setLocalState('bulk-dd-open', false);
      loadOutstanding(c.id);
    };

    const bulkMenuRows = [];
    if (bulkCustomerDdLoading) {
      bulkMenuRows.push(
        Row({ key: 'bulk-dd-loading', class: 'px-3 py-2 text-xs text-slate-500 italic' }, 'Searching…')
      );
    } else if (bulkCustomerList.length === 0) {
      bulkMenuRows.push(
        Row(
          { key: 'bulk-dd-empty', class: 'px-3 py-2 text-xs text-slate-500' },
          searchRaw.trim() ? 'No customers match your search.' : 'Type to search customers (retailer / both / other).'
        )
      );
    } else {
      bulkMenuRows.push(
        ...bulkCustomerList.map((c) =>
          DropdownSearchItem({
            onSelect: () => selectCustomer(c),
            delegator,
            class: 'py-2.5',
          }, [
            Row({ class: 'font-medium text-slate-900' }, c.name || c.full_name || 'Customer'),
            c.phone || c.contact_person
              ? Row(
                  { class: 'text-xs text-slate-500' },
                  [c.phone || '', c.contact_person ? ` · ${c.contact_person}` : ''].join('')
                )
              : null,
          ].filter(Boolean))
        )
      );
    }

    const clearCustomer = () => {
      props.setLocalState('bulk-customer-id', null);
      props.setLocalState('bulk-display-name', '');
      props.setLocalState('bulk-orders', []);
      props.setLocalState('bulk-total-outstanding', 0);
      props.setLocalState('bulk-manual', {});
    };

    const handleAllocationChange = (label) => {
      const map = { [ALLOCATION_LABEL.fifo]: 'fifo', [ALLOCATION_LABEL.lifo]: 'lifo', [ALLOCATION_LABEL.manual]: 'manual' };
      props.setLocalState('bulk-allocation', map[label] || 'fifo');
      props.setLocalState('bulk-manual', {});
    };

    const payModeDisplay = payMode === 'cheque' ? 'Cheque' : 'Cash';

    const handleSubmit = async () => {
      if (!customerId) {
        await showAlert({ message: 'Select a customer.', variant: 'error' });
        return;
      }
      if (loadingOrders) return;
      if (!orders.length) {
        await showAlert({ message: 'No outstanding orders for this customer.', variant: 'error' });
        return;
      }
      const num = parseFloat(amountStr);
      if (!Number.isFinite(num) || num <= 0) {
        await showAlert({ message: 'Enter a valid payment amount.', variant: 'error' });
        return;
      }
      if (num > totalOutstanding + 0.02) {
        await showAlert({
          message: `Amount cannot exceed total outstanding (Br ${financeFormat(totalOutstanding)}).`,
          variant: 'error',
        });
        return;
      }
      if (payMode === 'cheque') {
        const bank = (props.getLocalState('bulk-cheque-bank') || '').trim();
        const cq = (props.getLocalState('bulk-cheque-no') || '').trim();
        const cd = (props.getLocalState('bulk-cheque-date') || '').trim();
        if (!bank || !cq || !cd) {
          await showAlert({ message: 'Complete cheque details.', variant: 'error' });
          return;
        }
      }

      let manual_allocations = null;
      if (allocation === 'manual') {
        manual_allocations = orders
          .map((o) => {
            const raw = manualMap[o.id];
            const a = parseFloat(raw != null && raw !== '' ? raw : '0');
            return { sales_order_id: o.id, amount: a };
          })
          .filter((x) => x.amount > 0.009);
        const sum = manual_allocations.reduce((s, x) => s + x.amount, 0);
        if (Math.abs(sum - num) > 0.02) {
          await showAlert({
            message: 'Manual amounts must sum to the payment amount.',
            variant: 'error',
          });
          return;
        }
      }

      const body = {
        customer_id: customerId,
        payment_amount: num,
        allocation: allocation || 'fifo',
        payment_mode: payMode,
        payment_date: payDate,
        notes: notes.trim() || null,
      };
      if (payMode === 'cheque') {
        body.cheque_details = {
          bank_name: (props.getLocalState('bulk-cheque-bank') || '').trim(),
          cheque_number: (props.getLocalState('bulk-cheque-no') || '').trim(),
          cheque_date: (props.getLocalState('bulk-cheque-date') || '').trim(),
        };
      }
      if (allocation === 'manual') {
        body.manual_allocations = manual_allocations;
      }

      props.setLocalState('bulk-submitting', true);
      try {
        await viewModel.bulkPayCustomerSales(body);
        await showAlert({ message: 'Payment recorded.', variant: 'success' });
        handleClose();
        if (typeof onApplied === 'function') onApplied();
      } catch (e) {
        await showAlert({ message: e.message || 'Failed to record payment', variant: 'error' });
      } finally {
        props.setLocalState('bulk-submitting', false);
      }
    };

    const allocationSelectLabel = ALLOCATION_LABEL[allocation] || ALLOCATION_LABEL.fifo;

    const customerSectionBody = [
      DropdownSearch({
        open: ddOpen,
        value: ddOpen ? props.getLocalState('bulk-search') || '' : displayName || 'Select customer…',
        placeholder: 'Search by name or phone…',
        onInput: (v) => {
          props.setLocalState('bulk-search', v);
          viewModel.updateBulkPaymentCustomerSearch(v);
        },
        onFocus: () => {
          props.setLocalState('bulk-dd-open', true);
          viewModel.loadBulkPaymentCustomers(String(props.getLocalState('bulk-search') || '').trim());
        },
        getOpenState: () => props.getLocalState('bulk-dd-open'),
        setOpenState: () => props.setLocalState('bulk-dd-open', false),
        class: 'w-full relative z-10',
        delegator,
        inputClass: 'bg-white border border-slate-200 focus:border-indigo-500',
        menuClass:
          'z-[160] shadow-xl shadow-slate-900/15 border-slate-200/90 bg-white ring-1 ring-slate-900/5',
      }, bulkMenuRows),
      customerId
        ? Row({ class: 'flex justify-end' }, [
            Button(
              {
                variant: 'outline',
                class: 'text-xs py-1.5 px-3 border-slate-300',
                onClick: clearCustomer,
                delegator,
                disabled: submitting,
              },
              'Clear selection'
            ),
          ])
        : null,
    ];

    const summaryCardInner = loadingOrders
      ? Row({ class: 'flex items-center gap-2 text-sm text-slate-500 py-2' }, [
          Row({ class: 'h-4 w-4 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin' }),
          'Loading outstanding…',
        ])
      : Row({ class: 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3' }, [
          Row({ class: 'flex flex-col gap-1' }, [
            Row({ class: 'text-xs font-medium text-slate-500 uppercase tracking-wide' }, 'Balance due'),
            Row({ class: 'text-2xl md:text-3xl font-semibold tabular-nums text-slate-900 tracking-tight' }, `Br ${financeFormat(totalOutstanding)}`),
          ]),
          orders.length > 0
            ? Row({ class: 'text-xs text-slate-500 bg-slate-100/80 rounded-lg px-3 py-1.5' }, `${orders.length} open order${orders.length === 1 ? '' : 's'}`)
            : null,
        ]);

    const paymentFieldsGrid = [
      Row(
        { class: 'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5' },
        [
          formField(
            'Amount to receive *',
            Row({ class: 'flex gap-2 items-stretch' }, [
              Input({
                type: 'number',
                step: '0.01',
                min: '0',
                value: amountStr,
                onChange: (e) => props.setLocalState('bulk-amount', e.target.value),
                class: 'flex-1 min-w-0 rounded-lg border-slate-200',
                disabled: submitting || !customerId,
                delegator,
              }),
              Button(
                {
                  variant: 'outline',
                  class: 'text-xs shrink-0 px-3 border-slate-300 whitespace-nowrap',
                  onClick: () => {
                    if (totalOutstanding > 0) props.setLocalState('bulk-amount', String(totalOutstanding.toFixed(2)));
                  },
                  delegator,
                  disabled: submitting || totalOutstanding <= 0,
                },
                'Pay all'
              ),
            ]),
            'Cannot exceed total outstanding.'
          ),
          formField(
            'Allocation *',
            SelectFluid(
              {
                value: allocationSelectLabel,
                onChange: (e) => handleAllocationChange(e.target.value),
                disabled: submitting || !orders.length,
                delegator,
                selectClass: 'rounded-lg border-slate-200',
              },
              [
                SelectOptions({
                  options: [ALLOCATION_LABEL.fifo, ALLOCATION_LABEL.lifo, ALLOCATION_LABEL.manual],
                  selectedOption: allocationSelectLabel,
                }),
              ]
            ),
            'FIFO is recommended for typical AR settlement.'
          ),
        ]
      ),
      Row(
        { class: 'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5' },
        [
          formField(
            'Method *',
            SelectFluid(
              {
                value: payModeDisplay,
                onChange: (e) => props.setLocalState('bulk-pay-mode', e.target.value.toLowerCase()),
                disabled: submitting,
                delegator,
                selectClass: 'rounded-lg border-slate-200',
              },
              [SelectOptions({ options: PAYMENT_MODE_OPTIONS, selectedOption: payModeDisplay })]
            )
          ),
          formField(
            'Payment date *',
            Input({
              type: 'date',
              value: payDate,
              onChange: (e) => props.setLocalState('bulk-pay-date', e.target.value),
              class: 'w-full rounded-lg border-slate-200',
              disabled: submitting,
              delegator,
            })
          ),
        ]
      ),
      formField(
        'Notes',
        Input({
          type: 'text',
          value: notes,
          onChange: (e) => props.setLocalState('bulk-notes', e.target.value),
          class: 'w-full rounded-lg border-slate-200',
          disabled: submitting,
          delegator,
          placeholder: 'Optional reference or memo',
        })
      ),
    ];

    const chequeBlock =
      payMode === 'cheque'
        ? Row(
            {
              class:
                'rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white p-4 md:p-5 space-y-4',
            },
            [
              Row({ class: 'flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900/80' }, [
                IonIcon({ name: 'document-text-outline', class: 'text-base' }),
                'Cheque details',
              ]),
              Row({ class: 'grid grid-cols-1 sm:grid-cols-3 gap-4' }, [
                formField(
                  'Bank name *',
                  Input({
                    type: 'text',
                    value: props.getLocalState('bulk-cheque-bank') || '',
                    onChange: (e) => props.setLocalState('bulk-cheque-bank', e.target.value),
                    class: 'w-full rounded-lg border-slate-200',
                    disabled: submitting,
                    delegator,
                  })
                ),
                formField(
                  'Cheque no. *',
                  Input({
                    type: 'text',
                    value: props.getLocalState('bulk-cheque-no') || '',
                    onChange: (e) => props.setLocalState('bulk-cheque-no', e.target.value),
                    class: 'w-full rounded-lg border-slate-200',
                    disabled: submitting,
                    delegator,
                  })
                ),
                formField(
                  'Cheque date *',
                  Input({
                    type: 'date',
                    value: props.getLocalState('bulk-cheque-date') || '',
                    onChange: (e) => props.setLocalState('bulk-cheque-date', e.target.value),
                    class: 'w-full rounded-lg border-slate-200',
                    disabled: submitting,
                    delegator,
                  })
                ),
              ]),
            ]
          )
        : null;

    const previewTable =
      allocation !== 'manual' && previewLines.length > 0
        ? Row({ class: 'rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden' }, [
            Row({ tagType: 'table', class: 'w-full text-sm' }, [
              Row({ tagType: 'thead' }, [
                Row({ tagType: 'tr', class: 'bg-slate-100/95 text-left' }, [
                  Row({ tagType: 'th', class: 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Receipt'),
                  Row({ tagType: 'th', class: 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Date'),
                  Row(
                    { tagType: 'th', class: 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 text-right' },
                    'Outstanding'
                  ),
                  Row(
                    { tagType: 'th', class: 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-indigo-700 text-right' },
                    'This payment'
                  ),
                ]),
              ]),
              Row(
                { tagType: 'tbody' },
                previewLines.map((row) =>
                  Row({ tagType: 'tr', key: row.id, class: 'border-t border-slate-100 text-slate-800' }, [
                    Row({ tagType: 'td', class: 'px-4 py-2.5 font-medium' }, row.receipt_no || '—'),
                    Row({ tagType: 'td', class: 'px-4 py-2.5 text-slate-600' }, formatDateDDMMYYYY(row.order_date)),
                    Row({ tagType: 'td', class: 'px-4 py-2.5 text-right tabular-nums text-slate-600' }, [
                      `Br ${financeFormat(row.outstanding_balance)}`,
                    ]),
                    Row({ tagType: 'td', class: 'px-4 py-2.5 text-right tabular-nums font-medium text-indigo-700' }, [
                      `Br ${financeFormat(row.applied)}`,
                    ]),
                  ])
                )
              ),
            ]),
          ])
        : null;

    const manualTable =
      allocation === 'manual' && orders.length > 0
        ? Row({ class: 'rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden' }, [
            Row({ tagType: 'table', class: 'w-full text-sm' }, [
              Row({ tagType: 'thead' }, [
                Row({ tagType: 'tr', class: 'bg-slate-100/95 text-left' }, [
                  Row({ tagType: 'th', class: 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600' }, 'Receipt'),
                  Row({ tagType: 'th', class: 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 text-right' }, 'Due'),
                  Row(
                    { tagType: 'th', class: 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 text-right w-36' },
                    'Pay now'
                  ),
                ]),
              ]),
              Row(
                { tagType: 'tbody' },
                orders.map((row) =>
                  Row({ tagType: 'tr', key: row.id, class: 'border-t border-slate-100' }, [
                    Row({ tagType: 'td', class: 'px-4 py-2.5 font-medium text-slate-900' }, row.receipt_no || '—'),
                    Row({ tagType: 'td', class: 'px-4 py-2.5 text-right tabular-nums text-slate-600' }, `Br ${financeFormat(row.outstanding_balance)}`),
                    Row({ tagType: 'td', class: 'px-4 py-2' }, [
                      Input({
                        type: 'number',
                        step: '0.01',
                        min: '0',
                        value: manualMap[row.id] != null ? String(manualMap[row.id]) : '',
                        onChange: (e) => {
                          const next = { ...manualMap, [row.id]: e.target.value };
                          props.setLocalState('bulk-manual', next);
                        },
                        class: 'w-full text-right rounded-lg border-slate-200',
                        disabled: submitting,
                        delegator,
                      }),
                    ]),
                  ])
                )
              ),
            ]),
          ])
        : null;

    const allocationHint =
      allocation === 'fifo'
        ? 'Oldest invoices are paid first.'
        : allocation === 'lifo'
          ? 'Newest invoices are paid first.'
          : 'Enter amounts per invoice; they must match the total payment.';

    return Row({ class: 'flex flex-col w-full max-h-[92vh]', delegator }, [
      Row(
        {
          class:
            'flex items-start justify-between gap-4 px-6 py-5 md:px-8 border-b border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-indigo-50/35 flex-shrink-0',
        },
        [
          Row({ class: 'flex items-start gap-4 min-w-0' }, [
            Row(
              {
                class:
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25',
              },
              [IonIcon({ name: 'layers-outline', class: 'text-2xl text-white' })]
            ),
            Row({ class: 'flex flex-col gap-1 min-w-0' }, [
              Row({ class: 'text-lg font-semibold text-slate-900 tracking-tight' }, 'Receive customer payment'),
              Row({ class: 'text-sm text-slate-500 leading-snug max-w-prose' }, [
                'Apply one receipt across open sales for a single customer. ',
                Row({ tagType: 'span', class: 'font-medium text-indigo-600/90' }, 'FIFO'),
                ' is the default allocation.',
              ]),
            ]),
          ]),
          IconButton(
            {
              onClick: handleClose,
              delegator,
              class:
                'shrink-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors',
            },
            [IonIcon({ name: 'close-outline', class: 'text-2xl' })]
          ),
        ]
      ),

      Row(
        { class: 'flex-1 min-h-0 flex flex-col' },
        [
          Row(
            {
              class:
                'flex-shrink-0 px-6 md:px-8 pt-6 md:pt-7 pb-2 flex flex-col gap-6 md:gap-8 overflow-visible',
            },
            [
              Row(
                { class: 'grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 xl:items-start overflow-visible' },
                [
                  Row({ class: 'xl:col-span-5 flex flex-col gap-5 min-w-0 relative z-30 overflow-visible' }, [
                    sectionCard(sectionTitle('Customer', 'Registered retail / both partners only.'), customerSectionBody, {
                      allowMenuOverflow: true,
                      elevateStack: true,
                    }),
                    sectionCard(sectionTitle('Outstanding balance'), [summaryCardInner]),
                  ]),

                  Row({ class: 'xl:col-span-7 flex flex-col gap-5 min-w-0 relative z-10' }, [
                    sectionCard(sectionTitle('Payment', allocationHint), [...paymentFieldsGrid, chequeBlock].filter(Boolean)),
                  ]),
                ]
              ),
            ]
          ),

          ...(previewTable || manualTable
            ? [
                Row(
                  {
                    class:
                      'flex-1 min-h-0 overflow-y-auto px-6 md:px-8 pb-6 md:pb-7 pt-2 border-t border-slate-100/80',
                  },
                  [
                    sectionCard(sectionTitle('Allocation preview', allocation === 'manual' ? 'Manual split' : 'Order of application'), [
                      previewTable || manualTable,
                    ]),
                  ]
                ),
              ]
            : []),
        ]
      ),

      Row(
        {
          class:
            'px-6 md:px-8 py-4 border-t border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 flex-shrink-0',
        },
        [
          Button(
            { variant: 'outline', onClick: handleClose, delegator, disabled: submitting, class: 'border-slate-300 min-w-[7rem]' },
            'Cancel'
          ),
          Button(
            {
              variant: 'primary',
              onClick: handleSubmit,
              delegator,
              disabled: submitting || !customerId || !orders.length || loadingOrders,
              class: 'min-w-[10rem] shadow-md shadow-indigo-600/20',
            },
            submitting ? 'Recording…' : 'Record payment'
          ),
        ]
      ),
    ]);
  };

  return StatefulRow(
    {
      class:
        'w-full max-w-5xl bg-white rounded-2xl shadow-2xl shadow-slate-900/12 ring-1 ring-slate-200/90 overflow-hidden flex flex-col max-h-[92vh]',
      viewModel,
      stateKeys: ['bulk-payment-customer-list', 'bulk-payment-customer-dropdown-loading'],
    },
    render
  );
}
