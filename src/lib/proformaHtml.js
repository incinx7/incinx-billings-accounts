// Ported 1:1 from the original app's buildProformaHTML(). Reuses the same
// .inv-* CSS classes as the Tax Invoice (see index.css legacy layer).

import { fmt, fmtDate, n2w } from './utils.js';
import { invoicePrintCSS } from './invoiceHtml.js';

export function buildProformaHTML(d, settings) {
  const s = settings;
  const logoSrc = s.logoData || '/logo.jpg';
  const isGST = d.gstType !== 'none';

  let rows = '';
  (d.items || []).forEach((item, i) => {
    const amt = (item.qty || 0) * (item.rate || 0);
    rows += `<tr><td style="text-align:center;padding:5px 7px;border:.5px solid #ccc;font-size:10.5px">${i + 1}</td><td style="padding:5px 7px;border:.5px solid #ccc;font-size:10.5px">${item.desc || ''}</td><td style="text-align:center;padding:5px 7px;border:.5px solid #ccc;font-size:10.5px">${item.qty}</td><td style="text-align:right;padding:5px 7px;border:.5px solid #ccc;font-size:10.5px">₹${fmt(item.rate)}</td><td style="text-align:center;padding:5px 7px;border:.5px solid #ccc;font-size:10.5px">${isGST && item.tax > 0 ? item.tax + '%' : '—'}</td><td style="text-align:right;padding:5px 7px;border:.5px solid #ccc;font-size:10.5px">₹${fmt(amt)}</td></tr>`;
  });

  let taxRows = '';
  if (d.gstType === 'intra') taxRows = `<tr><td style="padding:4px 9px;border:.5px solid #ccc;color:#555">CGST</td><td style="padding:4px 9px;border:.5px solid #ccc;text-align:right">₹${fmt(d.cgstAmt)}</td></tr><tr><td style="padding:4px 9px;border:.5px solid #ccc;color:#555">SGST</td><td style="padding:4px 9px;border:.5px solid #ccc;text-align:right">₹${fmt(d.sgstAmt)}</td></tr>`;
  else if (d.gstType === 'inter') taxRows = `<tr><td style="padding:4px 9px;border:.5px solid #ccc;color:#555">IGST</td><td style="padding:4px 9px;border:.5px solid #ccc;text-align:right">₹${fmt(d.igstAmt)}</td></tr>`;
  if (d.advance > 0) taxRows += `<tr><td style="padding:4px 9px;border:.5px solid #ccc;color:#555">Advance / Discount</td><td style="padding:4px 9px;border:.5px solid #ccc;text-align:right">− ₹${fmt(d.advance)}</td></tr>`;

  const cGSTrow = d.cgst && d.cgst !== 'N/A' ? `<tr><td style="padding:2px 0;color:#666">GST NO</td><td style="padding:2px 0">${d.cgst}</td></tr>` : '';
  const stateRow = d.cstate ? `<tr><td style="padding:2px 0;color:#666">State Name</td><td style="padding:2px 0">${d.cstate}</td></tr>` : '';
  const qrHTML = s.qrData ? `<img src="${s.qrData}" style="width:140px;height:140px;object-fit:contain;display:block;margin:0 auto;">` : `<div style="width:140px;height:140px;border:1px dashed #ccc;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8px;color:#bbb;text-align:center;">Upload QR in Settings</div>`;
  const sigHTML = s.signData ? `<img src="${s.signData}" style="max-width:180px;max-height:110px;object-fit:contain;display:block;margin:4px auto 0;">` : `<div style="font-family:Georgia,serif;font-size:12px;font-style:italic;font-weight:bold">For ${s.companyName}</div><div style="width:70px;border-bottom:1px solid #aaa;margin:5px auto 3px"></div>`;

  const TH = 'font-size:9px;text-transform:uppercase;font-weight:bold;letter-spacing:.4px';
  const TD = 'font-size:10.5px';
  let taxBreakdownHTML = '';
  if (d.gstType !== 'none') {
    const thStyle = `border:.5px solid #ccc;padding:5px 8px;background:#f2f2f2;${TH}`;
    const tdStyle = `border:.5px solid #ccc;padding:5px 8px;${TD}`;
    if (d.gstType === 'intra') {
      const cgstRate = d.items[0] && d.items[0].tax > 0 ? (d.items[0].tax / 2) + '%' : '—';
      taxBreakdownHTML = `<table style="width:100%;border-collapse:collapse;border:1px solid #ccc;border-top:none"><thead><tr><th style="${thStyle}" rowspan="2">Total</th><th style="${thStyle}">Taxable Value</th><th style="${thStyle}" colspan="2">Central Tax</th><th style="${thStyle}" colspan="2">State Tax</th><th style="${thStyle}">Total Tax Amount</th></tr><tr><th style="${thStyle}">Amount</th><th style="${thStyle}">Amount</th><th style="${thStyle}">Rate</th><th style="${thStyle}">Amount</th><th style="${thStyle}">Rate</th></tr></thead><tbody><tr><td style="${tdStyle}"></td><td style="${tdStyle};text-align:right">₹${fmt(d.subtotal)}</td><td style="${tdStyle};text-align:right">₹${fmt(d.cgstAmt)}</td><td style="${tdStyle};text-align:center">${cgstRate}</td><td style="${tdStyle};text-align:right">₹${fmt(d.sgstAmt)}</td><td style="${tdStyle};text-align:center">${cgstRate}</td><td style="${tdStyle};text-align:right">₹${fmt(d.totalTax)}</td></tr></tbody></table><div style="border:1px solid #ccc;border-top:none;padding:5px 8px;${TD};font-weight:bold">Tax Amount (In Words) : ${n2w(Math.round(d.totalTax))} Only</div>`;
    } else if (d.gstType === 'inter') {
      const igstRate = d.items[0] && d.items[0].tax > 0 ? d.items[0].tax + '%' : '—';
      taxBreakdownHTML = `<table style="width:100%;border-collapse:collapse;border:1px solid #ccc;border-top:none"><thead><tr><th style="${thStyle}" rowspan="2">Total</th><th style="${thStyle}">Taxable Value</th><th style="${thStyle}" colspan="2">Integrated Tax (IGST)</th><th style="${thStyle}">Total Tax Amount</th></tr><tr><th style="${thStyle}">Amount</th><th style="${thStyle}">Amount</th><th style="${thStyle}">Rate</th></tr></thead><tbody><tr><td style="${tdStyle}"></td><td style="${tdStyle};text-align:right">₹${fmt(d.subtotal)}</td><td style="${tdStyle};text-align:right">₹${fmt(d.igstAmt)}</td><td style="${tdStyle};text-align:center">${igstRate}</td><td style="${tdStyle};text-align:right">₹${fmt(d.totalTax)}</td></tr></tbody></table><div style="border:1px solid #ccc;border-top:none;padding:5px 8px;${TD};font-weight:bold">Tax Amount (In Words) : ${n2w(Math.round(d.totalTax))} Only</div>`;
    }
  }

  return `<div class="inv-wrap">
  <div class="inv-tbar"><span>PROFORMA INVOICE</span><span>NOT A TAX INVOICE — FOR ADVANCE / CONFIRMATION</span></div>
  <div class="inv-head">
    <div class="inv-logo-cell"><img src="${logoSrc}" style="max-width:130px;max-height:65px;object-fit:contain;display:block;"></div>
    <div class="inv-co"><strong class="inv-coname">${s.companyName}</strong><br>GSTIN : ${s.gstin}<br>PAN : ${s.pan}<br>HSN/SAC Code : ${s.hsn}<br>${s.address}<br>${s.city}<br>Mobile : ${s.mobile}</div>
    <div class="inv-meta"><table><tbody>
      <tr><td>Proforma No.</td><td><strong>${d.no || '—'}</strong></td></tr>
      <tr><td>Date</td><td>${fmtDate(d.date)}</td></tr>
      <tr><td>Purchase Order No.</td><td>${d.po || '—'}</td></tr>
      <tr><td>Place Of Supply</td><td>${d.pos || '—'}</td></tr>
    </tbody></table></div>
  </div>
  <div class="inv-party">
    <div class="inv-pc">
      <div class="inv-plabel">Customer Details</div>
      <strong>${d.cname || '—'}</strong><br>${d.caddr || ''}<br>${d.ccity || ''}<br>Mobile : ${d.cmob || '—'}
    </div>
    <div class="inv-pc"><table><tbody>
      ${d.cpan ? `<tr><td style="color:#666;padding:2px 0;width:42%">PAN No.</td><td style="padding:2px 0">${d.cpan}</td></tr>` : ''}${cGSTrow}${stateRow}
    </tbody></table></div>
  </div>
  <table class="inv-tbl"><thead><tr>
    <th style="width:38px;text-align:center">Sr.</th>
    <th>Description Of Work</th>
    <th style="width:55px;text-align:center">Qty</th>
    <th style="width:75px;text-align:right">Rate</th>
    <th style="width:50px;text-align:center">Tax</th>
    <th style="width:80px;text-align:right">Amount</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <div class="inv-totals"><table class="inv-tt"><tbody>
    ${taxRows}
    <tr class="grand"><td colspan="2"><strong>Total Amount</strong><span style="float:right">₹${fmt(d.total)}</span></td></tr>
  </tbody></table></div>
  <div class="inv-words">Amount Chargeable (In Words) : ${n2w(Math.round(d.total))} Only</div>
  ${taxBreakdownHTML}
  <div class="inv-bot">
    <div class="inv-bc">
      <div class="inv-bchead">Bank Details</div><br>
      <table><tbody>
        <tr><td>Name</td><td>${s.companyName}</td></tr>
        <tr><td>Account No.</td><td>${s.bankAcc}</td></tr>
        <tr><td>IFSC Code</td><td>${s.bankIFSC}</td></tr>
        <tr><td>Branch</td><td>${s.bankBranch}</td></tr>
        <tr><td>Bank</td><td>${s.bankName}</td></tr>
      </tbody></table>
    </div>
    <div class="inv-bc" style="text-align:center">
      <div class="inv-bclabel">Pay Using QR Scanner</div>
      ${qrHTML}
    </div>
    <div class="inv-bc">
      <div class="inv-bclabel" style="text-align:right">For ${s.companyName}</div>
      <div class="inv-sig">${sigHTML}<div class="inv-bclabel" style="margin-top:6px">Authorised Signatory</div></div>
    </div>
  </div>
  <div class="inv-tnc">
    <div class="inv-tc">${(d.notes || '').replace(/\n/g, '<br>')}</div>
    <div class="inv-tc"><div class="inv-tchead">Terms &amp; Conditions</div>${(d.tnc || '').split('\n').map((l) => `<div>${l}</div>`).join('')}</div>
  </div>
  <div style="text-align:center;padding:7px;font-size:9px;color:#999;border-top:1px solid #eee;font-style:italic">This is a Proforma Invoice. It is not a legally valid tax document. A GST Tax Invoice will be issued upon payment confirmation.</div>
</div>`;
}

export function printProforma(d, settings) {
  const html = buildProformaHTML(d, settings);
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Proforma ${d.no}</title><link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet"><style>${invoicePrintCSS}</style></head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>`);
  w.document.close();
}
