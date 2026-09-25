import { useMemo, useRef, useState } from 'react';
import { Wallet, Plus, Pencil, Trash2, CreditCard, X as XIcon, FileText, Wrench, Eye, Download, Upload, Paperclip, FileX } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO, uid } from '../lib/utils.js';
import { printVendorStatement } from '../lib/vendorStatement.js';
import { compressBillFile } from '../lib/fileCompress.js';
import JSZip from 'jszip';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

const CATEGORIES = ['Equipment Rental', 'Travel & Transport', 'Shoot Location', 'Crew / Freelancer', 'Props & Materials', 'Post Production', 'Software / Subscription', 'Vendor Payment', 'Printing / Stationery', 'Other'];
const PAY_MODES = ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Card'];

function emptyExpense() {
  return {
    date: todayISO(), cat: 'Equipment Rental', desc: '', billno: '', amt: '',
    vendor: '', vcontact: '', vpan: '', vgst: '', vtype: 'nogst',
    gstRate: 18, gstBillingType: 'intra', gstInclusive: 'inclusive',
    notes: '', paymentSplits: [], projectLabel: '',
    billFile: null,
  };
}

/** Opens a stored bill (compressed JPEG data URL) in a new tab. */
function viewBill(billFile) {
  if (!billFile) return;
  window.open(billFile.dataUrl, '_blank');
}

/** Downloads a stored bill to disk. */
function downloadBill(billFile) {
  if (!billFile) return;
  const a = document.createElement('a');
  a.href = billFile.dataUrl;
  a.download = billFile.name || 'bill.jpg';
  a.click();
}

function computeStatus(amt, splits) {
  const paid = (splits || []).reduce((s, sp) => s + (parseFloat(sp.amt) || 0), 0);
  const bal = Math.max(0, (parseFloat(amt) || 0) - paid);
  const status = paid <= 0 ? 'unpaid' : bal <= 0 ? 'paid' : 'partial';
  return { paid, bal, status };
}

function computeGST(amt, vtype, gstRate, gstInclusive) {
  const a = parseFloat(amt) || 0;
  if (vtype !== 'gst') return { baseAmt: a, gstAmt: 0 };
  if (gstInclusive === 'inclusive') {
    const baseAmt = a / (1 + gstRate / 100);
    return { baseAmt, gstAmt: a - baseAmt };
  }
  return { baseAmt: a, gstAmt: a * (gstRate / 100) };
}

export default function Expenses() {
  const { DB, updateDB } = useDB();
  const [view, setView] = useState('list'); // list | vendor
  const [vendorFilter, setVendorFilter] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(emptyExpense());
  const [payForm, setPayForm] = useState(null); // { amt, date, mode, paidBy, ref }
  const [compressingBill, setCompressingBill] = useState(false);
  const billInputRef = useRef(null);

  const withStatus = DB.expenses.map((e) => ({ ...e, ...computeStatus(e.amt, e.paymentSplits) }));

  const totalAmt = withStatus.reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);
  const totalPaid = withStatus.reduce((s, e) => s + e.paid, 0);
  const totalOutstanding = withStatus.reduce((s, e) => s + e.bal, 0);
  const totalGST = withStatus.reduce((s, e) => s + (parseFloat(e.gstAmt) || 0), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withStatus
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => statusFilter === 'all' || e.status === statusFilter)
      .filter(({ e }) => !q || [e.desc, e.vendor, e.cat, e.billno].filter(Boolean).join(' ').toLowerCase().includes(q))
      .reverse();
  }, [withStatus, search, statusFilter]);

  function openAdd() { setEditIdx(null); setForm(emptyExpense()); setPayForm(null); setModalOpen(true); }
  function openEdit(i) { setEditIdx(i); setForm({ ...DB.expenses[i] }); setPayForm(null); setModalOpen(true); }

  function remove(i) {
    if (!confirm('Delete this expense?')) return;
    updateDB((prev) => ({ ...prev, expenses: prev.expenses.filter((_, idx) => idx !== i) }));
  }

  function fillFromVendor(idx) {
    if (idx === '') return;
    const v = DB.vendors[idx];
    setForm((f) => ({
      ...f,
      vendor: v.biz || v.name || '', vcontact: v.mobile || '',
      vpan: v.pan || '', vgst: v.gst || '', vtype: v.vendorType === 'gst' || v.gst ? 'gst' : 'nogst',
    }));
  }

  function save() {
    if (!form.desc.trim() || !parseFloat(form.amt)) { alert('Description and amount are required'); return; }
    const { baseAmt, gstAmt } = computeGST(form.amt, form.vtype, form.gstRate, form.gstInclusive);
    const record = { ...form, amt: parseFloat(form.amt), baseAmt, gstAmt };
    updateDB((prev) => {
      const expenses = [...prev.expenses];
      if (editIdx !== null) expenses[editIdx] = record; else expenses.push(record);
      return { ...prev, expenses };
    });
    setModalOpen(false);
  }

  function addPayment() {
    if (!payForm || !parseFloat(payForm.amt)) { alert('Enter a payment amount'); return; }
    setForm((f) => ({ ...f, paymentSplits: [...(f.paymentSplits || []), { id: uid(), ...payForm, amt: parseFloat(payForm.amt) }] }));
    setPayForm(null);
  }

  function removePayment(id) {
    setForm((f) => ({ ...f, paymentSplits: (f.paymentSplits || []).filter((p) => p.id !== id) }));
  }

  async function handleBillUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Please upload an image or PDF file.');
      return;
    }
    setCompressingBill(true);
    try {
      const compressed = await compressBillFile(file);
      setForm((f) => ({ ...f, billFile: { ...compressed, uploadDate: todayISO() } }));
    } catch (err) {
      console.error(err);
      alert('Could not process that file — try a different image or PDF.');
    } finally {
      setCompressingBill(false);
    }
  }

  function removeBillFile() {
    setForm((f) => ({ ...f, billFile: null }));
  }

  const { paid: formPaid, bal: formBal, status: formStatus } = computeStatus(form.amt, form.paymentSplits);
  const { gstAmt: formGstAmt } = computeGST(form.amt, form.vtype, form.gstRate, form.gstInclusive);

  const statusBadgeClass = (st) => ({
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    partial: 'bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-400',
    unpaid: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  }[st]);

  return (
    <div>
      <div className="mb-5 flex border-b border-ink/10 dark:border-white/10">
        <button onClick={() => setView('list')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${view === 'list' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>Expenses</button>
        <button onClick={() => setView('vendor')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${view === 'vendor' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>Vendor Payments</button>
        <button onClick={() => setView('bills')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${view === 'bills' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>Vendor Bills</button>
      </div>

      {view === 'bills' ? (
        <BillsArchiveView DB={DB} />
      ) : view === 'vendor' ? (
        <VendorPaymentsView DB={DB} vendorFilter={vendorFilter} setVendorFilter={setVendorFilter} />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Expenses" value={`₹${fmt(totalAmt)}`} sub={`${DB.expenses.length} entries`} />
        <StatCard label="Paid" value={`₹${fmt(totalPaid)}`} tone="green" />
        <StatCard label="Outstanding" value={`₹${fmt(totalOutstanding)}`} tone="amber" />
        <StatCard label="GST Input Credit" value={`₹${fmt(totalGST)}`} tone="blue" />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">Expenses</div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-auto py-1.5 text-xs">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </Select>
            <input
              placeholder="Search expenses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-ink/40 dark:border-white/15 dark:bg-black/20 dark:text-white"
            />
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Expense</Button>
          </div>
        </div>

        {DB.expenses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Wallet size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No expenses recorded yet.</div>
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Expense</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-ink/40 dark:text-white/40">No expenses match your filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Description</th>
                  <th className="px-5 py-2.5 font-medium">Category</th>
                  <th className="px-5 py-2.5 font-medium">Vendor</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Bill</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ e, i }) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(e.date)}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink dark:text-white">{e.desc}</div>
                      {e.billno && <div className="text-xs text-ink/40 dark:text-white/35">Bill #{e.billno}</div>}
                    </td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">{e.cat}</td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">{e.vendor || '—'}</td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">
                      ₹{fmt(e.amt)}
                      {e.status === 'partial' && <div className="text-[11px] text-ink/40 dark:text-white/35">₹{fmt(e.bal)} due</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(e.status)}`}>
                        {e.status === 'paid' ? 'Paid' : e.status === 'partial' ? 'Partial' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {e.billFile ? (
                        <button onClick={() => viewBill(e.billFile)} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20">
                          <Paperclip size={11} /> Attached
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-500 dark:bg-rose-500/10 dark:text-rose-400/80">
                          <FileX size={11} /> No bill
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        {e.billFile && (
                          <Button size="sm" variant="ghost" onClick={() => downloadBill(e.billFile)} title="Download bill"><Download size={14} /></Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(i)}><Pencil size={14} /></Button>
                        <Button size="sm" variant="danger" onClick={() => remove(i)}><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editIdx !== null ? 'Edit Expense' : 'Add Expense'}
        wide
        footer={<><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save Expense</Button></>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Total Amount (₹)"><Input type="number" value={form.amt} onChange={(e) => setForm({ ...form, amt: e.target.value })} placeholder="5000" /></Field>
          <Field label="Description" className="sm:col-span-2"><Input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="Camera lens hire for shoot" /></Field>
          <Field label="Bill / Invoice No."><Input value={form.billno} onChange={(e) => setForm({ ...form, billno: e.target.value })} /></Field>
          <Field label="Project (optional)">
            <Select value={form.projectLabel || ''} onChange={(e) => setForm({ ...form, projectLabel: e.target.value })}>
              <option value="">— No project —</option>
              {DB.projects.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Internal Notes" className="sm:col-span-3"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>

        <div className="mt-6 mb-3 border-b border-ink/10 pb-2 font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:border-white/10 dark:text-white/40">Vendor Details</div>
        {DB.vendors.length > 0 && (
          <Field label="Auto-fill from saved vendor" className="mb-3">
            <Select defaultValue="" onChange={(e) => fillFromVendor(e.target.value)}>
              <option value="">— Select saved vendor —</option>
              {DB.vendors.map((v, idx) => <option key={idx} value={idx}>{v.biz || v.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vendor / Company Name"><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Field>
          <Field label="Vendor Contact / Mobile"><Input value={form.vcontact} onChange={(e) => setForm({ ...form, vcontact: e.target.value })} /></Field>
          <Field label="Vendor Type">
            <Select value={form.vtype} onChange={(e) => setForm({ ...form, vtype: e.target.value })}>
              <option value="nogst">Non-GST</option>
              <option value="gst">GST Registered</option>
            </Select>
          </Field>
          {form.vtype === 'gst' && (
            <>
              <Field label="Vendor GSTIN"><Input value={form.vgst} onChange={(e) => setForm({ ...form, vgst: e.target.value.toUpperCase() })} /></Field>
              <Field label="GST Rate (%)"><Input type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: parseFloat(e.target.value) || 0 })} /></Field>
              <Field label="Billing Type">
                <Select value={form.gstBillingType} onChange={(e) => setForm({ ...form, gstBillingType: e.target.value })}>
                  <option value="intra">Intra-state (CGST+SGST)</option>
                  <option value="inter">Inter-state (IGST)</option>
                </Select>
              </Field>
              <Field label="Amount Type">
                <Select value={form.gstInclusive} onChange={(e) => setForm({ ...form, gstInclusive: e.target.value })}>
                  <option value="inclusive">GST Inclusive</option>
                  <option value="exclusive">GST Exclusive</option>
                </Select>
              </Field>
              <Field label="GST Amount (calculated)"><Input readOnly disabled value={`₹${fmt(formGstAmt)}`} /></Field>
            </>
          )}
        </div>

        <div className="mt-6 mb-3 border-b border-ink/10 pb-2 font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:border-white/10 dark:text-white/40">Bill Copy</div>
        <div className="rounded-lg border border-ink/10 bg-[#FAFAF8] p-4 dark:border-white/10 dark:bg-black/20">
          {form.billFile ? (
            <div className="flex items-center gap-3">
              <img src={form.billFile.dataUrl} alt="Bill" className="h-16 w-16 flex-shrink-0 rounded-lg border border-ink/10 object-cover dark:border-white/10" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-ink dark:text-white">{form.billFile.name}</div>
                <div className="text-[11px] text-ink/40 dark:text-white/35">~{form.billFile.sizeKB} KB{form.billFile.wasPdf ? ' · converted from PDF' : ''}</div>
              </div>
              <Button size="sm" onClick={() => viewBill(form.billFile)}><Eye size={14} /> View</Button>
              <Button size="sm" onClick={() => downloadBill(form.billFile)}><Download size={14} /></Button>
              <Button size="sm" variant="danger" onClick={removeBillFile}><Trash2 size={14} /></Button>
            </div>
          ) : compressingBill ? (
            <div className="text-xs text-ink/50 dark:text-white/45">Compressing bill…</div>
          ) : (
            <div className="flex items-center gap-3">
              <Button size="sm" variant="primary" onClick={() => billInputRef.current?.click()}>
                <Upload size={14} /> Upload Bill Copy
              </Button>
              <span className="text-[11px] text-ink/40 dark:text-white/35">Image or PDF — any vendor, GST or not</span>
              <input ref={billInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleBillUpload} />
            </div>
          )}
        </div>

        <div className="mt-6 mb-3 flex items-center justify-between border-b border-ink/10 pb-2 dark:border-white/10">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:text-white/40">Payments</div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(formStatus)}`}>
            {formStatus === 'paid' ? 'Fully Paid' : formStatus === 'partial' ? `₹${fmt(formBal)} due` : 'Unpaid'}
          </span>
        </div>

        {(form.paymentSplits || []).length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {form.paymentSplits.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink/10 bg-[#FAFAF8] px-3 py-2 text-xs dark:border-white/10 dark:bg-black/20">
                <div className="text-ink/70 dark:text-white/70">
                  ₹{fmt(p.amt)} · {fmtDate(p.date)} · {p.mode}{p.paidBy ? ' · ' + p.paidBy : ''}{p.ref ? ' · Ref: ' + p.ref : ''}
                </div>
                <button onClick={() => removePayment(p.id)} className="text-ink/35 hover:text-rose-500 dark:text-white/35"><XIcon size={14} /></button>
              </div>
            ))}
          </div>
        )}

        {payForm ? (
          <div className="rounded-lg border border-ink/10 bg-[#FAFAF8] p-4 dark:border-white/10 dark:bg-black/20">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Amount"><Input type="number" value={payForm.amt} onChange={(e) => setPayForm({ ...payForm, amt: e.target.value })} autoFocus /></Field>
              <Field label="Date"><Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></Field>
              <Field label="Mode">
                <Select value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                  {PAY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </Field>
              <Field label="Reference"><Input value={payForm.ref} onChange={(e) => setPayForm({ ...payForm, ref: e.target.value })} placeholder="UTR / txn ID" /></Field>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="primary" onClick={addPayment}>Add Payment</Button>
              <Button size="sm" onClick={() => setPayForm(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={() => setPayForm({ amt: formBal > 0 ? formBal.toFixed(2) : '', date: todayISO(), mode: 'UPI', paidBy: '', ref: '' })}>
            <CreditCard size={14} /> Record a Payment
          </Button>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  const toneClass = { default: 'text-ink dark:text-white', green: 'text-emerald-600 dark:text-emerald-400', amber: 'text-brass-600 dark:text-brass-400', blue: 'text-blue-600 dark:text-blue-400' }[tone || 'default'];
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/40 dark:text-white/35">{sub}</div>}
    </div>
  );
}

function VendorPaymentsView({ DB, vendorFilter, setVendorFilter }) {
  // Vendor names come from both the saved Vendors list and any free-typed
  // vendor names used on expenses, so nothing gets missed either way.
  const vendorNames = useMemo(() => {
    const set = new Set();
    DB.vendors.forEach((v) => (v.biz || v.name) && set.add(v.biz || v.name));
    DB.expenses.forEach((e) => e.vendor && set.add(e.vendor));
    return Array.from(set).sort();
  }, [DB.vendors, DB.expenses]);

  const vendorExpenses = vendorFilter ? DB.expenses.filter((e) => e.vendor === vendorFilter) : [];

  const totalBilled = vendorExpenses.reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);
  const totalPaid = vendorExpenses.reduce((s, e) => s + (e.paymentSplits || []).reduce((s2, p) => s2 + (parseFloat(p.amt) || 0), 0), 0);
  const totalPending = totalBilled - totalPaid;

  const statusBadgeClass = (st) => ({
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    partial: 'bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-400',
    unpaid: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  }[st]);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">Vendor Payment Report</div>
          {vendorFilter && (
            <Button variant="primary" size="sm" onClick={() => printVendorStatement(vendorFilter, vendorExpenses, DB.settings)}>
              <FileText size={13} /> Print / Download PDF
            </Button>
          )}
        </div>
        <div className="p-5">
          <Field label="Select Vendor">
            <Select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
              <option value="">— Select a vendor —</option>
              {vendorNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      {vendorFilter && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Total Billed" value={`₹${fmt(totalBilled)}`} sub={`${vendorExpenses.length} records`} />
            <StatCard label="Total Paid" value={`₹${fmt(totalPaid)}`} tone="green" />
            <StatCard label="Pending" value={`₹${fmt(totalPending)}`} tone={totalPending > 0 ? 'amber' : 'green'} />
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
            {vendorExpenses.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <Wrench size={26} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
                <div className="text-[13px] text-ink/45 dark:text-white/45">No expense records for this vendor yet.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                      <th className="px-5 py-2.5 font-medium">Date</th>
                      <th className="px-5 py-2.5 font-medium">Description</th>
                      <th className="px-5 py-2.5 font-medium">Category</th>
                      <th className="px-5 py-2.5 font-medium">Billed</th>
                      <th className="px-5 py-2.5 font-medium">Paid</th>
                      <th className="px-5 py-2.5 font-medium">Pending</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorExpenses.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((e, idx) => {
                      const paid = (e.paymentSplits || []).reduce((s, p) => s + (parseFloat(p.amt) || 0), 0);
                      const bal = Math.max(0, (parseFloat(e.amt) || 0) - paid);
                      const status = paid <= 0 ? 'unpaid' : bal <= 0 ? 'paid' : 'partial';
                      return (
                        <tr key={idx} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                          <td className="px-5 py-2.5 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(e.date)}</td>
                          <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{e.desc}</td>
                          <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{e.cat}</td>
                          <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">₹{fmt(e.amt)}</td>
                          <td className="px-5 py-2.5 text-emerald-600 dark:text-emerald-400">₹{fmt(paid)}</td>
                          <td className="px-5 py-2.5 text-rose-600 dark:text-rose-400">₹{fmt(bal)}</td>
                          <td className="px-5 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(status)}`}>{status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BillsArchiveView({ DB }) {
  const [gstFilter, setGstFilter] = useState('all'); // all | gst | nogst
  const [vendorFilter, setVendorFilter] = useState('');
  const [zipping, setZipping] = useState(false);

  const vendorNames = useMemo(() => {
    const set = new Set();
    DB.expenses.forEach((e) => e.billFile && e.vendor && set.add(e.vendor));
    return Array.from(set).sort();
  }, [DB.expenses]);

  const bills = useMemo(() => {
    return DB.expenses
      .map((e, idx) => ({ e, idx }))
      .filter(({ e }) => e.billFile)
      .filter(({ e }) => gstFilter === 'all' || e.vtype === gstFilter)
      .filter(({ e }) => !vendorFilter || e.vendor === vendorFilter)
      .sort((a, b) => (b.e.date || '').localeCompare(a.e.date || ''));
  }, [DB.expenses, gstFilter, vendorFilter]);

  async function downloadAllAsZip() {
    if (bills.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      const usedNames = new Set();
      bills.forEach(({ e }, i) => {
        const safeVendor = (e.vendor || 'vendor').replace(/[^a-z0-9]+/gi, '_');
        const ext = (e.billFile.name || '').match(/\.\w+$/)?.[0] || '.jpg';
        let filename = `${safeVendor}_${e.date || 'nodate'}${ext}`;
        if (usedNames.has(filename)) filename = `${safeVendor}_${e.date || 'nodate'}_${i + 1}${ext}`;
        usedNames.add(filename);
        const base64 = e.billFile.dataUrl.split(',')[1];
        zip.file(filename, base64, { base64: true });
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendor-bills-${todayISO()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Could not build the ZIP file — please try again.');
    } finally {
      setZipping(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total Bills" value={bills.length} />
        <StatCard label="GST Bills" value={DB.expenses.filter((e) => e.billFile && e.vtype === 'gst').length} tone="green" />
        <StatCard label="Non-GST Bills" value={DB.expenses.filter((e) => e.billFile && e.vtype === 'nogst').length} tone="amber" />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">Vendor Bills Archive</div>
          <div className="flex items-center gap-2">
            <Select value={gstFilter} onChange={(e) => setGstFilter(e.target.value)} className="!w-auto py-1.5 text-xs">
              <option value="all">All Bills</option>
              <option value="gst">GST Registered</option>
              <option value="nogst">Non-GST</option>
            </Select>
            <Select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="!w-auto py-1.5 text-xs">
              <option value="">All Vendors</option>
              {vendorNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
            <Button variant="primary" size="sm" onClick={downloadAllAsZip} disabled={zipping || bills.length === 0}>
              <Download size={14} /> {zipping ? 'Zipping…' : `Download All (${bills.length})`}
            </Button>
          </div>
        </div>

        {bills.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Paperclip size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No bills match this filter.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Vendor</th>
                  <th className="px-5 py-2.5 font-medium">Project</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Bill File</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(({ e, idx }) => (
                  <tr key={idx} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-2.5 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(e.date)}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{e.vendor || '—'}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{e.projectLabel || '—'}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">₹{fmt(e.amt)}</td>
                    <td className="px-5 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${e.vtype === 'gst' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-ink/5 text-ink/50 dark:bg-white/10 dark:text-white/45'}`}>
                        {e.vtype === 'gst' ? 'GST' : 'Non-GST'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-ink/50 dark:text-white/40">{e.billFile.name} <span className="text-ink/30 dark:text-white/25">(~{e.billFile.sizeKB}KB)</span></td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => viewBill(e.billFile)} title="View bill"><Eye size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => downloadBill(e.billFile)} title="Download bill"><Download size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 text-[11px] text-ink/35 dark:text-white/30">
        Only GST-registered vendor bills are counted in the GST filing report — Non-GST bills stay here for your own records but won't appear there.
      </div>
    </div>
  );
}