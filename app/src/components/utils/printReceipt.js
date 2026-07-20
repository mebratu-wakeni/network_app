/**
 * Print a receipt at the top of the page with a running footer on every PDF page.
 *
 * Moves `#receipt-print-area` to `document.body` so Electron does not offset it by the
 * modal layout. Clones the thank-you footer onto `body` as `position: fixed` so Chromium
 * repeats it on every printed page (spacer approaches cannot do that).
 */
export function printReceiptArea(printArea, title) {
  if (!printArea || typeof window === 'undefined') return;

  if (title) document.title = title;

  const parent = printArea.parentNode;
  if (!parent) {
    window.print();
    return;
  }

  const placeholder = document.createComment('receipt-print-restore');
  parent.insertBefore(placeholder, printArea);
  document.body.appendChild(printArea);

  const sourceFooter = printArea.querySelector('.receipt-footer-compact');
  let runningFooter = null;

  if (sourceFooter) {
    sourceFooter.classList.add('receipt-footer-inflow-hidden');
    runningFooter = sourceFooter.cloneNode(true);
    runningFooter.classList.remove('receipt-footer-inflow-hidden');
    runningFooter.classList.add('receipt-print-running-footer');
    // Must be a direct body child — print CSS hides other body children except the receipt.
    document.body.appendChild(runningFooter);
  }

  try {
    // Chromium/Electron blocks until the print dialog closes.
    window.print();
  } finally {
    runningFooter?.remove();
    sourceFooter?.classList.remove('receipt-footer-inflow-hidden');
    if (placeholder.parentNode) {
      placeholder.parentNode.insertBefore(printArea, placeholder);
      placeholder.remove();
    } else if (printArea.parentNode === document.body) {
      printArea.remove();
    }
  }
}
