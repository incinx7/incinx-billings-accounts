// ICICI Bank "Payment to Adhoc Beneficiaries" (PAB) bulk-upload file
// generator — Option A: this only builds the file. You still upload &
// approve it yourself in ICICI Corporate Internet Banking (CIB); nothing
// here talks to the bank directly.
//
// This format was reverse-engineered directly from ICICI's own
// "Payment to Adhoc Beneficiaries" converter workbook (the Excel tool CIB
// gives you to build this file) — specifically the formulas in its
// "Converter" sheet — not guessed or approximated. If ICICI ever changes
// that template, re-export a couple of its sample rows and this file can
// be re-derived the same way.
//
// Pipe-delimited, one line per record, each line ends with "^":
//   FHR|0011|<debit account>|INR|<total amount>|<record count>|<MM/DD/YYYY>|<file ref>^
//   APO|<NFT|RTG|IFC>|<amount>|INR|<debit account>|0011|<beneficiary IFSC>|<beneficiary account>|0011|<beneficiary name>|<remarks for client>|<remarks for beneficiary>^
// "0011" is a fixed literal baked into ICICI's own template (confirmed from
// their formula) — it is not derived from your account and should not be
// changed.

const RTGS_THRESHOLD = 200000; // RBI: RTGS is only for ₹2,00,000 and above

function mmddyyyy(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`;
}

// ICICI's own field width/character rules — no special characters, and
// none of our delimiter characters ('|' or '^') can ever appear in a field.
function sanitize(str, maxLen) {
  return String(str || '')
    .replace(/[|^]/g, ' ')
    .replace(/[^A-Za-z0-9 .,&\-\/]/g, '')
    .trim()
    .slice(0, maxLen);
}

// Mirrors Excel's default number-to-text conversion (no trailing zeros,
// e.g. 60 -> "60", 1500.50 -> "1500.5") since that's what the real
// converter's formula produces via string concatenation.
function numStr(n) {
  return String(Math.round((parseFloat(n) || 0) * 100) / 100);
}

/**
 * Checks one payable line has everything ICICI's format requires.
 * Returns an array of human-readable problems (empty = ready to pay).
 */
export function validatePayoutItem(item) {
  const problems = [];
  const ifsc = (item.ifsc || '').trim().toUpperCase();
  if (!item.beneAcc || !item.beneAcc.trim()) problems.push('missing bank account number');
  else if (item.beneAcc.trim().length > 34) problems.push('account number too long (max 34 characters)');
  if (!ifsc || ifsc.length !== 11 || ifsc[4] !== '0') problems.push('missing/invalid IFSC code (must be 11 characters, 5th character "0")');
  if (!item.beneName || !sanitize(item.beneName, 32)) problems.push('missing beneficiary name');
  if (!item.amount || parseFloat(item.amount) <= 0) problems.push('invalid amount');
  if (numStr(item.amount).length > 15) problems.push('amount too large for this file format');
  return problems;
}

/**
 * Checks the company's own settings have what the file header needs.
 */
export function validateCompanyBankDetails(companySettings) {
  const problems = [];
  const acc = (companySettings?.bankAcc || '').replace(/\s/g, '');
  if (!/^\d{12}$/.test(acc)) problems.push('Your company bank account number (Settings → Bank Details) must be exactly 12 digits for ICICI\'s bulk-upload file — please check/update it.');
  return problems;
}

/**
 * Builds the ICICI PAB bulk-upload .txt content for a set of selected payables.
 * @param {Array} items - [{ beneAcc, ifsc, beneName, amount, remarksClient, remarksBeneficiary }]
 * @param {Object} companySettings - DB.settings
 * @param {string} fileRef - up to 10 chars, identifies this batch to you later in CIB
 * @returns {{content, filename, totalAmount, rowCount}}
 */
export function buildICICIBulkFile(items, companySettings, fileRef) {
  const debitAcc = (companySettings?.bankAcc || '').replace(/\s/g, '');
  const date = mmddyyyy();
  const ref = sanitize(fileRef || 'INCINX', 10);

  const rows = items.map((it) => {
    const amount = parseFloat(it.amount) || 0;
    const mode = amount >= RTGS_THRESHOLD ? 'RTG' : 'NFT'; // could extend to 'IFC' (IMPS) for small same-day amounts if ever needed
    const ifsc = (it.ifsc || '').trim().toUpperCase();
    return [
      'APO', mode, numStr(amount), 'INR', debitAcc, '0011', ifsc,
      it.beneAcc.trim(), '0011', sanitize(it.beneName, 32),
      sanitize(it.remarksClient, 21), sanitize(it.remarksBeneficiary, 30),
    ].join('|') + '^';
  });

  const totalAmount = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const header = ['FHR', '0011', debitAcc, 'INR', numStr(totalAmount), String(items.length), date, ref].join('|') + '^';

  const content = [header, ...rows].join('\n');
  const filename = `icici_pab_${new Date().toISOString().split('T')[0]}_${ref}.txt`;

  return { content, filename, totalAmount, rowCount: rows.length };
}

/** Triggers a browser download of the generated file. */
export function downloadBulkFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Finds the vendor record (if any) matching an expense's free-typed vendor
 * name, so we can pull bank details already saved on the Vendors page.
 */
export function findVendorRecord(DB, vendorName) {
  if (!vendorName) return null;
  const q = vendorName.trim().toLowerCase();
  const idx = DB.vendors.findIndex((v) => (v.biz || v.name || '').trim().toLowerCase() === q || (v.name || '').trim().toLowerCase() === q);
  return idx === -1 ? null : { vendor: DB.vendors[idx], idx };
}