// Ported 1:1 from the original app's buildQuotationHTML(). Fully self-styled
// (inline styles, dark navy header) — intentionally kept exactly as-is.

import { fmt, fmtDate, n2w } from './utils.js';

export function buildQuotationHTML(d, settings) {
  const s = settings;
  const logoSrc = s.logoData || '/logo.jpg';
  const isGST = d.gstType !== 'none';

  let rows = '';
  (d.items || []).forEach((item, i) => {
    const amt = (item.qty || 0) * (item.rate || 0);
    rows += `<tr><td style="text-align:center">${i + 1}</td><td>${item.desc || ''}</td><td style="text-align:center">${item.qty}</td><td style="text-align:right">₹${fmt(item.rate)}</td><td style="text-align:center">${isGST && item.tax > 0 ? item.tax + '%' : '—'}</td><td style="text-align:right">₹${fmt(amt)}</td></tr>`;
  });
  for (let i = (d.items || []).length; i < 6; i++) rows += `<tr><td style="height:20px">&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`;

  let taxRows = '';
  if (d.gstType === 'intra') taxRows = `<tr><td>CGST</td><td style="text-align:right">₹${fmt(d.cgstAmt)}</td></tr><tr><td>SGST</td><td style="text-align:right">₹${fmt(d.sgstAmt)}</td></tr>`;
  else if (d.gstType === 'inter') taxRows = `<tr><td>IGST</td><td style="text-align:right">₹${fmt(d.igstAmt)}</td></tr>`;
  if (d.discount > 0) taxRows += `<tr><td>Discount</td><td style="text-align:right">− ₹${fmt(d.discount)}</td></tr>`;

  const sigHTML = s.signData
    ? `<img src="${s.signData}" style="max-width:180px;max-height:110px;object-fit:contain;display:block;margin:4px auto 0;">`
    : `<div style="font-family:Georgia,serif;font-size:12px;font-style:italic;font-weight:bold">For ${s.companyName}</div><div style="width:70px;border-bottom:1px solid #aaa;margin:5px auto 3px"></div>`;

  return `<div style="background:#fff;color:#111;font-family:Arial,sans-serif;font-size:10.5px;line-height:1.5;border:1px solid #ccc;border-radius:4px;max-width:760px;margin:0 auto">
  <div style="display:flex;justify-content:space-between;background:#1a1a2e;border-bottom:1px solid #ccc;padding:8px 12px;font-size:12px;font-weight:bold;color:#fff;border-radius:4px 4px 0 0">
    <span>QUOTATION</span><span style="font-size:10px;font-weight:normal;opacity:.75">ESTIMATE — NOT A TAX INVOICE</span>
  </div>
  <div style="display:grid;grid-template-columns:150px 1fr 1fr;border-bottom:1px solid #ccc">
    <div style="padding:10px;border-right:1px solid #ccc;display:flex;align-items:center;justify-content:center"><img src="${logoSrc}" style="max-width:130px;max-height:65px;object-fit:contain;display:block;"></div>
    <div style="padding:9px 11px;border-right:1px solid #ccc;font-size:10.5px;line-height:1.65"><strong style="font-size:12px">${s.companyName}</strong><br>GSTIN : ${s.gstin}<br>PAN : ${s.pan}<br>${s.address}<br>${s.city}<br>Mobile : ${s.mobile}</div>
    <div style="padding:9px 11px;font-size:10.5px"><table style="width:100%"><tbody>
      <tr><td style="color:#666;padding:2px 0;width:48%">Quotation No.</td><td><strong>${d.no || '—'}</strong></td></tr>
      <tr><td style="color:#666;padding:2px 0">Date</td><td>${fmtDate(d.date)}</td></tr>
      <tr><td style="color:#666;padding:2px 0">Valid Until</td><td><strong style="color:#c84b2f">${fmtDate(d.valid)}</strong></td></tr>
      ${d.ref ? `<tr><td style="color:#666;padding:2px 0">Subject</td><td>${d.ref}</td></tr>` : ''}
    </tbody></table></div>
  </div>
  <div style="border-bottom:1px solid #ccc;padding:9px 11px;font-size:10.5px">
    <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;color:#777;margin-bottom:4px">Prepared For</div>
    <strong style="font-size:12px">${d.cname || '—'}</strong>
    ${d.caddr ? `<br>${d.caddr}` : ''}${d.ccity ? `<br>${d.ccity}` : ''}${d.cmob ? `<br>Mobile : ${d.cmob}` : ''}
  </div>
  ${(d.desc || d.operators || d.deliverables) ? `<div style="border-bottom:1px solid #ccc;padding:9px 11px;font-size:10.5px">
    <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;color:#777;margin-bottom:7px">Project Description &amp; Scope</div>
    <div style="display:grid;grid-template-columns:${(d.operators && d.deliverables) ? '1fr 1fr' : '1fr'};gap:0;border:1px solid #eee;border-radius:3px;overflow:hidden">
      ${d.operators ? `<div style="padding:7px 10px;background:#fafafa;${d.deliverables ? 'border-right:1px solid #eee' : ''}"><div style="font-size:8.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;color:#888;margin-bottom:3px">Operators / Crew</div><div style="font-size:10.5px">${d.operators}</div></div>` : ''}
      ${d.deliverables ? `<div style="padding:7px 10px;background:#fafafa"><div style="font-size:8.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;color:#888;margin-bottom:3px">Deliverables</div><div style="font-size:10.5px">${d.deliverables}</div></div>` : ''}
    </div>
    ${d.desc ? `<div style="margin-top:7px;font-size:10.5px;color:#333;line-height:1.6;white-space:pre-wrap">${d.desc}</div>` : ''}
  </div>` : ''}
  <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #ccc"><thead><tr>
    <th style="width:38px;text-align:center;background:#f2f2f2;padding:5px 7px;border:.5px solid #ccc;font-size:9px;text-transform:uppercase;letter-spacing:.4px">Sr.</th>
    <th style="background:#f2f2f2;padding:5px 7px;border:.5px solid #ccc;font-size:9px;text-transform:uppercase;letter-spacing:.4px">Description of Work / Deliverable</th>
    <th style="width:55px;text-align:center;background:#f2f2f2;padding:5px 7px;border:.5px solid #ccc;font-size:9px;text-transform:uppercase;letter-spacing:.4px">Qty</th>
    <th style="width:80px;text-align:right;background:#f2f2f2;padding:5px 7px;border:.5px solid #ccc;font-size:9px;text-transform:uppercase;letter-spacing:.4px">Rate</th>
    <th style="width:50px;text-align:center;background:#f2f2f2;padding:5px 7px;border:.5px solid #ccc;font-size:9px;text-transform:uppercase;letter-spacing:.4px">Tax</th>
    <th style="width:85px;text-align:right;background:#f2f2f2;padding:5px 7px;border:.5px solid #ccc;font-size:9px;text-transform:uppercase;letter-spacing:.4px">Amount</th>
  </tr></thead><tbody>${rows}</tbody></table>
  <div style="display:flex;justify-content:flex-end;border-bottom:1px solid #ccc">
    <table style="font-size:10.5px;border-collapse:collapse;min-width:240px"><tbody>
      <tr><td style="padding:4px 9px;border:.5px solid #ccc;color:#555">Subtotal</td><td style="padding:4px 9px;border:.5px solid #ccc;text-align:right">₹${fmt(d.subtotal)}</td></tr>
      ${taxRows}
      <tr><td colspan="2" style="padding:5px 9px;border:.5px solid #ccc;font-weight:bold;font-size:12px;background:#f9f9f9"><strong>Total Estimate</strong><span style="float:right">₹${fmt(d.total)}</span></td></tr>
    </tbody></table>
  </div>
  <div style="padding:5px 11px;font-size:10.5px;font-weight:bold;border-bottom:1px solid #ccc">Amount (In Words) : ${n2w(Math.round(d.total))} Only</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #ccc;min-height:120px">
    <div style="padding:9px 11px;font-size:10.5px;border-right:1px solid #ccc">
      <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;color:#555;margin-bottom:6px">Bank Details</div>
      <table><tbody>
        <tr><td style="color:#555;font-weight:bold;padding-right:6px;padding:2px 0;font-size:10.5px">Name</td><td style="font-size:10.5px;padding:2px 0">${s.companyName}</td></tr>
        <tr><td style="color:#555;font-weight:bold;padding-right:6px;padding:2px 0;font-size:10.5px">Account No.</td><td style="font-size:10.5px;padding:2px 0">${s.bankAcc}</td></tr>
        <tr><td style="color:#555;font-weight:bold;padding-right:6px;padding:2px 0;font-size:10.5px">IFSC</td><td style="font-size:10.5px;padding:2px 0">${s.bankIFSC}</td></tr>
        <tr><td style="color:#555;font-weight:bold;padding-right:6px;padding:2px 0;font-size:10.5px">Bank</td><td style="font-size:10.5px;padding:2px 0">${s.bankName}</td></tr>
      </tbody></table>
    </div>
    <div style="padding:9px 11px;font-size:10.5px;text-align:right">
      <div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;color:#555;margin-bottom:6px">For ${s.companyName}</div>
      <div style="text-align:center;padding-top:8px">${sigHTML}<div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;color:#777;margin-top:6px">Authorised Signatory</div></div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 2fr">
    <div style="padding:9px 11px;font-size:10.5px;border-right:1px solid #ccc;font-style:italic;color:#555">${(d.notes || '').replace(/\n/g, '<br>')}</div>
    <div style="padding:9px 11px;font-size:10.5px"><div style="font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;color:#555;margin-bottom:4px">Terms &amp; Conditions</div>${(d.tnc || '').split('\n').map((l) => `<div>${l}</div>`).join('')}</div>
  </div>
  <div style="text-align:center;padding:7px;font-size:9px;color:#999;border-top:1px solid #eee;font-style:italic">This is a Quotation / Estimate only and not a Tax Invoice. A formal Tax Invoice will be raised upon confirmation.</div>
</div>`;
}

export function printQuotation(d, settings) {
  const html = buildQuotationHTML(d, settings);
  const css = `@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}html,body{width:210mm;font-family:Arial,sans-serif;font-size:10.5px;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{padding:14mm 12mm 10mm 12mm;display:flex;flex-direction:column;align-items:center}div[style*="max-width:760px"]{width:186mm;max-width:186mm}`;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quotation ${d.no}</title><style>${css}</style></head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script></body></html>`);
  w.document.close();
}
