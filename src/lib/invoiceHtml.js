// Ported 1:1 from the original app's buildInvHTML() so the actual invoice
// document (what clients see / what gets printed to PDF) is pixel-identical
// to before. Do not restyle this — it intentionally does NOT use Tailwind
// or the app's dark-luxury theme; it uses the dedicated .inv-* CSS classes
// (see index.css legacy layer) which match the original design exactly.

import { fmt, fmtDate, n2w } from './utils.js';

export function buildInvHTML(d, settings) {
  const s = settings;
  const logoSrc = s.logoData || '/logo.jpg';
  const logoHTML = `<img src="${logoSrc}" style="max-width:130px;max-height:65px;object-fit:contain;display:block;">`;

  const isGST = d.gstType !== 'none';
  const MIN_ROWS = 10;
  let rows = '';
  (d.items || []).forEach((item, i) => {
    const amt = (item.qty || 0) * (item.rate || 0);
    rows += `<tr><td class="c">${i + 1}</td><td>${item.desc || ''}</td><td class="c">${item.qty}</td><td class="r">₹${fmt(item.rate)}</td><td class="c">${isGST && item.tax > 0 ? item.tax + '%' : '—'}</td><td class="r">₹${fmt(amt)}</td></tr>`;
  });
  const fillerCount = Math.max(0, MIN_ROWS - (d.items || []).length);
  for (let f = 0; f < fillerCount; f++) {
    rows += `<tr style="height:22px"><td class="c">&nbsp;</td><td>&nbsp;</td><td class="c">&nbsp;</td><td class="r">&nbsp;</td><td class="c">&nbsp;</td><td class="r">&nbsp;</td></tr>`;
  }

  let taxRows = '';
  if (d.gstType === 'intra') taxRows = `<tr><td>CGST</td><td style="text-align:right">₹${fmt(d.cgstAmt)}</td></tr><tr><td>SGST</td><td style="text-align:right">₹${fmt(d.sgstAmt)}</td></tr>`;
  else if (d.gstType === 'inter') taxRows = `<tr><td>IGST</td><td style="text-align:right">₹${fmt(d.igstAmt)}</td></tr>`;
  if (d.advance > 0) taxRows += `<tr><td>Advance / Discount</td><td style="text-align:right">− ₹${fmt(d.advance)}</td></tr>`;

  const cGSTrow = d.cgst && d.cgst !== 'N/A' ? `<tr><td>GST NO</td><td>${d.cgst}</td></tr>` : '';
  const stateRow = d.cstate ? `<tr><td>State Name</td><td>${d.cstate}</td></tr>` : '';

  const qrHTML = s.qrData
    ? `<img src="${s.qrData}" style="width:140px;height:140px;object-fit:contain;display:block;margin:0 auto;">`
    : `<div style="width:140px;height:140px;border:1px dashed #ccc;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8px;color:#bbb;text-align:center;">Upload QR in Settings</div>`;

  const sigHTML = s.signData
    ? `<img src="${s.signData}" style="max-width:180px;max-height:110px;object-fit:contain;display:block;margin:4px auto 0;">`
    : `<div class="inv-sigtext">For ${s.companyName}</div><div class="inv-sigline"></div>`;

  const TH = 'font-size:9px;text-transform:uppercase;font-weight:bold;letter-spacing:.4px';
  const TD = 'font-size:10.5px';
  let taxBreakdownHTML = '';
  if (d.gstType !== 'none') {
    const taxableVal = d.subtotal;
    const thStyle = `border:.5px solid #ccc;padding:5px 8px;background:#f2f2f2;${TH}`;
    const tdStyle = `border:.5px solid #ccc;padding:5px 8px;${TD}`;
    if (d.gstType === 'intra') {
      const cgstRate = d.items[0] && d.items[0].tax > 0 ? (d.items[0].tax / 2) + '%' : '—';
      taxBreakdownHTML = `<table style="width:100%;border-collapse:collapse;border:1px solid #ccc;border-top:none">
        <thead>
          <tr>
            <th style="${thStyle}" rowspan="2">Total</th>
            <th style="${thStyle}">Taxable Value</th>
            <th style="${thStyle}" colspan="2">Central Tax</th>
            <th style="${thStyle}" colspan="2">State Tax</th>
            <th style="${thStyle}">Total Tax Amount</th>
          </tr>
          <tr>
            <th style="${thStyle}">Amount</th>
            <th style="${thStyle}">Amount</th>
            <th style="${thStyle}">Rate</th>
            <th style="${thStyle}">Amount</th>
            <th style="${thStyle}">Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="${tdStyle}"></td>
            <td style="${tdStyle};text-align:right">₹${fmt(taxableVal)}</td>
            <td style="${tdStyle};text-align:right">₹${fmt(d.cgstAmt)}</td>
            <td style="${tdStyle};text-align:center">${cgstRate}</td>
            <td style="${tdStyle};text-align:right">₹${fmt(d.sgstAmt)}</td>
            <td style="${tdStyle};text-align:center">${cgstRate}</td>
            <td style="${tdStyle};text-align:right">₹${fmt(d.totalTax)}</td>
          </tr>
        </tbody>
      </table>
      <div style="border:1px solid #ccc;border-top:none;padding:5px 8px;${TD};font-weight:bold">
        Tax Amount (In Words) : ${n2w(Math.round(d.totalTax))} Only
      </div>`;
    } else if (d.gstType === 'inter') {
      const igstRate = d.items[0] && d.items[0].tax > 0 ? d.items[0].tax + '%' : '—';
      taxBreakdownHTML = `<table style="width:100%;border-collapse:collapse;border:1px solid #ccc;border-top:none">
        <thead>
          <tr>
            <th style="${thStyle}" rowspan="2">Total</th>
            <th style="${thStyle}">Taxable Value</th>
            <th style="${thStyle}" colspan="2">Integrated Tax (IGST)</th>
            <th style="${thStyle}">Total Tax Amount</th>
          </tr>
          <tr>
            <th style="${thStyle}">Amount</th>
            <th style="${thStyle}">Amount</th>
            <th style="${thStyle}">Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="${tdStyle}"></td>
            <td style="${tdStyle};text-align:right">₹${fmt(taxableVal)}</td>
            <td style="${tdStyle};text-align:right">₹${fmt(d.igstAmt)}</td>
            <td style="${tdStyle};text-align:center">${igstRate}</td>
            <td style="${tdStyle};text-align:right">₹${fmt(d.totalTax)}</td>
          </tr>
        </tbody>
      </table>
      <div style="border:1px solid #ccc;border-top:none;padding:5px 8px;${TD};font-weight:bold">
        Tax Amount (In Words) : ${n2w(Math.round(d.totalTax))} Only
      </div>`;
    }
  }

  return `<div class="inv-wrap">
  <div class="inv-tbar"><span>TAX INVOICE</span><span>ORIGINAL FOR RECEIPT</span></div>
  <div class="inv-head">
    <div class="inv-logo-cell">${logoHTML}</div>
    <div class="inv-co"><strong class="inv-coname">${s.companyName}</strong><br>GSTIN : ${s.gstin}<br>PAN : ${s.pan}<br>HSN/SAC Code : ${s.hsn}<br>${s.address}<br>${s.city}<br>Mobile : ${s.mobile}</div>
    <div class="inv-meta"><table><tbody>
      <tr><td>Invoice No.</td><td><strong>${d.no || '—'}</strong></td></tr>
      <tr><td>Invoice Date</td><td>${fmtDate(d.date)}</td></tr>
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
      ${d.cpan ? `<tr><td>PAN No.</td><td>${d.cpan}</td></tr>` : ''}${cGSTrow}${stateRow}
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
    <tr class="grand"><td colspan="2"><strong>Total Amount To Be Paid</strong><span style="float:right">₹${fmt(d.total)}</span></td></tr>
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
</div>`;
}

// Print-specific CSS (A4 page sizing). Kept separate from the on-screen
// .inv-* rules in index.css, exactly like the original app did.
export const invoicePrintCSS = `
@page { size:A4; margin:0; }
*{box-sizing:border-box;margin:0;padding:0}
html,body{ width:210mm; font-family:Arial,sans-serif; font-size:10.5px; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body{ padding:14mm 12mm 10mm 12mm; display:flex; flex-direction:column; align-items:center; }
.inv-wrap{ width:186mm; max-width:186mm; height:auto; border:none; border-radius:0; }
.inv-tbar{ display:flex; justify-content:space-between; background:#f2f2f2; border:1px solid #ccc; padding:6px 10px; font-size:12px; font-weight:bold; }
.inv-coname{ font-size:12px; font-weight:bold; }
.inv-bchead{ font-size:12px; font-weight:bold; }
.inv-tt .grand td{ font-weight:bold; font-size:12px; background:#f9f9f9; }
.inv-plabel{ font-size:9px; font-weight:bold; text-transform:uppercase; letter-spacing:.4px; color:#777; margin-bottom:4px; }
.inv-bchead{ font-size:9px; font-weight:bold; text-transform:uppercase; letter-spacing:.4px; color:#555; }
.inv-bclabel{ font-size:9px; font-weight:bold; text-transform:uppercase; letter-spacing:.4px; color:#777; margin-bottom:6px; }
.inv-tbl th{ background:#f2f2f2; padding:5px 7px; border:.5px solid #ccc; font-size:9px; text-align:left; text-transform:uppercase; letter-spacing:.4px; }
.inv-tchead{ font-size:9px; font-weight:bold; text-transform:uppercase; letter-spacing:.4px; color:#555; margin-bottom:4px; }
.inv-head{ display:grid; grid-template-columns:150px 1fr 1fr; border:1px solid #ccc; border-top:none; }
.inv-logo-cell{ padding:10px; border-right:1px solid #ccc; display:flex; align-items:center; justify-content:center; }
.inv-logo-cell img{ max-width:130px; max-height:65px; object-fit:contain; }
.inv-co{ padding:9px 11px; border-right:1px solid #ccc; font-size:10.5px; line-height:1.65; }
.inv-meta{ padding:9px 11px; font-size:10.5px; }
.inv-meta table{ width:100%; } .inv-meta td{ padding:2px 0; } .inv-meta td:first-child{ color:#666; width:48%; }
.inv-party{ display:grid; grid-template-columns:1fr 1fr; border:1px solid #ccc; border-top:none; }
.inv-pc{ padding:9px 11px; font-size:10.5px; } .inv-pc:first-child{ border-right:1px solid #ccc; }
.inv-pc table td{ padding:2px 0; } .inv-pc table td:first-child{ color:#666; width:42%; }
.inv-tbl{ width:100%; border-collapse:collapse; border:1px solid #ccc; border-top:none; }
.inv-tbl td{ padding:5px 7px; border:.5px solid #ccc; font-size:10.5px; }
.r{ text-align:right; } .c{ text-align:center; }
.inv-totals{ display:flex; justify-content:flex-end; border:1px solid #ccc; border-top:none; }
.inv-tt{ font-size:10.5px; border-collapse:collapse; min-width:240px; }
.inv-tt td{ padding:4px 9px; border:.5px solid #ccc; } .inv-tt td:first-child{ color:#555; }
.inv-words{ border:1px solid #ccc; border-top:none; padding:5px 11px; font-size:10.5px; font-weight:bold; }
.inv-bot{ display:grid; grid-template-columns:1fr 1fr 1fr; border:1px solid #ccc; border-top:none; min-height:165px; }
.inv-bc{ padding:9px 11px; font-size:10.5px; } .inv-bc:not(:last-child){ border-right:1px solid #ccc; }
.inv-bc table td{ padding:2px 0; } .inv-bc table td:first-child{ color:#555; font-weight:bold; padding-right:6px; }
.inv-tnc{ display:grid; grid-template-columns:1fr 2fr; border:1px solid #ccc; border-top:none; }
.inv-tc{ padding:9px 11px; font-size:10.5px; } .inv-tc:first-child{ border-right:1px solid #ccc; font-style:italic; color:#555; }
.inv-sig{ text-align:center; padding-top:4px; }
.inv-sigtext{ font-family:Georgia,serif; font-size:12px; font-style:italic; font-weight:bold; }
.inv-sigline{ width:70px; border-bottom:1px solid #aaa; margin:5px auto 3px; }
@media print{ html,body{ width:100%; } }`;

/** Opens a new tab with the invoice formatted for A4 printing, and triggers the print dialog. */
export function printInvoice(d, settings) {
  const html = buildInvHTML(d, settings);
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${d.no} - INCINX</title><link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet"><style>${invoicePrintCSS}</style></head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>`);
  w.document.close();
}