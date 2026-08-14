/**
 * Pure helpers for bulk customer payment preview (FIFO / LIFO waterfill).
 * Shared with tests; mirrors server allocation order in sales.repository.js.
 */

export function formatFinanceAmount(v) {
  return (v != null ? Number(v) : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * @param {Array<{ id: number, order_date?: string, outstanding_balance?: number, receipt_no?: string }>} orders
 * @param {number} paymentAmount
 * @param {'fifo'|'lifo'} allocation
 * @returns {Array<object & { applied: number }>}
 */
export function waterfillPreview(orders, paymentAmount, allocation) {
  const totalPay = Number(paymentAmount);
  if (!Number.isFinite(totalPay) || totalPay <= 0 || !orders?.length) return [];

  let ordered = orders.map((o) => ({ ...o }));
  if (allocation === 'fifo') {
    ordered.sort((a, b) => {
      const cmp = String(a.order_date || '').localeCompare(String(b.order_date || ''));
      if (cmp !== 0) return cmp;
      return a.id - b.id;
    });
  } else {
    ordered.sort((a, b) => {
      const cmp = String(b.order_date || '').localeCompare(String(a.order_date || ''));
      if (cmp !== 0) return cmp;
      return b.id - a.id;
    });
  }

  let remaining = totalPay;
  const lines = [];
  for (const row of ordered) {
    if (remaining <= 0.009) break;
    const out = Number(row.outstanding_balance || 0);
    const slice = Math.min(remaining, out);
    if (slice <= 0.009) continue;
    lines.push({ ...row, applied: slice });
    remaining -= slice;
  }
  return lines;
}
