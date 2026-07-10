// Ported 1:1 from the original app's downloadCAgstReport(). Same exact
// layout/CSS as your original — dark section headers, summary stat boxes,
// net-GST highlight box, A4 landscape print.

import { fmt, fmtDate } from './utils.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function printCAGSTReport(DB, caMonth) {
  const [cy, cm] = caMonth !== 'all' ? caMonth.split('-') : ['', ''];
  const monthLabel = caMonth === 'all' ? 'All Months' : MONTH_NAMES[parseInt(cm, 10) - 1] + ' ' + cy;
  const inMonth = (d) => caMonth === 'all' || (d && d.slice(0, 7) === caMonth);

  const gstInv = DB.invoices.filter((i) => inMonth(i.date) && (i.clientType === 'gst' || i.cgst));
  const gstBills = (DB.gstBills || []).filter((b) => {
    if (caMonth === 'all') return true;
    if (b.billDate && b.billDate.slice(0, 7) === caMonth) return true;
    if (b.billMonth) {
      const [y, m] = caMonth.split('-');
      const mn = MONTH_NAMES_FULL[parseInt(m, 10) - 1];
      if (b.billMonth.toLowerCase().includes(mn.toLowerCase()) && b.billMonth.includes(y)) return true;
    }
    return false;
  }).map((b) => ({ ...b, source: 'Vendor Bill' }));

  // Petty cash / travel entries with GST (hotel/flight bills etc.) count
  // toward the same Input Tax Credit total, tagged with their own source
  // label so it's clear to the CA these aren't vendor bills.
  const pettyGstBills = (DB.petty || [])
    .filter((e) => e.gstApplicable && inMonth(e.date))
    .map((e) => ({
      billNo: e.billRef || '—', billDate: e.date, billMonth: '',
      vendor: e.vendor || e.desc, pan: '', gst: '',
      taxableAmt: e.taxableAmt || 0, gstAmt: e.gstAmt || 0, amount: e.amount || 0,
      source: e.type === 'travel' ? 'Travel' : 'Petty Cash',
    }));

  const allGstBills = [...gstBills, ...pettyGstBills];

  if (gstInv.length === 0 && allGstBills.length === 0) {
    alert('No GST client invoices or vendor GST bills found for ' + monthLabel + '.\n\nMake sure:\n• Client invoices have GST registered client type\n• Vendor GST bills have matching bill dates');
    return;
  }

  const s = DB.settings;
  const invTotal = gstInv.reduce((sum, i) => sum + (i.total || 0), 0);
  const invTax = gstInv.reduce((sum, i) => sum + (i.totalTax || 0), 0);
  const invSub = gstInv.reduce((sum, i) => sum + (i.subtotal || 0), 0);
  const invCGST = gstInv.reduce((sum, i) => sum + (i.cgstAmt || 0), 0);
  const invSGST = gstInv.reduce((sum, i) => sum + (i.sgstAmt || 0), 0);
  const invIGST = gstInv.reduce((sum, i) => sum + (i.igstAmt || 0), 0);
  const billTotal = allGstBills.reduce((sum, b) => sum + (b.amount || 0), 0);
  const billGST = allGstBills.reduce((sum, b) => sum + (b.gstAmt || 0), 0);
  const billBase = allGstBills.reduce((sum, b) => sum + (b.taxableAmt || 0), 0);
  const netGST = invTax - billGST;

  const invRows = gstInv.map((inv, idx) => {
    const recv = inv.status === 'paid' ? inv.total : (inv.payAmt || 0);
    const bal = Math.max(0, (inv.total || 0) - recv);
    return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f8'}">
      <td><strong style="font-family:monospace">${inv.no}</strong></td>
      <td style="white-space:nowrap">${fmtDate(inv.date)}</td>
      <td><strong>${inv.cname}</strong><br><span style="font-size:8.5px;color:#777">${inv.caddr || ''}</span></td>
      <td style="font-family:monospace;font-size:9px">${inv.cgst || '—'}</td>
      <td style="font-family:monospace;font-size:9px">${inv.cpan || '—'}</td>
      <td style="text-align:right">₹${fmt(inv.subtotal || 0)}</td>
      <td style="text-align:right">${inv.cgstAmt ? '₹' + fmt(inv.cgstAmt) : '—'}</td>
      <td style="text-align:right">${inv.sgstAmt ? '₹' + fmt(inv.sgstAmt) : '—'}</td>
      <td style="text-align:right">${inv.igstAmt ? '₹' + fmt(inv.igstAmt) : '—'}</td>
      <td style="text-align:right"><strong>₹${fmt(inv.total || 0)}</strong></td>
      <td style="text-align:right;color:#2A6B4A">₹${fmt(recv)}</td>
      <td style="text-align:right;color:${bal > 0 ? '#C84B2F' : '#2A6B4A'}">${bal > 0 ? '₹' + fmt(bal) : 'Nil'}</td>
      <td style="text-align:center"><span style="padding:2px 7px;border-radius:10px;font-size:9px;font-weight:600;background:${inv.status === 'paid' ? '#EAF5EF' : inv.status === 'partial' ? '#FDF5E4' : '#FDECEA'};color:${inv.status === 'paid' ? '#2A6B4A' : inv.status === 'partial' ? '#9B6E00' : '#C84B2F'}">${inv.status.toUpperCase()}</span></td>
    </tr>`;
  }).join('');

  const billRows = allGstBills.map((b, idx) => `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f8'}">
    <td>${b.billNo || '—'}</td>
    <td>${b.billDate ? fmtDate(b.billDate) : '—'}</td>
    <td style="white-space:nowrap">${b.billMonth || '—'}</td>
    <td><strong>${b.vendor || '—'}</strong>${b.pan ? `<br><span style="font-size:8.5px;color:#777;font-family:monospace">${b.pan}</span>` : ''}</td>
    <td style="font-family:monospace;font-size:9px">${b.gst || '—'}</td>
    <td style="text-align:right">₹${fmt(b.taxableAmt || 0)}</td>
    <td style="text-align:right;color:#9B6E00">₹${fmt(b.gstAmt || 0)}</td>
    <td style="text-align:right"><strong>₹${fmt(b.amount || 0)}</strong></td>
    <td style="text-align:center"><span style="font-size:9px;background:${b.source === 'Vendor Bill' ? '#EAF1FB' : b.source === 'Travel' ? '#FDF5E4' : '#EAF5EF'};color:${b.source === 'Vendor Bill' ? '#1A4A8A' : b.source === 'Travel' ? '#9B6E00' : '#2A6B4A'};padding:2px 7px;border-radius:10px;font-weight:600">${b.source.toUpperCase()}</span></td>
  </tr>`).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>GST Report for CA — ${monthLabel}</title>
  <style>
    @page{margin:9mm;size:A4 landscape}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:10px;margin:0;padding:14px;color:#111}
    h1{font-size:17px;margin:0 0 2px;font-weight:bold}
    .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #C84B2F;padding-bottom:12px;margin-bottom:14px}
    .badge-month{background:#C84B2F;color:#fff;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:bold;letter-spacing:.5px;display:inline-block;margin-bottom:6px}
    .summary-bar{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px}
    .sbox{border:1px solid #ddd;border-radius:5px;padding:9px 10px;text-align:center;background:#fafafa}
    .sbox-label{font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px}
    .sbox-val{font-size:14px;font-weight:bold}
    .net-box{border:2px solid #C84B2F;border-radius:5px;padding:9px 10px;text-align:center;background:#FFF5F3}
    table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:6px}
    .th-dark{background:#1a1a1a;color:#fff;padding:6px 7px;text-align:left;font-size:8.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
    .th-green{background:#2A6B4A;color:#fff;padding:6px 7px;text-align:left;font-size:8.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
    td{padding:5px 7px;border-bottom:1px solid #f0f0f0;vertical-align:top}
    tfoot td{font-weight:bold;background:#f5f5f5;border-top:2px solid #ccc}
    .note{margin-top:14px;padding:10px 14px;border:1px solid #ddd;border-radius:4px;font-size:8.5px;color:#777;text-align:center;background:#fafafa}
    .section-label{font-size:9px;font-family:monospace;font-weight:bold;text-transform:uppercase;letter-spacing:1px;padding:3px 8px;border-radius:3px;display:inline-block;margin-bottom:8px}
    .sl-blue{background:#EAF1FB;color:#1A4A8A}
    .sl-green{background:#EAF5EF;color:#2A6B4A}
  </style></head><body>
  <div class="header">
    <div>
      <h1>${s.companyName || 'INCINX'}</h1>
      <div style="font-size:10px;color:#555;margin-top:2px">${s.address || ''}, ${s.city || ''}</div>
      <div style="font-size:10px;color:#555">GSTIN: <strong>${s.gstin || '—'}</strong> &nbsp;|&nbsp; PAN: <strong>${s.pan || '—'}</strong> &nbsp;|&nbsp; Mobile: ${s.mobile || ''}</div>
    </div>
    <div style="text-align:right">
      <div class="badge-month">📅 ${monthLabel}</div>
      <div style="font-size:14px;font-weight:bold;color:#C84B2F;letter-spacing:.3px">GST REPORT FOR CA</div>
      <div style="font-size:9px;color:#888;margin-top:4px">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} &nbsp;|&nbsp; ${gstInv.length} GST invoice(s) &nbsp;|&nbsp; ${allGstBills.length} GST bill(s)</div>
    </div>
  </div>

  <div class="summary-bar">
    <div class="sbox"><div class="sbox-label">GST Revenue (Output)</div><div class="sbox-val">₹${fmt(invTotal)}</div></div>
    <div class="sbox"><div class="sbox-label">Taxable Value</div><div class="sbox-val" style="color:#1A4A8A">₹${fmt(invSub)}</div></div>
    <div class="sbox"><div class="sbox-label">GST Collected</div><div class="sbox-val" style="color:#9B6E00">₹${fmt(invTax)}</div></div>
    <div class="sbox"><div class="sbox-label">Vendor Bills Total</div><div class="sbox-val">₹${fmt(billTotal)}</div></div>
    <div class="sbox"><div class="sbox-label">ITC (Input GST)</div><div class="sbox-val" style="color:#2A6B4A">₹${fmt(billGST)}</div></div>
    <div class="net-box"><div class="sbox-label" style="color:#C84B2F">Net GST Payable</div><div class="sbox-val" style="color:${netGST >= 0 ? '#C84B2F' : '#2A6B4A'}">₹${fmt(Math.abs(netGST))}${netGST < 0 ? ' <span style="font-size:10px">(Credit)</span>' : ''}</div></div>
  </div>

  <span class="section-label sl-blue">📋 Section A — GST Client Invoices (Output Tax)</span>
  ${gstInv.length === 0
    ? `<div style="padding:12px;background:#f9f9f9;border:1px solid #eee;border-radius:4px;color:#888;font-size:11px;margin-bottom:16px">No GST client invoices for ${monthLabel}.</div>`
    : `<table>
      <thead><tr>
        <th class="th-dark">Invoice No.</th>
        <th class="th-dark">Date</th>
        <th class="th-dark">Client Name</th>
        <th class="th-dark">Client GST No.</th>
        <th class="th-dark">Client PAN</th>
        <th class="th-dark" style="text-align:right">Taxable (₹)</th>
        <th class="th-dark" style="text-align:right">CGST (₹)</th>
        <th class="th-dark" style="text-align:right">SGST (₹)</th>
        <th class="th-dark" style="text-align:right">IGST (₹)</th>
        <th class="th-dark" style="text-align:right">Total (₹)</th>
        <th class="th-dark" style="text-align:right">Received (₹)</th>
        <th class="th-dark" style="text-align:right">Balance (₹)</th>
        <th class="th-dark" style="text-align:center">Status</th>
      </tr></thead>
      <tbody>${invRows}</tbody>
      <tfoot><tr>
        <td colspan="5"><strong>TOTALS — ${gstInv.length} GST invoice(s)</strong></td>
        <td style="text-align:right"><strong>₹${fmt(invSub)}</strong></td>
        <td style="text-align:right"><strong>₹${fmt(invCGST)}</strong></td>
        <td style="text-align:right"><strong>₹${fmt(invSGST)}</strong></td>
        <td style="text-align:right"><strong>₹${fmt(invIGST)}</strong></td>
        <td style="text-align:right"><strong>₹${fmt(invTotal)}</strong></td>
        <td style="text-align:right;color:#2A6B4A"><strong>₹${fmt(gstInv.reduce((sum, i) => sum + (i.status === 'paid' ? i.total : (i.payAmt || 0)), 0))}</strong></td>
        <td style="text-align:right;color:#C84B2F"><strong>₹${fmt(gstInv.reduce((sum, i) => sum + Math.max(0, (i.total || 0) - (i.status === 'paid' ? i.total : (i.payAmt || 0))), 0))}</strong></td>
        <td></td>
      </tr></tfoot>
    </table>`
  }

  <span class="section-label sl-green" style="margin-top:10px;display:inline-block">🧾 Section B — Vendor GST Bills (Input Tax Credit)</span>
  ${allGstBills.length === 0
    ? `<div style="padding:12px;background:#f9f9f9;border:1px solid #eee;border-radius:4px;color:#888;font-size:11px;margin-bottom:16px">No vendor GST bills for ${monthLabel}. Upload bills from the GST Bills section above.</div>`
    : `<table>
      <thead><tr>
        <th class="th-green">Bill No.</th>
        <th class="th-green">Bill Date</th>
        <th class="th-green">Bill Month</th>
        <th class="th-green">Vendor / Supplier</th>
        <th class="th-green">Vendor GST No.</th>
        <th class="th-green" style="text-align:right">Taxable (₹)</th>
        <th class="th-green" style="text-align:right">GST Paid (₹)</th>
        <th class="th-green" style="text-align:right">Total (₹)</th>
        <th class="th-green" style="text-align:center">Type</th>
      </tr></thead>
      <tbody>${billRows}</tbody>
      <tfoot><tr>
        <td colspan="5"><strong>TOTALS — ${allGstBills.length} GST bill(s) (vendor + travel/petty) &nbsp;|&nbsp; Claimable ITC: ₹${fmt(billGST)}</strong></td>
        <td style="text-align:right"><strong>₹${fmt(billBase)}</strong></td>
        <td style="text-align:right;color:#2A6B4A"><strong>₹${fmt(billGST)}</strong></td>
        <td style="text-align:right"><strong>₹${fmt(billTotal)}</strong></td>
        <td></td>
      </tr></tfoot>
    </table>`
  }

  <div class="note">
    <strong>GST Summary — ${monthLabel}:</strong> &nbsp; Output GST collected from clients: <strong>₹${fmt(invTax)}</strong> &nbsp;|&nbsp; Input GST paid to vendors (ITC): <strong>₹${fmt(billGST)}</strong> &nbsp;|&nbsp; <strong>Net GST payable: ₹${fmt(Math.abs(netGST))} ${netGST < 0 ? '(Credit B/F)' : ''}</strong><br>
    <span style="font-size:8px">This report is generated from INCINX and is for reference only. Verify with original invoices before filing GST returns. | ${new Date().toISOString()}</span>
  </div>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
  w.document.close();
}
