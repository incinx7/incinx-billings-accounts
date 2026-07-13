// Vendor payment statement — per-vendor ledger of what's been billed, paid,
// and is still pending. Same visual language as the other reports.

import { fmt, fmtDate } from './utils.js';

export function printVendorStatement(vendorName, expenses, settings) {
  const s = settings;
  const sorted = [...expenses].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const totalBilled = sorted.reduce((sum, e) => sum + (parseFloat(e.amt) || 0), 0);
  const totalPaid = sorted.reduce((sum, e) => sum + (e.paymentSplits || []).reduce((s2, p) => s2 + (parseFloat(p.amt) || 0), 0), 0);
  const totalPending = totalBilled - totalPaid;

  const rows = sorted.map((e, idx) => {
    const paid = (e.paymentSplits || []).reduce((s2, p) => s2 + (parseFloat(p.amt) || 0), 0);
    const bal = Math.max(0, (parseFloat(e.amt) || 0) - paid);
    const status = paid <= 0 ? 'unpaid' : bal <= 0 ? 'paid' : 'partial';
    return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f8'}">
      <td>${fmtDate(e.date)}</td>
      <td>${e.desc || '—'}</td>
      <td>${e.cat || '—'}</td>
      <td>${e.billno || '—'}</td>
      <td style="text-align:right">₹${fmt(e.amt)}</td>
      <td style="text-align:right;color:#2A6B4A">₹${fmt(paid)}</td>
      <td style="text-align:right;color:${bal > 0 ? '#C84B2F' : '#2A6B4A'}"><strong>₹${fmt(bal)}</strong></td>
      <td style="text-align:center"><span style="padding:2px 7px;border-radius:10px;font-size:9px;font-weight:600;background:${status === 'paid' ? '#EAF5EF' : status === 'partial' ? '#FDF5E4' : '#FDECEA'};color:${status === 'paid' ? '#2A6B4A' : status === 'partial' ? '#9B6E00' : '#C84B2F'}">${status.toUpperCase()}</span></td>
    </tr>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Vendor Statement — ${vendorName}</title>
  <style>
    @page{margin:9mm;size:A4}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:10px;margin:0;padding:14px;color:#111}
    h1{font-size:17px;margin:0 0 2px;font-weight:bold}
    .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #C84B2F;padding-bottom:12px;margin-bottom:14px}
    .badge-month{background:#C84B2F;color:#fff;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:bold;letter-spacing:.5px;display:inline-block;margin-bottom:6px}
    .summary-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
    .sbox{border:1px solid #ddd;border-radius:5px;padding:9px 10px;text-align:center;background:#fafafa}
    .sbox-label{font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px}
    .sbox-val{font-size:14px;font-weight:bold}
    .net-box{border:2px solid #C84B2F;border-radius:5px;padding:9px 10px;text-align:center;background:#FFF5F3}
    table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:6px}
    .th-dark{background:#1a1a1a;color:#fff;padding:6px 7px;text-align:left;font-size:8.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
    td{padding:5px 7px;border-bottom:1px solid #f0f0f0;vertical-align:top}
    tfoot td{font-weight:bold;background:#f5f5f5;border-top:2px solid #ccc}
    .note{margin-top:14px;padding:10px 14px;border:1px solid #ddd;border-radius:4px;font-size:8.5px;color:#777;text-align:center;background:#fafafa}
  </style></head><body>
  <div class="header">
    <div>
      <h1>${s.companyName || 'INCINX'}</h1>
      <div style="font-size:10px;color:#555;margin-top:2px">${s.address || ''}, ${s.city || ''}</div>
      <div style="font-size:10px;color:#555">GSTIN: <strong>${s.gstin || '—'}</strong> &nbsp;|&nbsp; Mobile: ${s.mobile || ''}</div>
    </div>
    <div style="text-align:right">
      <div class="badge-month">🔧 ${vendorName}</div>
      <div style="font-size:14px;font-weight:bold;color:#C84B2F;letter-spacing:.3px">VENDOR PAYMENT STATEMENT</div>
      <div style="font-size:9px;color:#888;margin-top:4px">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} &nbsp;|&nbsp; ${sorted.length} record(s)</div>
    </div>
  </div>

  <div class="summary-bar">
    <div class="sbox"><div class="sbox-label">Total Billed</div><div class="sbox-val">₹${fmt(totalBilled)}</div></div>
    <div class="sbox"><div class="sbox-label">Total Paid</div><div class="sbox-val" style="color:#2A6B4A">₹${fmt(totalPaid)}</div></div>
    <div class="net-box"><div class="sbox-label" style="color:#C84B2F">Pending</div><div class="sbox-val" style="color:${totalPending > 0 ? '#C84B2F' : '#2A6B4A'}">₹${fmt(totalPending)}</div></div>
  </div>

  ${sorted.length === 0
    ? `<div style="padding:12px;background:#f9f9f9;border:1px solid #eee;border-radius:4px;color:#888;font-size:11px">No expense records found for this vendor.</div>`
    : `<table>
      <thead><tr>
        <th class="th-dark">Date</th>
        <th class="th-dark">Description</th>
        <th class="th-dark">Category</th>
        <th class="th-dark">Bill No.</th>
        <th class="th-dark" style="text-align:right">Amount (₹)</th>
        <th class="th-dark" style="text-align:right">Paid (₹)</th>
        <th class="th-dark" style="text-align:right">Pending (₹)</th>
        <th class="th-dark" style="text-align:center">Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="4"><strong>TOTALS</strong></td>
        <td style="text-align:right"><strong>₹${fmt(totalBilled)}</strong></td>
        <td style="text-align:right"><strong>₹${fmt(totalPaid)}</strong></td>
        <td style="text-align:right"><strong>₹${fmt(totalPending)}</strong></td>
        <td></td>
      </tr></tfoot>
    </table>`
  }

  <div class="note">
    This statement reflects payment activity as of ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}.<br>
    <span style="font-size:8px">Generated from INCINX | ${new Date().toISOString()}</span>
  </div>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
  w.document.close();
}
