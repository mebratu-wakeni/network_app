/**
 * Dashboard formatters: currency, ledger balance display, and working capital.
 * Credit-normal accounts (Revenue 5100, AP 3100) are stored negative in ledger; we show positive.
 */

const NA = '—';
const CURRENCY_PREFIX = 'Br ';

/** Format number as currency (no sign flip). Returns "—" for invalid. */
export function formatCurrency(value) {
  if (value == null || !Number.isFinite(Number(value))) return NA;
  return `${CURRENCY_PREFIX}${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format ledger balance for display. Credit-normal accounts (5100 Revenue, 3100 AP)
 * are stored negative; we show absolute value so "amount" is positive.
 */
export function formatBalance(value, accountCode) {
  if (value == null || !Number.isFinite(Number(value))) return NA;
  let n = Number(value);
  if (accountCode === '5100' || accountCode === '3100') n = Math.abs(n);
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${CURRENCY_PREFIX}${formatted}`;
}

/**
 * Working capital = current asset balances + current liability balances.
 * Liabilities are negative in ledger, so sum(CA) + sum(CL) = CA − |CL|.
 * CA = cash, stock value, receivables; CL = payables, accrued expenses, etc.
 */
export function workingCapitalFromLedger(balances, currentAssetCodes, currentLiabilityCodes) {
  if (!balances || typeof balances !== 'object') return null;
  const b = (code) =>
    balances[code] != null && Number.isFinite(Number(balances[code])) ? Number(balances[code]) : 0;
  const ca = currentAssetCodes.reduce((s, c) => s + b(c), 0);
  const cl = currentLiabilityCodes.reduce((s, c) => s + b(c), 0);
  return ca + cl;
}

/**
 * Gross profit = Revenue (5100) − COGS (6100). Revenue is credit-normal (stored negative).
 */
export function grossProfitFromLedger(balances) {
  if (!balances || typeof balances !== 'object') return null;
  const rev = balances['5100'] != null && Number.isFinite(Number(balances['5100'])) ? Number(balances['5100']) : 0;
  const cogs = balances['6100'] != null && Number.isFinite(Number(balances['6100'])) ? Number(balances['6100']) : 0;
  return Math.abs(rev) - cogs;
}

/** Format numeric stat or count; return "—" for invalid. */
export function formatCount(value) {
  if (value == null || !Number.isFinite(Number(value))) return NA;
  return String(Number(value));
}
