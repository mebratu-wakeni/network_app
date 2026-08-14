/** Shared receipt formatting helpers (sales + purchase). */

export const RECEIPT_CURRENCY = 'Br';

export function formatReceiptMoney(amount) {
  if (amount == null || (typeof amount === 'number' && Number.isNaN(amount))) return amount ?? '';
  const n = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${RECEIPT_CURRENCY} ${n}`;
}

export function joinNonEmpty(arr, sep = ' · ') {
  return (arr || [])
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(sep);
}

export function companyMonogram(name) {
  const t = String(name || '').trim();
  if (!t) return 'P';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

export function formatPaymentMode(mode) {
  if (!mode) return '';
  return String(mode).replace(/\b\w/g, (c) => c.toUpperCase());
}

export function paymentStatusLabel(paymentStatus, { isReversed = false, remainingBalance = 0 } = {}) {
  if (isReversed) return 'REVERSED';
  const raw = String(paymentStatus || '').toLowerCase();
  if (raw === 'partial' || Number(remainingBalance) > 0.01) return 'PARTIAL';
  if (raw === 'unpaid') return 'UNPAID';
  if (raw === 'paid' || raw === 'completed') return 'PAID';
  return (paymentStatus || 'PAID').toString().toUpperCase();
}

export function renderRichTextNodes(textWithHtml) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = textWithHtml;
  return Array.from(tempDiv.childNodes);
}
