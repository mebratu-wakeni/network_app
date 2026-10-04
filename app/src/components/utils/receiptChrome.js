/**
 * Shared paper-receipt chrome for sales and purchase (A4 preview + window.print).
 * Layout only: centered letterhead, boxed meta, bordered lines, sign-off, footer.
 */
const { Row } = Liteframe;
import {
  RECEIPT_DECLARATION,
  RECEIPT_FOOTER_WARNING,
  amountInWords,
  formatReceiptMoney,
  renderRichTextNodes,
} from './receiptHelpers.js';

function cellText(value) {
  const t = value == null ? '' : String(value).trim();
  return t || '—';
}

export function receiptWatermark(text, delegator) {
  return Row({
    classNames: ['watermark', 'reversed'],
    children: [text || 'REVERSED'],
    delegator,
  });
}

export function receiptLetterhead(company, delegator) {
  const name = company?.businessName || '';
  const contacts = [
    company?.phone ? `Tel: ${company.phone}` : null,
    company?.email || null,
    company?.taxId ? `TIN: ${company.taxId}` : null,
  ].filter(Boolean);

  return Row({
    tagType: 'header',
    classNames: ['receipt-letterhead'],
    children: [
      company?.logoUrl
        ? Row({
            tagType: 'img',
            classNames: ['receipt-brand-logo'],
            attributes: { src: company.logoUrl, alt: name || 'Logo' },
            delegator,
          })
        : null,
      Row({ classNames: ['receipt-company-name'], children: [name], delegator }),
      company?.address
        ? Row({ classNames: ['receipt-company-address'], children: [company.address], delegator })
        : null,
      contacts.length
        ? Row({
            classNames: ['receipt-contact-row'],
            children: contacts.map((part) =>
              Row({ tagType: 'span', children: [part], delegator })
            ),
            delegator,
          })
        : null,
    ].filter(Boolean),
    delegator,
  });
}

export function receiptCopyBar(label, delegator) {
  if (!label) return null;
  return Row({
    classNames: ['receipt-copy-bar'],
    children: [
      Row({ classNames: ['receipt-copy-label'], children: [label], delegator }),
      Row({ classNames: ['receipt-copy-rule'], children: [''], delegator }),
    ],
    delegator,
  });
}

export function receiptDocTitle(title, delegator) {
  return Row({
    tagType: 'h2',
    classNames: ['receipt-doc-title'],
    children: [title],
    delegator,
  });
}

/** @param {{ label: string, value: string, valueClass?: string }[]} cells */
export function receiptMetaGrid(cells, delegator) {
  const visible = (cells || []).filter((cell) => cell && String(cell.value ?? '').trim() !== '');
  if (!visible.length) return null;
  return Row({
    tagType: 'table',
    classNames: ['receipt-meta-grid'],
    children: [
      Row({
        tagType: 'tbody',
        children: [
          Row({
            tagType: 'tr',
            children: visible.map((cell) =>
              Row({
                tagType: 'td',
                children: [
                  Row({ classNames: ['receipt-meta-label'], children: [cell.label], delegator }),
                  Row({
                    classNames: ['receipt-meta-value', cell.valueClass].filter(Boolean),
                    children: [cell.value],
                    delegator,
                  }),
                ],
                delegator,
              })
            ),
            delegator,
          }),
        ],
        delegator,
      }),
    ],
    delegator,
  });
}

export function receiptPartySingle({ label, name, detail }, delegator) {
  return Row({
    classNames: ['receipt-party-box'],
    children: [
      Row({ classNames: ['receipt-party-label'], children: [label], delegator }),
      Row({ classNames: ['receipt-party-name'], children: [name || '—'], delegator }),
      detail
        ? Row({ classNames: ['receipt-party-detail'], children: [detail], delegator })
        : null,
    ].filter(Boolean),
    delegator,
  });
}

export function receiptPartyPair({ from, to }, delegator) {
  const column = (party) =>
    Row({
      classNames: ['receipt-party-column'],
      children: [
        Row({ classNames: ['receipt-party-label'], children: [party.label], delegator }),
        Row({ classNames: ['receipt-party-name'], children: [party.name || '—'], delegator }),
        Row({
          classNames: ['receipt-party-detail'],
          children: [party.detail || '—'],
          delegator,
        }),
      ],
      delegator,
    });

  return Row({
    classNames: ['receipt-parties-box'],
    children: [column(from), column(to)],
    delegator,
  });
}

export function receiptItemsTable(items, delegator) {
  const rows = Array.isArray(items) ? items : [];
  return Row({
    classNames: ['section', 'items-purchased', 'items-purchased-compact'],
    children: [
      Row({
        tagType: 'table',
        classNames: ['items-table', 'items-table-compact'],
        children: [
          Row({
            tagType: 'thead',
            classNames: ['items-table-head'],
            children: [
              Row({
                tagType: 'tr',
                children: [
                  Row({ tagType: 'th', classNames: ['col-item'], children: ['Item'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-batch'], children: ['Batch'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-expiry'], children: ['Expiry'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-qty', 'text-center'], children: ['Qty'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-price', 'text-right'], children: ['Unit Price'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-total', 'text-right'], children: ['Total'], delegator }),
                ],
                delegator,
              }),
            ],
            delegator,
          }),
          Row({
            tagType: 'tbody',
            children: rows.map((item) => {
              const code = String(item.productCode || '').trim();
              const desc = String(item.description || '').trim();
              const showCode = code && code !== desc;
              return Row({
                tagType: 'tr',
                classNames: ['items-row'],
                children: [
                  Row({
                    tagType: 'td',
                    classNames: ['col-item'],
                    children: [
                      showCode
                        ? Row({ tagType: 'span', classNames: ['receipt-item-code'], children: [code], delegator })
                        : null,
                      Row({
                        tagType: 'span',
                        classNames: ['receipt-item-desc'],
                        children: [cellText(desc || code)],
                        delegator,
                      }),
                    ].filter(Boolean),
                    delegator,
                  }),
                  Row({ tagType: 'td', classNames: ['col-batch'], children: [cellText(item.batchNo)], delegator }),
                  Row({ tagType: 'td', classNames: ['col-expiry'], children: [cellText(item.expiryDate)], delegator }),
                  Row({ tagType: 'td', classNames: ['col-qty', 'text-center'], children: [item.qty ?? '—'], delegator }),
                  Row({
                    tagType: 'td',
                    classNames: ['col-price', 'text-right'],
                    children: [formatReceiptMoney(item.unitPrice)],
                    delegator,
                  }),
                  Row({
                    tagType: 'td',
                    classNames: ['col-total', 'text-right'],
                    children: [formatReceiptMoney(item.totalAmount)],
                    delegator,
                  }),
                ],
                delegator,
              });
            }),
            delegator,
          }),
        ],
        delegator,
      }),
    ],
    delegator,
  });
}

function summaryRow(label, value, rowClass, delegator) {
  const row = {
    tagType: 'tr',
    children: [
      Row({ tagType: 'td', children: [label], delegator }),
      Row({ tagType: 'td', children: [value], delegator }),
    ],
    delegator,
  };
  if (rowClass) row.classNames = rowClass;
  return Row(row);
}

export function receiptSummary(summary, delegator) {
  const s = summary || {};
  const showWithhold = s.withholdTaxPercentage != null && Number(s.withholdTaxPercentage) > 0;
  const showVat = s.vatAmount != null && Number(s.vatAmount) !== 0;
  return Row({
    classNames: ['transaction-summary-section', 'transaction-summary-compact'],
    children: [
      Row({
        tagType: 'table',
        classNames: ['summary-table', 'summary-table-compact'],
        children: [
          Row({
            tagType: 'tbody',
            children: [
              summaryRow('Subtotal', formatReceiptMoney(s.subtotal), null, delegator),
              showWithhold
                ? summaryRow(
                    `Withhold (${Number(s.withholdTaxPercentage).toFixed(1)}%)`,
                    formatReceiptMoney(s.withholdTaxAmount),
                    null,
                    delegator
                  )
                : null,
              showVat
                ? summaryRow(
                    `VAT (${Number(s.vatPercentage ?? 0).toFixed(1)}%)`,
                    formatReceiptMoney(s.vatAmount),
                    null,
                    delegator
                  )
                : null,
              summaryRow('Grand Total', formatReceiptMoney(s.totalAmountDue), ['grand-total'], delegator),
              summaryRow('Paid', formatReceiptMoney(s.amountPaid), ['amount-paid'], delegator),
              summaryRow('Balance', formatReceiptMoney(s.remainingBalance), ['remaining-balance'], delegator),
            ].filter(Boolean),
            delegator,
          }),
        ],
        delegator,
      }),
    ],
    delegator,
  });
}

export function receiptAmountWords(amount, delegator) {
  const words = amountInWords(amount);
  if (!words) return null;
  return Row({
    classNames: ['receipt-amount-words'],
    children: [
      Row({ tagType: 'span', classNames: ['receipt-amount-label'], children: ['Amount in words: '], delegator }),
      words,
    ],
    delegator,
  });
}

export function receiptNotes(notesAndTerms, delegator) {
  const notesList = Array.isArray(notesAndTerms?.list) ? notesAndTerms.list : [];
  if (!notesList.length) return null;
  return Row({
    classNames: ['notes-terms-section', 'notes-terms-compact'],
    children: [
      Row({
        tagType: 'span',
        classNames: ['notes-label'],
        children: [notesAndTerms.title || 'Notes:'],
        delegator,
      }),
      Row({
        tagType: 'ul',
        classNames: ['notes-list-inline'],
        children: notesList.map((note) =>
          Row({
            tagType: 'li',
            children:
              typeof note === 'string' && note.includes('<') && note.includes('>')
                ? renderRichTextNodes(note)
                : [note],
            delegator,
          })
        ),
        delegator,
      }),
    ],
    delegator,
  });
}

export function receiptSignoff(preparedBy, delegator) {
  const blocks = [
    { label: 'Prepared By', name: preparedBy || '' },
    { label: 'Approved By', name: '' },
    { label: 'Received By', name: '' },
  ];
  return Row({
    classNames: ['receipt-signoff'],
    children: [
      Row({
        tagType: 'p',
        classNames: ['receipt-declaration'],
        children: [RECEIPT_DECLARATION],
        delegator,
      }),
      Row({
        classNames: ['receipt-signatures'],
        children: blocks.map((block) =>
          Row({
            classNames: ['receipt-signature-block'],
            children: [
              Row({
                classNames: ['receipt-signature-name'],
                children: [block.name || '\u00a0'],
                delegator,
              }),
              Row({ classNames: ['receipt-signature-line'], children: [''], delegator }),
              Row({ classNames: ['receipt-signature-label'], children: [block.label], delegator }),
            ],
            delegator,
          })
        ),
        delegator,
      }),
    ],
    delegator,
  });
}

export function receiptFooter(footerInfo, delegator) {
  const credit = footerInfo?.softwareCredit || 'PharmaSuit by MasaTech';
  return Row({
    tagType: 'footer',
    classNames: ['receipt-footer', 'receipt-footer-compact'],
    children: [
      Row({
        tagType: 'p',
        classNames: ['receipt-footer-line', 'receipt-footer-warning'],
        children: [RECEIPT_FOOTER_WARNING],
        delegator,
      }),
      Row({
        tagType: 'p',
        classNames: ['receipt-footer-line', 'receipt-software-credit'],
        children: [credit],
        delegator,
      }),
    ],
    delegator,
  });
}
