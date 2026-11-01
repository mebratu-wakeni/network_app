/**
 * Must stay aligned with api/src/utils/salesWithhold.js getSalesReverseBlockReason.
 */
export function getSalesReverseBlockReason(order) {
  if (!order) return 'Sales order not found';
  if (order.is_reversed) return 'Order is already reversed';

  const withhold = Number(order.withhold_amount ?? 0);
  if (withhold <= 0.009) return null;

  if (order.withhold_settled) {
    return 'Cannot reverse: withhold tax on this sale was already settled. Reverse or adjust the withhold settlement first.';
  }

  const confirmed =
    Boolean(order.withhold_confirmation) ||
    (order.withhold_ref != null && String(order.withhold_ref).trim() !== '');

  if (confirmed) {
    return 'Cannot reverse while withhold is confirmed. Roll back withhold confirmation on this order, then reverse the sale.';
  }

  return null;
}
