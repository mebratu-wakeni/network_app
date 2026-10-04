/**
 * A4 purchase receipt: same paper chrome as sales, with supplier (FROM) and company (TO).
 */
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
  receiptPartyPair,
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
export function PurchaseReceipt(receiptData, delegator = Liteframe.mainDelegator, isReversed = false) {
  const fromCompany = receiptData.fromCompany || {};
  const toSupplier = receiptData.toSupplier || {};
  const orderDetails = receiptData.orderDetails || {};
  const summary = receiptData.summary || {};
  const receiptNo = receiptData.receiptNo ?? '';

  const supplierDetail = joinNonEmpty([
    toSupplier.address,
    toSupplier.contactPerson ? `Contact: ${toSupplier.contactPerson}` : null,
    toSupplier.phone ? `Tel: ${toSupplier.phone}` : null,
    toSupplier.email ? `Email: ${toSupplier.email}` : null,
    toSupplier.taxId && toSupplier.taxId !== 'N/A' ? `TIN: ${toSupplier.taxId}` : null,
  ]);

  const companyDetail = joinNonEmpty([
    fromCompany.address,
    fromCompany.phone ? `Tel: ${fromCompany.phone}` : null,
    fromCompany.email,
    fromCompany.taxId ? `TIN: ${fromCompany.taxId}` : null,
  ]);

  const ref =
    orderDetails.referencePO && orderDetails.referencePO !== receiptNo ? orderDetails.referencePO : '';

  return Row({
    classNames: ['receipt-container'],
    children: [
      isReversed ? receiptWatermark(receiptData.watermarkText || 'REVERSED', delegator) : null,
      receiptLetterhead(fromCompany, delegator),
      receiptCopyBar('Company copy', delegator),
      receiptDocTitle('Purchase Receipt', delegator),
      receiptMetaGrid(
        [
          { label: 'Date', value: receiptData.dateIssued || '—' },
          { label: 'Receipt No.', value: receiptNo || '—' },
          ref ? { label: 'Ref', value: ref } : null,
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
      receiptPartyPair(
        {
          from: { label: 'From', name: toSupplier.supplierName || '—', detail: supplierDetail },
          to: { label: 'To', name: fromCompany.businessName || '—', detail: companyDetail },
        },
        delegator
      ),
      receiptItemsTable(receiptData.items, delegator),
      receiptSummary(summary, delegator),
      receiptAmountWords(summary.totalAmountDue, delegator),
      receiptNotes(receiptData.notesAndTerms, delegator),
      receiptSignoff(orderDetails.encoderName, delegator),
      receiptFooter(receiptData.footerInfo, delegator),
    ].filter(Boolean),
    delegator,
  });
}
