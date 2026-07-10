import { useMemo, useRef, useState } from 'react';
import { FileBarChart2, Upload, Plus, Pencil, Trash2, Download, ScanLine, AlertTriangle, Database, FileText } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO, dlCSV, netReceivable } from '../lib/utils.js';
import { ocrImage } from '../lib/ocr.js';
import { pdfFirstPageToImage } from '../lib/pdfToImage.js';
import { parseBillText } from '../lib/billParse.js';
import { printCAGSTReport } from '../lib/caGstReport.js';
import { printPLReport } from '../lib/plReport.js';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input } from '../components/ui/Field.jsx';

function emptyBill() {
  return { name: 'Manual Entry', vendor: '', gst: '', pan: '', billNo: '', billDate: todayISO(), billMonth: '', taxableAmt: '', gstAmt: '', amount: '', type: 'manual' };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthLabel(ym) {
  if (!ym || ym === 'all') return 'All Time';
  const [y, m] = ym.split('-');
  return MONTH_NAMES[parseInt(m, 10) - 1] + ' ' + y;
}

export default function Reports() {
  const { DB, updateDB } = useDB();
  const fileInputRef = useRef(null);
  const [monthFilter, setMonthFilter] = useState('all');
  const [scanning, setScanning] = useState(null); // { current, total, progress, fileName }
  const [reviewQueue, setReviewQueue] = useState([]); // scanned bills awaiting confirmation
  const [reviewIdx, setReviewIdx] = useState(0);
  const [manualModal, setManualModal] = useState(null); // bill form or null
  const [editIdx, setEditIdx] = useState(null);

  const months = useMemo(() => {
    const set = new Set();
    DB.invoices.forEach((i) => i.date && set.add(i.date.slice(0, 7)));
    DB.expenses.forEach((e) => e.date && set.add(e.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [DB.invoices, DB.expenses]);

  const inMonth = (dateStr) => monthFilter === 'all' || (dateStr && dateStr.slice(0, 7) === monthFilter);
  const filtInv = DB.invoices.filter((i) => inMonth(i.date));
  const filtExp = DB.expenses.filter((e) => inMonth(e.date));
  const filtInf = (DB.informal || []).filter((f) => inMonth(f.date));
  const informalTotal = filtInf.reduce((s, f) => s + (parseFloat(f.amt) || 0), 0);
  const informalPassThrough = filtInf.reduce((s, f) => s + (f.to ? (parseFloat(f.toAmt) || parseFloat(f.amt) || 0) : 0), 0);

  const grossRevenue = filtInv.reduce((s, i) => s + (i.total || 0), 0) + informalTotal;
  const paidRevenue = filtInv.filter((i) => i.status === 'paid').reduce((s, i) => s + netReceivable(i), 0) + informalTotal;
  const gstCollected = filtInv.reduce((s, i) => s + (i.totalTax || 0), 0);
  const tdsTotal = filtInv.filter((i) => i.tdsApplicable).reduce((s, i) => s + (parseFloat(i.tdsAmount) || 0), 0);
  const totalExpenses = filtExp.reduce((s, e) => s + (parseFloat(e.amt) || 0), 0) + informalPassThrough;
  const netProfit = paidRevenue - totalExpenses;

  const gstBills = DB.gstBills || [];
  const billsByMonth = useMemo(() => {
    const groups = {};
    gstBills.forEach((b, i) => {
      const key = b.billMonth || 'Unspecified';
      if (!groups[key]) groups[key] = [];
      groups[key].push({ b, i });
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [gstBills]);

  const incompleteCount = gstBills.filter((b) => !b.gst || b.gst.length < 15 || !b.amount || !b.billDate).length;

  async function handleFiles(files) {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (fileArr.length < files.length) {
      alert('Some files were skipped — only images and PDFs are supported.');
    }
    if (fileArr.length === 0) return;

    const queue = [];
    for (let idx = 0; idx < fileArr.length; idx++) {
      const originalFile = fileArr[idx];
      const isPdf = originalFile.type === 'application/pdf';
      setScanning({ current: idx + 1, total: fileArr.length, progress: 0, fileName: originalFile.name, stage: isPdf ? 'Converting PDF…' : 'Scanning…' });

      const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = (e) => res(e.target.result); r.readAsDataURL(originalFile); });

      try {
        let imageFile = originalFile;
        if (isPdf) {
          imageFile = await pdfFirstPageToImage(originalFile);
          setScanning((s) => ({ ...s, stage: 'Scanning…' }));
        }
        const text = await ocrImage(imageFile, (p) => setScanning((s) => ({ ...s, progress: p })));
        const extracted = parseBillText(text);
        queue.push({ ...extracted, name: originalFile.name, uploadDate: todayISO(), type: originalFile.type, data: dataUrl, ocrRaw: text });
      } catch (err) {
        console.error('OCR failed for', originalFile.name, err);
        queue.push({ ...emptyBill(), name: originalFile.name, uploadDate: todayISO(), type: originalFile.type, data: dataUrl, ocrError: isPdf ? 'Could not read this PDF — fill in manually' : 'OCR failed — fill in manually' });
      }
    }
    setScanning(null);
    setReviewQueue(queue);
    setReviewIdx(0);
  }

  function confirmReviewBill(edited) {
    updateDB((prev) => ({ ...prev, gstBills: [...(prev.gstBills || []), edited] }));
    if (reviewIdx + 1 < reviewQueue.length) {
      setReviewIdx(reviewIdx + 1);
    } else {
      setReviewQueue([]);
      setReviewIdx(0);
    }
  }

  function skipReviewBill() {
    if (reviewIdx + 1 < reviewQueue.length) setReviewIdx(reviewIdx + 1);
    else { setReviewQueue([]); setReviewIdx(0); }
  }

  function saveManualBill(bill) {
    updateDB((prev) => {
      const bills = [...(prev.gstBills || [])];
      if (editIdx !== null) bills[editIdx] = bill; else bills.push(bill);
      return { ...prev, gstBills: bills };
    });
    setManualModal(null);
    setEditIdx(null);
  }

  function deleteBill(i) {
    if (!confirm('Delete this GST bill?')) return;
    updateDB((prev) => ({ ...prev, gstBills: prev.gstBills.filter((_, idx) => idx !== i) }));
  }

  function deleteAllBills() {
    if (gstBills.length === 0) return;
    if (!confirm(`Delete ALL ${gstBills.length} bill(s)? This cannot be undone.`)) return;
    updateDB((prev) => ({ ...prev, gstBills: [] }));
  }

  function exportInvoicesCSV() {
    const rows = [['Invoice No', 'Date', 'Client', 'Amount', 'Status']];
    filtInv.forEach((i) => rows.push([i.no, i.date, i.cname, i.total, i.status]));
    dlCSV(rows.map((r) => r.join(',')).join('\n'), `invoices_${monthFilter}.csv`);
  }
  function exportExpensesCSV() {
    const rows = [['Date', 'Description', 'Category', 'Vendor', 'Amount']];
    filtExp.forEach((e) => rows.push([e.date, e.desc, e.cat, e.vendor, e.amt]));
    dlCSV(rows.map((r) => r.join(',')).join('\n'), `expenses_${monthFilter}.csv`);
  }
  function exportGSTSummaryCSV() {
    const rows = [['Vendor', 'GSTIN', 'Bill No', 'Bill Date', 'Taxable Amt', 'GST Amt', 'Total']];
    gstBills.forEach((b) => rows.push([b.vendor, b.gst, b.billNo, b.billDate, b.taxableAmt, b.gstAmt, b.amount]));
    dlCSV(rows.map((r) => r.join(',')).join('\n'), 'gst_summary.csv');
  }

  function fullBackup() {
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `incinx_backup_${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function restoreBackup(file) {
    if (!file) return;
    if (!confirm('This will REPLACE all current data with the backup file. Continue?')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        updateDB(() => data);
        alert('Backup restored successfully.');
      } catch (err) {
        alert('Could not read that file — make sure it\'s a valid INCINX backup JSON.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40 dark:text-white/35">Month:</span>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[13px] font-medium text-ink outline-none dark:border-white/15 dark:bg-noir-soft dark:text-white">
          <option value="all">All Months</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Gross Revenue" value={`₹${fmt(grossRevenue)}`} />
        <StatCard label="GST Collected" value={`₹${fmt(gstCollected)}`} tone="amber" />
        <StatCard label="TDS Deducted" value={`₹${fmt(tdsTotal)}`} tone="blue" sub="Claimable as tax credit" />
        <StatCard label="Total Expenses" value={`₹${fmt(totalExpenses)}`} tone="red" />
        <StatCard label="Net Profit" value={`₹${fmt(netProfit)}`} tone={netProfit >= 0 ? 'green' : 'red'} />
      </div>

      {tdsTotal > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
          <div className="border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
            <div className="text-[13px] font-semibold text-ink dark:text-white">TDS Summary — by Client</div>
            <div className="text-xs text-ink/40 dark:text-white/35">Reconcile against Form 26AS / TDS certificates when filing</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Client</th>
                  <th className="px-5 py-2.5 font-medium">Invoice</th>
                  <th className="px-5 py-2.5 font-medium">Invoice Total</th>
                  <th className="px-5 py-2.5 font-medium">TDS Rate</th>
                  <th className="px-5 py-2.5 font-medium">TDS Deducted</th>
                  <th className="px-5 py-2.5 font-medium">Net Received</th>
                </tr>
              </thead>
              <tbody>
                {filtInv.filter((i) => i.tdsApplicable).map((i, idx) => (
                  <tr key={idx} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-2.5 font-medium text-ink dark:text-white">{i.cname}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-ink/60 dark:text-white/55">{i.no}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">₹{fmt(i.total)}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{i.tdsRate}%</td>
                    <td className="px-5 py-2.5 text-blue-600 dark:text-blue-400">₹{fmt(i.tdsAmount)}</td>
                    <td className="px-5 py-2.5 text-emerald-600 dark:text-emerald-400">₹{fmt(netReceivable(i))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#FAFAF8] font-semibold dark:bg-black/20">
                  <td className="px-5 py-2.5 text-ink dark:text-white" colSpan={4}>Total TDS Deducted</td>
                  <td className="px-5 py-2.5 text-blue-600 dark:text-blue-400">₹{fmt(tdsTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">GST Report for CA</div>
          <div className="text-xs text-ink/40 dark:text-white/35">Formatted PDF combining GST client invoices + uploaded vendor GST bills, filtered by the month selected above</div>
        </div>
        <div className="flex flex-wrap gap-2 p-5">
          <Button variant="primary" onClick={() => printCAGSTReport(DB, monthFilter)}><FileBarChart2 size={14} /> Download GST Report PDF for CA</Button>
          <Button onClick={() => printPLReport(DB, monthFilter)}><FileBarChart2 size={14} /> Download P&amp;L Report PDF</Button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">Raw Data Exports &amp; Backup</div>
        <div className="flex flex-wrap gap-2 p-5">
          <Button size="sm" onClick={exportInvoicesCSV}><Download size={13} /> Invoices CSV</Button>
          <Button size="sm" onClick={exportExpensesCSV}><Download size={13} /> Expenses CSV</Button>
          <Button size="sm" onClick={exportGSTSummaryCSV}><Download size={13} /> GST Summary CSV</Button>
          <Button size="sm" variant="primary" onClick={fullBackup}><Database size={13} /> Full Backup (All Data)</Button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brass-400/40 bg-brass-50 px-3.5 py-2 text-[13px] font-medium text-brass-600 hover:bg-brass-100 dark:border-brass-400/30 dark:bg-brass-500/10 dark:text-brass-400 dark:hover:bg-brass-500/15">
            <Upload size={13} /> Restore Backup
            <input type="file" accept=".json" className="hidden" onChange={(e) => restoreBackup(e.target.files[0])} />
          </label>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div>
            <div className="text-[13px] font-semibold text-ink dark:text-white">Vendor GST Bills</div>
            <div className="text-xs text-ink/40 dark:text-white/35">Free on-device OCR scans bill images for GSTIN, amounts &amp; date — review before saving</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { setEditIdx(null); setManualModal(emptyBill()); }}><Plus size={13} /> Add Manually</Button>
            <Button size="sm" variant="primary" onClick={() => fileInputRef.current?.click()}><ScanLine size={13} /> Upload &amp; Scan</Button>
            {gstBills.length > 0 && <Button size="sm" variant="danger" onClick={deleteAllBills}><Trash2 size={13} /> Delete All</Button>}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          </div>
        </div>

        {scanning && (
          <div className="border-b border-ink/10 bg-brass-50 px-5 py-3 text-[13px] text-brass-700 dark:border-white/10 dark:bg-brass-500/10 dark:text-brass-400">
            ⏳ {scanning.stage || 'Scanning…'} {scanning.current} of {scanning.total}: <em>{scanning.fileName}</em> — {scanning.progress}%
          </div>
        )}

        {incompleteCount > 0 && (
          <div className="flex items-center gap-2 border-b border-ink/10 bg-rose-50 px-5 py-2.5 text-xs text-rose-600 dark:border-white/10 dark:bg-rose-500/10 dark:text-rose-400">
            <AlertTriangle size={13} /> {incompleteCount} bill(s) missing GSTIN, amount, or date — click Edit to complete them.
          </div>
        )}

        {gstBills.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <ScanLine size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] font-medium text-ink dark:text-white">No vendor GST bills yet</div>
            <div className="max-w-sm text-xs text-ink/40 dark:text-white/35">Upload bill images — free on-device OCR will extract GSTIN, amounts &amp; date automatically. Or click "Add Manually" to type in details.</div>
          </div>
        ) : (
          <div className="flex flex-col">
            {billsByMonth.map(([month, items]) => {
              const mTaxable = items.reduce((s, { b }) => s + (b.taxableAmt || 0), 0);
              const mGst = items.reduce((s, { b }) => s + (b.gstAmt || 0), 0);
              const mTotal = items.reduce((s, { b }) => s + (b.amount || 0), 0);
              return (
                <div key={month} className="border-b border-ink/10 last:border-0 dark:border-white/10">
                  <div className="bg-[#FAFAF8] px-5 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-ink/50 dark:bg-black/20 dark:text-white/45">
                    {month === 'Unspecified' ? 'Unspecified Month' : monthLabel(month)} — {items.length} bill(s)
                  </div>
                  <table className="w-full text-left text-[13px]">
                    <tbody>
                      {items.map(({ b, i }) => (
                        <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                          <td className="px-5 py-2.5">
                            <div className="font-medium text-ink dark:text-white">{b.vendor || '(no name)'}</div>
                            <div className="font-mono text-[11px] text-ink/40 dark:text-white/35">{b.gst || 'no GSTIN'} {b.billNo ? '· #' + b.billNo : ''}</div>
                          </td>
                          <td className="px-5 py-2.5 font-mono text-xs text-ink/60 dark:text-white/55">{b.billDate ? fmtDate(b.billDate) : '—'}</td>
                          <td className="px-5 py-2.5 text-right text-ink/70 dark:text-white/70">₹{fmt(b.taxableAmt)}</td>
                          <td className="px-5 py-2.5 text-right text-brass-600 dark:text-brass-400">₹{fmt(b.gstAmt)}</td>
                          <td className="px-5 py-2.5 text-right font-medium text-ink dark:text-white">₹{fmt(b.amount)}</td>
                          <td className="px-5 py-2.5">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => { setEditIdx(i); setManualModal({ ...b }); }}><Pencil size={13} /></Button>
                              <Button size="sm" variant="danger" onClick={() => deleteBill(i)}><Trash2 size={13} /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#FAFAF8] font-mono text-[11px] font-semibold dark:bg-black/20">
                        <td className="px-5 py-2 text-ink/60 dark:text-white/55" colSpan={2}>Subtotal</td>
                        <td className="px-5 py-2 text-right text-ink/70 dark:text-white/70">₹{fmt(mTaxable)}</td>
                        <td className="px-5 py-2 text-right text-brass-600 dark:text-brass-400">₹{fmt(mGst)}</td>
                        <td className="px-5 py-2 text-right text-ink dark:text-white">₹{fmt(mTotal)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reviewQueue.length > 0 && (
        <BillReviewModal
          bill={reviewQueue[reviewIdx]}
          index={reviewIdx}
          total={reviewQueue.length}
          onConfirm={confirmReviewBill}
          onSkip={skipReviewBill}
        />
      )}

      <Modal
        open={!!manualModal}
        onClose={() => { setManualModal(null); setEditIdx(null); }}
        title={editIdx !== null ? 'Edit GST Bill' : 'Add GST Bill Manually'}
        footer={<><Button onClick={() => { setManualModal(null); setEditIdx(null); }}>Cancel</Button><Button variant="primary" onClick={() => saveManualBill(manualModal)}>Save</Button></>}
      >
        {manualModal && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vendor Name" className="sm:col-span-2"><Input value={manualModal.vendor} onChange={(e) => setManualModal({ ...manualModal, vendor: e.target.value })} /></Field>
            <Field label="Vendor GSTIN"><Input value={manualModal.gst} onChange={(e) => setManualModal({ ...manualModal, gst: e.target.value.toUpperCase() })} /></Field>
            <Field label="Vendor PAN"><Input value={manualModal.pan} onChange={(e) => setManualModal({ ...manualModal, pan: e.target.value.toUpperCase() })} /></Field>
            <Field label="Bill No."><Input value={manualModal.billNo} onChange={(e) => setManualModal({ ...manualModal, billNo: e.target.value })} /></Field>
            <Field label="Bill Date"><Input type="date" value={manualModal.billDate} onChange={(e) => setManualModal({ ...manualModal, billDate: e.target.value, billMonth: e.target.value.slice(0, 7) })} /></Field>
            <Field label="Taxable Amount (₹)"><Input type="number" value={manualModal.taxableAmt} onChange={(e) => setManualModal({ ...manualModal, taxableAmt: parseFloat(e.target.value) || 0 })} /></Field>
            <Field label="GST Amount (₹)"><Input type="number" value={manualModal.gstAmt} onChange={(e) => setManualModal({ ...manualModal, gstAmt: parseFloat(e.target.value) || 0 })} /></Field>
            <Field label="Total Amount (₹)" className="sm:col-span-2"><Input type="number" value={manualModal.amount} onChange={(e) => setManualModal({ ...manualModal, amount: parseFloat(e.target.value) || 0 })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function BillReviewModal({ bill, index, total, onConfirm, onSkip }) {
  const [f, setF] = useState(bill);

  return (
    <Modal open title={`Review Scanned Bill (${index + 1} of ${total})`} onClose={onSkip} footer={
      <>
        <Button onClick={onSkip}>Skip This One</Button>
        <Button variant="primary" onClick={() => onConfirm(f)}>Save &amp; {index + 1 < total ? 'Next' : 'Finish'}</Button>
      </>
    }>
      <div className="mb-3 flex gap-3">
        {bill.type === 'application/pdf' ? (
          <a href={bill.data} target="_blank" rel="noreferrer" className="flex h-32 w-24 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-ink/10 bg-ink/5 text-[10px] text-ink/50 hover:bg-ink/10 dark:border-white/10 dark:bg-white/5 dark:text-white/45">
            <FileText size={20} />
            View PDF
          </a>
        ) : (
          <img src={bill.data} alt={bill.name} className="h-32 w-24 flex-shrink-0 rounded-lg border border-ink/10 object-cover dark:border-white/10" />
        )}
        <div className="text-xs text-ink/50 dark:text-white/45">
          <div className="mb-1 font-medium text-ink dark:text-white">{bill.name}</div>
          {bill.ocrError ? (
            <div className="text-rose-500">{bill.ocrError}</div>
          ) : (
            <div>Free OCR extracted these fields automatically — double-check them, especially vendor name and amounts, before saving.</div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Vendor Name" className="sm:col-span-2"><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
        <Field label="Vendor GSTIN"><Input value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value.toUpperCase() })} /></Field>
        <Field label="Vendor PAN"><Input value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} /></Field>
        <Field label="Bill No."><Input value={f.billNo} onChange={(e) => setF({ ...f, billNo: e.target.value })} /></Field>
        <Field label="Bill Date"><Input type="date" value={f.billDate} onChange={(e) => setF({ ...f, billDate: e.target.value, billMonth: e.target.value.slice(0, 7) })} /></Field>
        <Field label="Taxable Amount (₹)"><Input type="number" value={f.taxableAmt} onChange={(e) => setF({ ...f, taxableAmt: parseFloat(e.target.value) || 0 })} /></Field>
        <Field label="GST Amount (₹)"><Input type="number" value={f.gstAmt} onChange={(e) => setF({ ...f, gstAmt: parseFloat(e.target.value) || 0 })} /></Field>
        <Field label="Total Amount (₹)" className="sm:col-span-2"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: parseFloat(e.target.value) || 0 })} /></Field>
      </div>
    </Modal>
  );
}

function StatCard({ label, value, tone, sub }) {
  const toneClass = { default: 'text-ink dark:text-white', green: 'text-emerald-600 dark:text-emerald-400', amber: 'text-brass-600 dark:text-brass-400', red: 'text-rose-600 dark:text-rose-400', blue: 'text-blue-600 dark:text-blue-400' }[tone || 'default'];
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/40 dark:text-white/35">{sub}</div>}
    </div>
  );
}
