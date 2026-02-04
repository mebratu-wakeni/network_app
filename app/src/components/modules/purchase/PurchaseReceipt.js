/**
 * Compact, professional purchase receipt. From/To max 2 lines; layout optimized for A4 and multi-page print.
 */
const { Row, EventDelegator } = Liteframe;

const formatMoney = (amount) => {
  if (amount == null || (typeof amount === 'number' && isNaN(amount))) return amount ?? '';
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const joinNonEmpty = (arr, sep = ' · ') => arr.filter(Boolean).map((s) => String(s).trim()).filter(Boolean).join(sep);

/**
 * @param {Object} receiptData - fromCompany, toSupplier, orderDetails, items, summary, notesAndTerms, footerInfo, watermarkText, receiptNo, dateIssued
 * @param {EventDelegator} delegator
 * @param {boolean} isReversed
 * @returns {HTMLElement}
 */
export function PurchaseReceipt(receiptData, delegator = Liteframe.mainDelegator, isReversed = false) {
  const fromCompany = receiptData.fromCompany || {};
  const toSupplier = receiptData.toSupplier || {};
  const orderDetails = receiptData.orderDetails || {};
  const items = receiptData.items || [];
  const summary = receiptData.summary || {};
  const notesAndTerms = receiptData.notesAndTerms || { list: [] };
  const footerInfo = receiptData.footerInfo || {};

  const renderRichText = (textWithHtml) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = textWithHtml;
    return Array.from(tempDiv.childNodes);
  };

  // FROM = Supplier (we buy from). Line 1 = name, line 2 = address · Contact · Email · TIN
  const fromLine1 = toSupplier.supplierName || '';
  const fromLine2 = joinNonEmpty([
    toSupplier.address,
    toSupplier.contactPerson ? `Contact: ${toSupplier.contactPerson}` : null,
    toSupplier.email ? `Email: ${toSupplier.email}` : null,
    (toSupplier.taxId && toSupplier.taxId !== 'N/A') ? `TIN: ${toSupplier.taxId}` : null,
  ], ' · ');

  // TO = Company (purchasing entity). Line 1 = name, line 2 = address · Ph · Email · TIN
  const toLine1 = fromCompany.businessName || '';
  const toLine2 = joinNonEmpty([
    fromCompany.address,
    fromCompany.phone && `Ph: ${fromCompany.phone}`,
    fromCompany.email,
    fromCompany.taxId && `TIN: ${fromCompany.taxId}`,
  ], ' · ');

  // --- HEADER (compact: one row) ---
  const header = Row({
    tagType: 'header',
    classNames: ['receipt-header', 'receipt-header-compact'],
    children: [
      Row({
        classNames: ['company-logo', 'company-logo-compact'],
        children: [fromCompany.businessName || ''],
        delegator,
      }),
      Row({
        classNames: ['receipt-title-section', 'receipt-meta-inline'],
        children: [
          Row({ tagType: 'span', classNames: ['receipt-doc-title'], children: ['Purchase Receipt'], delegator }),
          Row({ tagType: 'span', classNames: ['receipt-meta-sep'], children: [' | '], delegator }),
          Row({ tagType: 'span', children: ['No: ', Row({ tagType: 'strong', children: [receiptData.receiptNo ?? ''], delegator })], delegator }),
          Row({ tagType: 'span', classNames: ['receipt-meta-sep'], children: [' | '], delegator }),
          Row({ tagType: 'span', children: [`Date: ${receiptData.dateIssued ?? ''}`], delegator }),
        ],
        delegator,
      }),
    ],
    delegator,
  });

  // --- FROM (Supplier) | TO (Company): two columns; TO column right-aligned ---
  const detailsGrid = Row({
    classNames: ['receipt-parties-compact'],
    children: [
      Row({
        classNames: ['receipt-party-column', 'receipt-party-from-column'],
        children: [
          Row({
            classNames: ['receipt-parties-row'],
            children: [
              Row({ tagType: 'span', classNames: ['receipt-party-label'], children: ['FROM'], delegator }),
              Row({ tagType: 'span', classNames: ['receipt-party-name'], children: [fromLine1], delegator }),
            ],
            delegator,
          }),
          Row({
            classNames: ['receipt-parties-row', 'receipt-parties-details'],
            children: [Row({ tagType: 'span', classNames: ['receipt-party-detail'], children: [fromLine2 || '—'], delegator })],
            delegator,
          }),
        ],
        delegator,
      }),
      Row({
        classNames: ['receipt-party-column', 'receipt-party-to-column'],
        children: [
          Row({
            classNames: ['receipt-parties-row'],
            children: [
              Row({ tagType: 'span', classNames: ['receipt-party-label'], children: ['TO'], delegator }),
              Row({ tagType: 'span', classNames: ['receipt-party-name'], children: [toLine1], delegator }),
            ],
            delegator,
          }),
          Row({
            classNames: ['receipt-parties-row', 'receipt-parties-details'],
            children: [Row({ tagType: 'span', classNames: ['receipt-party-detail'], children: [toLine2 || '—'], delegator })],
            delegator,
          }),
        ],
        delegator,
      }),
    ],
    delegator,
  });

  // --- ORDER & PAYMENT (one compact line) ---
  const orderLine = joinNonEmpty([
    orderDetails.purchaseDate && `Date: ${orderDetails.purchaseDate}`,
    orderDetails.paymentMode && `Payment: ${orderDetails.paymentMode}`,
    orderDetails.withholdTaxInfo && orderDetails.withholdTaxInfo !== 'N/A' ? `Withhold: ${orderDetails.withholdTaxInfo}` : null,
    orderDetails.status && `Status: ${orderDetails.status}`,
    orderDetails.referencePO && `Ref: ${orderDetails.referencePO}`,
  ], ' · ');

  const orderDetailsSection = Row({
    classNames: ['receipt-order-line'],
    children: [orderLine || '—'],
    delegator,
  });

  // --- ITEMS TABLE (compact; thead repeats on each page in print) ---
  const itemsTable = Row({
    classNames: ['section', 'items-purchased', 'items-purchased-compact'],
    children: [
      Row({ tagType: 'h2', classNames: ['items-section-title'], children: ['Items Purchased'], delegator }),
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
            children: items.map((item, index) =>
              Row({
                tagType: 'tr',
                classNames: ['items-row'],
                children: [
                  Row({ tagType: 'td', classNames: ['col-no'], children: [item.id !== undefined ? item.id : index + 1], delegator }),
                  Row({ tagType: 'td', classNames: ['col-code'], children: [item.productCode ?? ''], delegator }),
                  Row({ tagType: 'td', classNames: ['col-desc'], children: [item.description ?? ''], delegator }),
                  Row({ tagType: 'td', classNames: ['col-batch'], children: [item.batchNo ?? ''], delegator }),
                  Row({ tagType: 'td', classNames: ['col-expiry'], children: [item.expiryDate ?? ''], delegator }),
                  Row({ tagType: 'td', classNames: ['col-qty', 'text-center'], children: [item.qty], delegator }),
                  Row({ tagType: 'td', classNames: ['col-price', 'text-right'], children: [formatMoney(item.unitPrice)], delegator }),
                  Row({ tagType: 'td', classNames: ['col-total', 'text-right'], children: [formatMoney(item.totalAmount)], delegator }),
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

  // --- SUMMARY (compact, right-aligned) ---
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
                  Row({ tagType: 'td', children: [formatMoney(summary.subtotal)], delegator }),
                ],
                delegator,
              }),
              summary.withholdTaxPercentage != null && summary.withholdTaxPercentage > 0 && Row({
                tagType: 'tr',
                children: [
                  Row({ tagType: 'td', children: [`Withhold (${Number(summary.withholdTaxPercentage).toFixed(1)}%):`], delegator }),
                  Row({ tagType: 'td', children: [formatMoney(summary.withholdTaxAmount)], delegator }),
                ],
                delegator,
              }),
              summary.vatAmount != null && summary.vatAmount !== undefined && Row({
                tagType: 'tr',
                children: [
                  Row({ tagType: 'td', children: [`VAT (${(summary.vatPercentage ?? 0).toFixed(1)}%):`], delegator }),
                  Row({ tagType: 'td', children: [formatMoney(summary.vatAmount)], delegator }),
                ],
                delegator,
              }),
              Row({
                tagType: 'tr',
                classNames: ['grand-total'],
                children: [
                  Row({ tagType: 'td', children: ['Total Due:'], delegator }),
                  Row({ tagType: 'td', children: [formatMoney(summary.totalAmountDue)], delegator }),
                ],
                delegator,
              }),
              Row({
                tagType: 'tr',
                classNames: ['amount-paid'],
                children: [
                  Row({ tagType: 'td', children: ['Paid:'], delegator }),
                  Row({ tagType: 'td', children: [formatMoney(summary.amountPaid)], delegator }),
                ],
                delegator,
              }),
              Row({
                tagType: 'tr',
                classNames: ['remaining-balance'],
                style: { borderTop: '1px dashed var(--border-color)' },
                children: [
                  Row({ tagType: 'td', children: ['Balance:'], delegator }),
                  Row({ tagType: 'td', children: [formatMoney(summary.remainingBalance)], delegator }),
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

  // --- NOTES (compact: one line or short list) ---
  const notesList = Array.isArray(notesAndTerms.list) ? notesAndTerms.list : [];
  const notesAndTermsSection = notesList.length > 0 ? Row({
    classNames: ['notes-terms-section', 'notes-terms-compact'],
    children: [
      Row({ tagType: 'span', classNames: ['notes-label'], children: [notesAndTerms.title || 'Notes:'], delegator }),
      Row({
        tagType: 'ul',
        classNames: ['notes-list-inline'],
        children: notesList.map((note) =>
          Row({
            tagType: 'li',
            children: typeof note === 'string' && note.includes('<') && note.includes('>') ? renderRichText(note) : [note],
            delegator,
          })
        ),
        delegator,
      }),
    ],
    delegator,
  }) : null;

  // --- FOOTER ---
  const footer = Row({
    tagType: 'footer',
    classNames: ['receipt-footer', 'receipt-footer-compact'],
    children: [
      Row({
        tagType: 'p',
        classNames: ['receipt-footer-line'],
        children: [
          footerInfo.thankYouMessage ?? 'Thank you for your business.',
          ' — ',
          footerInfo.companyLine1 ?? '',
          (fromCompany.phone || footerInfo.emailLink) ? ` · ${fromCompany.phone ?? ''}${fromCompany.phone && footerInfo.emailLink ? ' · ' : ''}${footerInfo.emailLink ?? ''}` : '',
        ],
        delegator,
      }),
      footerInfo.softwareCredit
        ? Row({
            tagType: 'p',
            classNames: ['receipt-footer-line', 'receipt-software-credit'],
            children: [footerInfo.softwareCredit],
            delegator,
          })
        : null,
    ].filter(Boolean),
    delegator,
  });

  // --- WATERMARK ---
  const watermark = Row({
    classNames: ['watermark', isReversed && 'reversed'].filter(Boolean),
    children: [receiptData.watermarkText ?? 'PROCESSED'],
    delegator,
  });

  // --- ASSEMBLE ---
  return Row({
    classNames: ['receipt-container'],
    children: [
      watermark,
      header,
      detailsGrid,
      orderDetailsSection,
      itemsTable,
      summarySection,
      notesAndTermsSection,
      footer,
    ].filter(Boolean),
    delegator,
  });
}
