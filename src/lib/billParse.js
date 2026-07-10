// Best-effort field extraction from raw OCR text using pattern matching.
// GSTIN has a strict fixed format, so that extraction is quite reliable;
// everything else is a rough guess meant to be reviewed/corrected by hand
// (see the review modal in Reports.jsx) rather than trusted blindly —
// this is the tradeoff of free OCR vs. a paid AI vision model.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function toISODate(d, m, y) {
  if (y.length === 2) y = (parseInt(y, 10) > 50 ? '19' : '20') + y;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function findDate(text) {
  let m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    // Assume DD/MM/YYYY (Indian convention) unless the first number can't be a day.
    if (a <= 31 && b <= 12) return toISODate(m[1], m[2], m[3]);
    if (b <= 31 && a <= 12) return toISODate(m[2], m[1], m[3]);
  }
  m = text.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})\b/i);
  if (m) return toISODate(m[1], MONTHS[m[2].toLowerCase()], m[3]);
  return '';
}

function findAmountNear(text, keywords) {
  const lines = text.split('\n');
  let best = 0;
  lines.forEach((line, i) => {
    const low = line.toLowerCase();
    if (keywords.some((k) => low.includes(k))) {
      // check same line and the next line for a number
      const chunk = line + ' ' + (lines[i + 1] || '');
      const nums = chunk.match(/[\d,]+\.?\d*/g) || [];
      nums.forEach((n) => {
        const v = parseFloat(n.replace(/,/g, ''));
        if (!isNaN(v) && v > best) best = v;
      });
    }
  });
  return best;
}

function guessVendorName(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    if (/^[A-Za-z][A-Za-z0-9 &.,'\-]{4,60}$/.test(line) && !/invoice|bill|gstin|tax|receipt/i.test(line)) {
      return line;
    }
  }
  return lines[0] || '';
}

export function parseBillText(text) {
  const cleaned = text.replace(/\s+/g, (m) => (m.includes('\n') ? '\n' : ' '));

  const gstMatch = cleaned.toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/);
  const gst = gstMatch ? gstMatch[0] : '';
  const pan = gst ? gst.slice(2, 12) : (cleaned.toUpperCase().match(/\b[A-Z]{5}\d{4}[A-Z]\b/) || [''])[0];

  const billNoMatch = cleaned.match(/(?:invoice|bill)\s*(?:no|number|#)?[.:]?\s*([A-Za-z0-9\/\-]{3,20})/i);
  const billNo = billNoMatch ? billNoMatch[1] : '';

  const billDate = findDate(cleaned);
  const amount = findAmountNear(cleaned, ['grand total', 'total amount', 'amount payable', 'net payable', 'total due', 'balance due']);
  const gstAmt = findAmountNear(cleaned, ['gst amount', 'total tax', 'igst', 'cgst', 'sgst', 'tax amount']);
  const taxableAmt = findAmountNear(cleaned, ['taxable', 'sub total', 'subtotal', 'basic amount', 'taxable value']);

  return {
    vendor: guessVendorName(cleaned),
    gst,
    pan,
    billNo,
    billDate,
    billMonth: billDate ? billDate.slice(0, 7) : '',
    taxableAmt: taxableAmt || Math.max(0, amount - gstAmt),
    gstAmt,
    amount: amount || (taxableAmt + gstAmt),
  };
}
