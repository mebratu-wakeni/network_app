/**
 * Derive borrow_from / borrow_to obligation status from quantities (source of truth).
 * @param {number} totalBorrowed
 * @param {number} totalReturned
 * @returns {'active'|'partially_returned'|'returned'}
 */
export function deriveBorrowObligationStatus(totalBorrowed, totalReturned) {
  const borrowed = parseInt(totalBorrowed, 10) || 0
  const returned = parseInt(totalReturned, 10) || 0
  const remaining = Math.max(0, borrowed - returned)
  if (remaining <= 0) return 'returned'
  if (returned > 0) return 'partially_returned'
  return 'active'
}
