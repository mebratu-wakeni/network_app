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

/** Generic keep-for-records line. No third-party or fiscal branding. */
export const RECEIPT_FOOTER_WARNING =
  'Keep this receipt for your records. Valid only for the items and amounts stated above.';

export const RECEIPT_DECLARATION =
  'Declaration: The items, quantities, and amounts above are as recorded for this transaction.';

const SMALL_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS_WORDS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function underThousand(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${SMALL_WORDS[hundreds]} hundred`);
  if (rest >= 20) {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    parts.push(ones ? `${TENS_WORDS[tens]}-${SMALL_WORDS[ones]}` : TENS_WORDS[tens]);
  } else if (rest > 0) {
    parts.push(SMALL_WORDS[rest]);
  }
  return parts.join(' ');
}

function integerToWords(n) {
  if (n === 0) return 'zero';
  const scales = [
    [1_000_000_000_000, 'trillion'],
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1_000, 'thousand'],
  ];
  let rem = n;
  const parts = [];
  for (const [scale, name] of scales) {
    if (rem < scale) continue;
    const count = Math.floor(rem / scale);
    if (count >= 1000) return n.toLocaleString('en-US');
    parts.push(`${underThousand(count)} ${name}`);
    rem -= count * scale;
  }
  if (rem) parts.push(underThousand(rem));
  return parts.join(' ');
}

/**
 * English amount-in-words for a birr total already on the receipt.
 * Returns '' when the amount is not a finite number.
 */
export function amountInWords(amount) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  const sign = n < 0 ? 'minus ' : '';
  const centsTotal = Math.round((Math.abs(n) + Number.EPSILON) * 100);
  const birr = Math.floor(centsTotal / 100);
  const cents = centsTotal % 100;
  let text;
  if (birr === 0 && cents > 0) {
    text = `${sign}${integerToWords(cents)} ${cents === 1 ? 'cent' : 'cents'} only`;
  } else {
    text = `${sign}${integerToWords(birr)} birr`;
    if (cents) text += ` and ${integerToWords(cents)} ${cents === 1 ? 'cent' : 'cents'}`;
    text += ' only';
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function receiptStatusClass(status) {
  const key = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return key ? `receipt-status-${key}` : '';
}
