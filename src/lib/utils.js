// Ported 1:1 from the original app's utility functions so behaviour matches exactly.

/** Generates a short random id for list items (addresses, line items, etc.) */
export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function fmt(n) {
  return (Math.round(parseFloat(n || 0) * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return dt.getDate() + '-' + m[dt.getMonth()] + '-' + dt.getFullYear();
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generates the next invoice number for the current month, e.g. "004/JUL".
 * Mirrors autoInvNo() from the original file — counts invoices already
 * created in the current calendar month.
 */
export function autoInvNo(invoices) {
  const now = new Date();
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][now.getMonth()];
  const ym = now.toISOString().slice(0, 7);
  const cnt = invoices.filter((i) => i.date && i.date.slice(0, 7) === ym).length;
  return String(cnt + 1).padStart(3, '0') + '/' + m;
}

export function autoQNo(quotations) {
  const now = new Date();
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][now.getMonth()];
  const ym = now.toISOString().slice(0, 7);
  const cnt = quotations.filter((q) => q.date && q.date.slice(0, 7) === ym).length;
  return 'QT-' + String(cnt + 1).padStart(3, '0') + '/' + m;
}

export function autoPFNo(proforma) {
  const now = new Date();
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][now.getMonth()];
  const ym = now.toISOString().slice(0, 7);
  const cnt = proforma.filter((p) => p.date && p.date.slice(0, 7) === ym).length;
  return 'PI-' + String(cnt + 1).padStart(3, '0') + '/' + m;
}

/**
 * The actual cash amount receivable for an invoice after TDS deduction.
 * Revenue (income earned) is still the full invoice total — TDS is
 * prepaid tax, not a discount — but cash actually landing in the bank
 * is reduced by whatever the client withheld.
 */
export function netReceivable(inv) {
  const total = parseFloat(inv.total) || 0;
  const tds = inv.tdsApplicable ? (parseFloat(inv.tdsAmount) || 0) : 0;
  return Math.max(0, total - tds);
}

export function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + (parseInt(days, 10) || 0));
  return d.toISOString().split('T')[0];
}

export function daysBetween(dateStr, otherStr) {
  if (!dateStr || !otherStr) return 0;
  const a = new Date(dateStr + 'T00:00:00');
  const b = new Date(otherStr + 'T00:00:00');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Indian Financial Year runs April → March. Returns the FY's start year for a date. */
export function dateToFYStart(dateStr) {
  if (!dateStr) return null;
  const [y, m] = dateStr.split('-').map(Number);
  return m >= 4 ? y : y - 1;
}

export function isInFY(dateStr, fyStart) {
  return dateToFYStart(dateStr) === fyStart;
}

export function fyLabel(fyStart) {
  return `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`;
}

export function dlCSV(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Converts a number to words in the Indian numbering system (Lakh/Crore). */
export function n2w(n) {
  n = Math.round(n);
  if (!n) return 'Zero Rupees';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function c(x) {
    if (x < 20) return ones[x];
    if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
    if (x < 1000) return ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + c(x % 100) : '');
    if (x < 100000) return c(Math.floor(x / 1000)) + ' Thousand' + (x % 1000 ? ' ' + c(x % 1000) : '');
    if (x < 10000000) return c(Math.floor(x / 100000)) + ' Lakh' + (x % 100000 ? ' ' + c(x % 100000) : '');
    return c(Math.floor(x / 10000000)) + ' Crore' + (x % 10000000 ? ' ' + c(x % 10000000) : '');
  }
  return c(Math.floor(n)) + ' Rupees';
}

/**
 * Calculates subtotal / tax breakdown / total for a set of invoice/quotation
 * line items, given a GST type ('intra' | 'inter' | 'none') and an advance/discount amount.
 */
export function calcT(items, gstType, adv) {
  let sub = 0, tax = 0;
  items.forEach((i) => {
    const a = (i.qty || 0) * (i.rate || 0);
    const tx = gstType === 'none' ? 0 : a * ((i.tax || 0) / 100);
    sub += a;
    tax += tx;
  });
  const cgst = gstType === 'intra' ? tax / 2 : 0;
  const sgst = gstType === 'intra' ? tax / 2 : 0;
  const igst = gstType === 'inter' ? tax : 0;
  return { subtotal: sub, totalTax: tax, cgst, sgst, igst, total: sub + tax - (adv || 0) };
}
