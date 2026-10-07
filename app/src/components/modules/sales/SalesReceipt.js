/**
 * Dense A4 sales receipt: letterhead seller + Bill To customer (no duplicate FROM).
 */
const { Row } = Liteframe;
import {
  formatReceiptMoney,
  joinNonEmpty,
  companyMonogram,
  renderRichTextNodes,
} from '../../utils/receiptHelpers.js';

function cellText(value) {
  const t = value == null ? '' : String(value).trim();
  return t || '—';
}

/**
 * @param {Object} receiptData
 * @param {EventDelegator} delegator
 * @param {boolean} isReversed
 * @returns {HTMLElement}
 */
export function SalesReceipt(receiptData, delegator = Liteframe.mainDelegator, isReversed = false) {
  const fromCompany = receiptData.fromCompany || {};
  const toCustomer = receiptData.toCustomer || {};
  const orderDetails = receiptData.orderDetails || {};
  const items = receiptData.items || [];
  const summary = receiptData.summary || {};
  const notesAndTerms = receiptData.notesAndTerms || { list: [] };
  const footerInfo = receiptData.footerInfo || {};
  const docTitle = 'Sales Receipt';
  const receiptNo = receiptData.receiptNo ?? '';
  const companyName = fromCompany.businessName || '';
  const isCredit = String(orderDetails.paymentMode || '').toLowerCase() === 'credit';

  const companyContact = joinNonEmpty([
    fromCompany.address,
    fromCompany.phone && `Ph: ${fromCompany.phone}`,
    fromCompany.email,
  ]);

  const billToName = toCustomer.customerName || 'Walk-in';
  const billToDetails = joinNonEmpty([
    toCustomer.address,
    toCustomer.contactPerson ? `Contact: ${toCustomer.contactPerson}` : null,
    toCustomer.phone ? `Ph: ${toCustomer.phone}` : null,
    toCustomer.email ? `Email: ${toCustomer.email}` : null,
    toCustomer.taxId && toCustomer.taxId !== 'N/A' ? `TIN: ${toCustomer.taxId}` : null,
  ]);

  const brandMark = fromCompany.logoUrl
    ? Row({
        tagType: 'img',
        classNames: ['receipt-brand-logo'],
        attributes: { src: fromCompany.logoUrl, alt: companyName || 'Logo' },
        delegator,
      })
    : Row({
        classNames: ['receipt-brand-monogram'],
        children: [companyMonogram(companyName)],
        delegator,
      });

  const header = Row({
    tagType: 'header',
    classNames: ['receipt-header', 'receipt-header-compact', 'receipt-letterhead'],
    children: [
      Row({
        classNames: ['receipt-brand-block'],
        children: [
          brandMark,
          Row({
            classNames: ['receipt-brand-text'],
            children: [
              Row({ classNames: ['receipt-brand-name'], children: [companyName], delegator }),
              fromCompany.taxId
                ? Row({
                    classNames: ['receipt-brand-legal'],
                    children: [`TIN: ${fromCompany.taxId}`],
                    delegator,
                  })
                : null,
              companyContact
                ? Row({ classNames: ['receipt-brand-contact'], children: [companyContact], delegator })
                : null,
            ].filter(Boolean),
            delegator,
          }),
        ],
        delegator,
      }),
      Row({
        classNames: ['receipt-title-section', 'receipt-meta-stack'],
        children: [
          Row({ tagType: 'span', classNames: ['receipt-doc-title'], children: [docTitle], delegator }),
          Row({
            classNames: ['receipt-meta-stack-line'],
            children: [
              Row({
                tagType: 'span',
                children: ['No. ', Row({ tagType: 'strong', children: [receiptNo], delegator })],
                delegator,
              }),
              receiptData.invoiceNo
                ? Row({
                    tagType: 'span',
                    children: [
                      ' · Inv. ',
                      Row({ tagType: 'strong', children: [receiptData.invoiceNo], delegator }),
                    ],
                    delegator,
                  })
                : null,
            ].filter(Boolean),
            delegator,
          }),
          Row({
            classNames: ['receipt-meta-stack-line'],
            children: [`Date: ${receiptData.dateIssued ?? ''}`],
            delegator,
          }),
        ],
        delegator,
      }),
    ],
    delegator,
  });

  const billToSection = Row({
    classNames: ['receipt-bill-to'],
    children: [
      Row({
        classNames: ['receipt-parties-row'],
        children: [
          Row({ tagType: 'span', classNames: ['receipt-party-label'], children: ['BILL TO'], delegator }),
          Row({ tagType: 'span', classNames: ['receipt-party-name'], children: [billToName], delegator }),
        ],
        delegator,
      }),
      billToDetails
        ? Row({
            classNames: ['receipt-parties-row', 'receipt-parties-details'],
            children: [
              Row({ tagType: 'span', classNames: ['receipt-party-detail'], children: [billToDetails], delegator }),
            ],
            delegator,
          })
        : null,
    ].filter(Boolean),
    delegator,
  });

  const statusTokens = [
    'receipt-status-badge',
    `receipt-status-${String(orderDetails.status || 'paid').toLowerCase()}`,
  ];
  const orderLine = joinNonEmpty([
    orderDetails.paymentMode,
    orderDetails.hasWithhold ? `Withhold Ref: ${orderDetails.salesInvoiceNo ?? '—'}` : null,
    orderDetails.encoderName ? `Prepared by: ${orderDetails.encoderName}` : null,
  ]);

  const orderDetailsSection = Row({
    classNames: ['receipt-order-line'],
    children: [
      Row({
        tagType: 'span',
        classNames: ['receipt-order-meta'],
        children: [orderLine || '—'],
        delegator,
      }),
      orderDetails.status
        ? Row({
            tagType: 'span',
            classNames: statusTokens,
            children: [orderDetails.status],
            delegator,
          })
        : null,
    ].filter(Boolean),
    delegator,
  });

  const itemsTable = Row({
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
                  Row({ tagType: 'th', classNames: ['col-no'], children: ['#'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-code', 'nowrap'], children: ['Code'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-desc'], children: ['Product / Service'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-batch', 'nowrap'], children: ['Batch'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-expiry', 'nowrap'], children: ['Expiry'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-qty', 'text-center'], children: ['Qty'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-price', 'text-right'], children: ['Unit (Br)'], delegator }),
                  Row({ tagType: 'th', classNames: ['col-total', 'text-right'], children: ['Total (Br)'], delegator }),
                ],
                delegator,
              }),
            ],
            delegator,
          }),
          Row({
            tagType: 'tbody',
            children: items.map((item, index) =>
              Row({
                tagType: 'tr',
                classNames: ['items-row'],
                children: [
                  Row({
                    tagType: 'td',
                    classNames: ['col-no'],
                    children: [item.id !== undefined ? item.id : index + 1],
                    delegator,
                  }),
                  Row({ tagType: 'td', classNames: ['col-code'], children: [cellText(item.productCode)], delegator }),
                  Row({ tagType: 'td', classNames: ['col-desc'], children: [cellText(item.description)], delegator }),
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

  const summarySection = Row({
    classNames: ['transaction-summary-section', 'transaction-summary-compact'],
    children: [
      Row({
        tagType: 'table',
        classNames: ['summary-table', 'summary-table-compact'],
        children: [
          Row({
            tagType: 'tbody',
            children: [
              Row({
                tagType: 'tr',
                children: [
                  Row({ tagType: 'td', children: ['Subtotal:'], delegator }),
                  Row({ tagType: 'td', children: [formatReceiptMoney(summary.subtotal)], delegator }),
                ],
                delegator,
              }),
              summary.withholdTaxPercentage != null &&
                summary.withholdTaxPercentage > 0 &&
                Row({
                  tagType: 'tr',
                  children: [
                    Row({
                      tagType: 'td',
                      children: [`Withhold (${Number(summary.withholdTaxPercentage).toFixed(1)}%):`],
                      delegator,
                    }),
                    Row({ tagType: 'td', children: [formatReceiptMoney(summary.withholdTaxAmount)], delegator }),
                  ],
                  delegator,
                }),
              summary.vatAmount != null &&
                summary.vatAmount !== undefined &&
                Row({
                  tagType: 'tr',
                  children: [
                    Row({
                      tagType: 'td',
                      children: [`VAT (${(summary.vatPercentage ?? 0).toFixed(1)}%):`],
                      delegator,
                    }),
                    Row({ tagType: 'td', children: [formatReceiptMoney(summary.vatAmount)], delegator }),
                  ],
                  delegator,
                }),
              Row({
                tagType: 'tr',
                classNames: ['grand-total'],
                children: [
                  Row({ tagType: 'td', children: ['Total Due:'], delegator }),
                  Row({ tagType: 'td', children: [formatReceiptMoney(summary.totalAmountDue)], delegator }),
                ],
                delegator,
              }),
              Row({
                tagType: 'tr',
                classNames: ['amount-paid'],
                children: [
                  Row({ tagType: 'td', children: ['Paid:'], delegator }),
                  Row({ tagType: 'td', children: [formatReceiptMoney(summary.amountPaid)], delegator }),
                ],
                delegator,
              }),
              Row({
                tagType: 'tr',
                classNames: ['remaining-balance'],
                children: [
                  Row({ tagType: 'td', children: ['Balance:'], delegator }),
                  Row({ tagType: 'td', children: [formatReceiptMoney(summary.remainingBalance)], delegator }),
                ],
                delegator,
              }),
            ].filter(Boolean),
            delegator,
          }),
        ],
        delegator,
      }),
    ],
    delegator,
  });

  const notesList = Array.isArray(notesAndTerms.list) ? notesAndTerms.list : [];
  const notesAndTermsSection =
    notesList.length > 0
      ? Row({
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
        })
      : null;

  const signaturesSection = isCredit
    ? Row({
        classNames: ['receipt-signatures'],
        children: [
          Row({
            classNames: ['receipt-signature-block'],
            children: [
              Row({ classNames: ['receipt-signature-line'], children: [''], delegator }),
              Row({ classNames: ['receipt-signature-label'], children: ['Authorized signature'], delegator }),
            ],
            delegator,
          }),
          Row({
            classNames: ['receipt-signature-block'],
            children: [
              Row({ classNames: ['receipt-signature-line'], children: [''], delegator }),
              Row({ classNames: ['receipt-signature-label'], children: ['Received by'], delegator }),
            ],
            delegator,
          }),
        ],
        delegator,
      })
    : null;

  const footer = Row({
    tagType: 'footer',
    classNames: ['receipt-footer', 'receipt-footer-compact'],
    children: [
      Row({
        tagType: 'p',
        classNames: ['receipt-footer-line'],
        children: [
          footerInfo.thankYouMessage ?? 'Thank you for your business.',
          companyName ? ` — ${companyName}` : '',
          fromCompany.phone || footerInfo.emailLink
            ? ` · ${joinNonEmpty([fromCompany.phone, footerInfo.emailLink])}`
            : '',
        ],
        delegator,
      }),
      Row({
        tagType: 'p',
        classNames: ['receipt-footer-line', 'receipt-software-credit'],
        children: [
          joinNonEmpty([
            receiptNo && `Receipt ${receiptNo}`,
            footerInfo.softwareCredit || 'PharmaSuit by MasaTech',
          ]),
        ],
        delegator,
      }),
    ],
    delegator,
  });

  const watermark = isReversed
    ? Row({
        classNames: ['watermark', 'reversed'],
        children: [receiptData.watermarkText || 'REVERSED'],
        delegator,
      })
    : null;

  return Row({
    classNames: ['receipt-container'],
    children: [
      watermark,
      header,
      billToSection,
      orderDetailsSection,
      itemsTable,
      summarySection,
      notesAndTermsSection,
      signaturesSection,
      footer,
    ].filter(Boolean),
    delegator,
  });
}
