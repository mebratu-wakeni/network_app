/**
 * A4 sales receipt: centered letterhead, boxed meta, buyer block, bordered lines.
 */
const { Row } = Liteframe;
import { joinNonEmpty, receiptStatusClass } from '../../utils/receiptHelpers.js';
import {
  receiptAmountWords,
  receiptCopyBar,
  receiptDocTitle,
  receiptFooter,
  receiptItemsTable,
  receiptLetterhead,
  receiptMetaGrid,
  receiptNotes,
  receiptPartySingle,
  receiptSignoff,
  receiptSummary,
  receiptWatermark,
} from '../../utils/receiptChrome.js';

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
  const summary = receiptData.summary || {};
  const receiptNo = receiptData.receiptNo ?? '';

  const buyerDetail = joinNonEmpty([
    toCustomer.taxId && toCustomer.taxId !== 'N/A' ? `TIN: ${toCustomer.taxId}` : null,
    toCustomer.address,
    toCustomer.contactPerson ? `Contact: ${toCustomer.contactPerson}` : null,
    toCustomer.phone ? `Tel: ${toCustomer.phone}` : null,
    toCustomer.email || null,
  ]);

  const withholdRef =
    orderDetails.hasWithhold && orderDetails.salesInvoiceNo
      ? `Withhold ref: ${orderDetails.salesInvoiceNo}`
      : '';

  return Row({
    classNames: ['receipt-container'],
    children: [
      isReversed ? receiptWatermark(receiptData.watermarkText || 'REVERSED', delegator) : null,
      receiptLetterhead(fromCompany, delegator),
      receiptCopyBar('Customer copy', delegator),
      receiptDocTitle('Sales Receipt', delegator),
      receiptMetaGrid(
        [
          { label: 'Date', value: receiptData.dateIssued || '—' },
          { label: 'Receipt No.', value: receiptNo || '—' },
          receiptData.invoiceNo ? { label: 'Invoice No.', value: receiptData.invoiceNo } : null,
          orderDetails.paymentMode ? { label: 'Payment', value: orderDetails.paymentMode } : null,
          orderDetails.status
            ? {
                label: 'Status',
                value: orderDetails.status,
                valueClass: receiptStatusClass(orderDetails.status),
              }
            : null,
        ].filter(Boolean),
        delegator
      ),
      receiptPartySingle(
        {
          label: 'Buyer',
          name: toCustomer.customerName || 'Walk-in',
          detail: buyerDetail,
        },
        delegator
      ),
      receiptItemsTable(receiptData.items, delegator),
      receiptSummary(summary, delegator),
      receiptAmountWords(summary.totalAmountDue, delegator),
      withholdRef
        ? Row({ classNames: ['receipt-withhold-ref'], children: [withholdRef], delegator })
        : null,
      receiptNotes(receiptData.notesAndTerms, delegator),
      receiptSignoff(orderDetails.encoderName, delegator),
      receiptFooter(receiptData.footerInfo, delegator),
    ].filter(Boolean),
    delegator,
  });
}
