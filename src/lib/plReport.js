// P&L report — restyled to match the same visual language as the CA GST
// Report (dark section headers, summary stat boxes, badge-month header)
// so every downloadable report looks consistent.

import { fmt, fmtDate } from './utils.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function printPLReport(DB, monthFilter) {
  const inMonth = (d) => monthFilter === 'all' || (d && d.slice(0, 7) === monthFilter);
  const [y, m] = monthFilter !== 'all' ? monthFilter.split('-') : ['', ''];
  const monthLabel = monthFilter === 'all' ? 'All Time' : MONTH_NAMES[parseInt(m, 10) - 1] + ' ' + y;

  const invs = DB.invoices.filter((i) => inMonth(i.date));
  const exps = DB.expenses.filter((e) => inMonth(e.date));

  const ti = invs.reduce((s, i) => s + (i.total || 0), 0);
  const pa = invs.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0)
    + invs.filter((i) => i.status === 'partial').reduce((s, i) => s + (i.payAmt || 0), 0);
  const tt = invs.reduce((s, i) => s + (i.totalTax || 0), 0);
  const te = exps.reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);
  const net = pa - te;

  const byCategory = exps.reduce((a, e) => { a[e.cat] = (a[e.cat] || 0) + (parseFloat(e.amt) || 0); return a; }, {});

  const s = DB.settings;
  const invRows = invs.map((inv, idx) => {
    const recv = inv.status === 'paid' ? inv.total : (inv.payAmt || 0);
    return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f8'}">
      <td><strong style="font-family:monospace">${inv.no}</strong></td>
      <td>${fmtDate(inv.date)}</td>
      <td>${inv.cname}</td>
      <td style="text-align:right">₹${fmt(inv.total)}</td>
      <td style="text-align:right;color:#2A6B4A">₹${fmt(recv)}</td>
      <td style="text-align:center"><span style="padding:2px 7px;border-radius:10px;font-size:9px;font-weight:600;background:${inv.status === 'paid' ? '#EAF5EF' : inv.status === 'partial' ? '#FDF5E4' : '#FDECEA'};color:${inv.status === 'paid' ? '#2A6B4A' : inv.status === 'partial' ? '#9B6E00' : '#C84B2F'}">${inv.status.toUpperCase()}</span></td>
    </tr>`;
  }).join('');

  const catRows = Object.entries(byCategory).map(([k, v], idx) => `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9f8'}"><td>${k}</td><td style="text-align:right">₹${fmt(v)}</td></tr>`).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>P&L Report — ${monthLabel}</title>
  <style>
    @page{margin:9mm;size:A4}
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:10px;margin:0;padding:14px;color:#111}
    h1{font-size:17px;margin:0 0 2px;font-weight:bold}
    .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #C84B2F;padding-bottom:12px;margin-bottom:14px}
    .badge-month{background:#C84B2F;color:#fff;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:bold;letter-spacing:.5px;display:inline-block;margin-bottom:6px}
    .summary-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
    .sbox{border:1px solid #ddd;border-radius:5px;padding:9px 10px;text-align:center;background:#fafafa}
    .sbox-label{font-size:8px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px}
    .sbox-val{font-size:14px;font-weight:bold}
    .net-box{border:2px solid #2A6B4A;border-radius:5px;padding:9px 10px;text-align:center;background:#F3FAF6}
    table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:6px}
    .th-dark{background:#1a1a1a;color:#fff;padding:6px 7px;text-align:left;font-size:8.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
    td{padding:5px 7px;border-bottom:1px solid #f0f0f0;vertical-align:top}
    tfoot td{font-weight:bold;background:#f5f5f5;border-top:2px solid #ccc}
    .note{margin-top:14px;padding:10px 14px;border:1px solid #ddd;border-radius:4px;font-size:8.5px;color:#777;text-align:center;background:#fafafa}
    .section-label{font-size:9px;font-family:monospace;font-weight:bold;text-transform:uppercase;letter-spacing:1px;padding:3px 8px;border-radius:3px;display:inline-block;margin-bottom:8px}
    .sl-blue{background:#EAF1FB;color:#1A4A8A}
  </style></head><body>
  <div class="header">
    <div>
      <h1>${s.companyName || 'INCINX'}</h1>
      <div style="font-size:10px;color:#555;margin-top:2px">${s.address || ''}, ${s.city || ''}</div>
      <div style="font-size:10px;color:#555">GSTIN: <strong>${s.gstin || '—'}</strong> &nbsp;|&nbsp; PAN: <strong>${s.pan || '—'}</strong></div>
    </div>
    <div style="text-align:right">
      <div class="badge-month">📅 ${monthLabel}</div>
      <div style="font-size:14px;font-weight:bold;color:#C84B2F;letter-spacing:.3px">PROFIT &amp; LOSS REPORT</div>
      <div style="font-size:9px;color:#888;margin-top:4px">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} &nbsp;|&nbsp; ${invs.length} invoice(s) &nbsp;|&nbsp; ${exps.length} expense(s)</div>
    </div>
  </div>

  <div class="summary-bar">
    <div class="sbox"><div class="sbox-label">Gross Revenue</div><div class="sbox-val">₹${fmt(ti)}</div></div>
    <div class="sbox"><div class="sbox-label">Received</div><div class="sbox-val" style="color:#2A6B4A">₹${fmt(pa)}</div></div>
    <div class="sbox"><div class="sbox-label">Total Expenses</div><div class="sbox-val" style="color:#C84B2F">₹${fmt(te)}</div></div>
    <div class="net-box"><div class="sbox-label" style="color:#2A6B4A">Net Profit</div><div class="sbox-val" style="color:${net >= 0 ? '#2A6B4A' : '#C84B2F'}">₹${fmt(Math.abs(net))}${net < 0 ? ' (Loss)' : ''}</div></div>
  </div>

  <span class="section-label sl-blue">📋 Expenses by Category</span>
  <table><thead><tr><th class="th-dark">Category</th><th class="th-dark" style="text-align:right">Amount (₹)</th></tr></thead>
    <tbody>${catRows || '<tr><td colspan="2" style="text-align:center;color:#888">No expenses recorded</td></tr>'}</tbody>
    <tfoot><tr><td><strong>Total</strong></td><td style="text-align:right"><strong>₹${fmt(te)}</strong></td></tr></tfoot>
  </table>

  <span class="section-label sl-blue" style="margin-top:10px;display:inline-block">📋 All Invoices</span>
  <table><thead><tr>
    <th class="th-dark">Invoice No.</th><th class="th-dark">Date</th><th class="th-dark">Client</th>
    <th class="th-dark" style="text-align:right">Amount (₹)</th><th class="th-dark" style="text-align:right">Received (₹)</th><th class="th-dark" style="text-align:center">Status</th>
  </tr></thead>
    <tbody>${invRows || '<tr><td colspan="6" style="text-align:center;color:#888">No invoices for this period</td></tr>'}</tbody>
  </table>

  <div class="note">
    <strong>P&amp;L Summary — ${monthLabel}:</strong> Gross Revenue ₹${fmt(ti)} − Total Expenses ₹${fmt(te)} = <strong>Net Profit ₹${fmt(net)}</strong><br>
    <span style="font-size:8px">This report is generated from INCINX and is for reference only. | ${new Date().toISOString()}</span>
  </div>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
  w.document.close();
}
