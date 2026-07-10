import { useMemo, useState } from 'react';
import { Wallet, Plus, Pencil, Trash2, CreditCard, X as XIcon } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO, uid } from '../lib/utils.js';
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
  };
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(emptyExpense());
  const [payForm, setPayForm] = useState(null);

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

  const { bal: formBal, status: formStatus } = computeStatus(form.amt, form.paymentSplits);
  const { gstAmt: formGstAmt } = computeGST(form.amt, form.vtype, form.gstRate, form.gstInclusive);

  const statusBadgeClass = (st) => ({
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    partial: 'bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-400',
    unpaid: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  }[st]);

  return (
    <div>
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
                      <div className="flex items-center gap-1.5">
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