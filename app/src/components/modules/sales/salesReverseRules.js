/**
 * Must stay aligned with api/src/utils/salesWithhold.js (effectiveWithholdConfirmed).
 */
export function isWithholdEffectivelyConfirmed(order) {
  const withhold = Number(order?.withhold_amount ?? 0);
  if (withhold <= 0.009) return false;
  if (order?.withhold_ref != null && String(order.withhold_ref).trim() !== '') return true;
  return Boolean(order?.withhold_confirmation);
}

/** True when Reverse must not run (show disabled control). */
export function isSalesReverseDisabled(order) {
  return getSalesReverseBlockReason(order) != null;
}

/**
 * Must stay aligned with api/src/utils/salesWithhold.js getSalesReverseBlockReason.
 */
function toBooleanFlag(v) {
  if (v === true || v === 1 || v === '1') return true;
  if (v === false || v === 0 || v === '0') return false;
  if (v == null) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === 't') return true;
    if (s === 'false' || s === 'f' || s === '') return false;
  }
  return Boolean(v);
}

export function getSalesReverseBlockReason(order) {
  if (!order) return 'Sales order not found';
  if (toBooleanFlag(order.is_reversed)) return 'Order is already reversed';

  const settled =
    order.withhold_settled === true ||
    order.withhold_settled === 1 ||
    order.withhold_settled === '1';
  if (settled) {
    return 'This sale cannot be reversed because withhold tax was already settled.';
  }

  const withhold = Number(order.withhold_amount ?? 0);
  if (withhold <= 0.009) return null;

  if (isWithholdEffectivelyConfirmed(order)) {
    return 'Cannot reverse while withhold is confirmed. Roll back withhold confirmation on this order, then reverse the sale.';
  }

  return null;
}
