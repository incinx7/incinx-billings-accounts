import { useMemo, useState } from 'react';
import { Coins, Plus, Pencil, Trash2, CheckCircle2, Circle, Plane, Wallet2, Users } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO, uid } from '../lib/utils.js';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

const PETTY_CATEGORIES = ['Food & Refreshments', 'Local Conveyance', 'Parking / Tolls', 'Tea / Snacks', 'Miscellaneous'];
const TRAVEL_CATEGORIES = ['Flight', 'Hotel', 'Train', 'Outstation Cab', 'Other Travel'];
const PAYER_PRESETS = ['Company', 'Me', 'Partner'];

function emptyEntry() {
  return {
    id: uid(), date: todayISO(), type: 'petty', category: PETTY_CATEGORIES[0], desc: '',
    amount: '', projectLabel: '', paidBy: 'Company', paidByCustom: '',
    gstApplicable: false, gstRate: 12, taxableAmt: '', gstAmt: '',
    vendor: '', billRef: '', reimbursed: false, reimbursedDate: '', reimbursedNote: '',
  };
}

function payerName(e) { return e.paidBy === 'Other' ? (e.paidByCustom || 'Other') : e.paidBy; }

export default function Petty() {
  const { DB, updateDB } = useDB();
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(emptyEntry());
  const [settleTarget, setSettleTarget] = useState(null); // payer name

  const entries = DB.petty || [];

  const filtered = useMemo(() => {
    return entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => typeFilter === 'all' || e.type === typeFilter)
      .filter(({ e }) => projectFilter === 'all' || e.projectLabel === projectFilter)
      .reverse();
  }, [entries, typeFilter, projectFilter]);

  const totalAmount = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalGST = entries.reduce((s, e) => s + (e.gstApplicable ? parseFloat(e.gstAmt) || 0 : 0), 0);

  // ── Ledger: money owed by company to each non-company payer ──────
  const ledger = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      const name = payerName(e);
      if (name === 'Company') return;
      if (!map[name]) map[name] = { spent: 0, reimbursed: 0 };
      map[name].spent += parseFloat(e.amount) || 0;
      if (e.reimbursed) map[name].reimbursed += parseFloat(e.amount) || 0;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v, owed: v.spent - v.reimbursed }));
  }, [entries]);

  function openAdd() { setEditIdx(null); setForm(emptyEntry()); setModalOpen(true); }
  function openEdit(i) { setEditIdx(i); setForm({ ...entries[i] }); setModalOpen(true); }

  function remove(i) {
    if (!confirm('Delete this entry?')) return;
    updateDB((prev) => ({ ...prev, petty: prev.petty.filter((_, idx) => idx !== i) }));
  }

  function toggleReimbursed(i) {
    updateDB((prev) => {
      const petty = [...prev.petty];
      const cur = petty[i];
      petty[i] = { ...cur, reimbursed: !cur.reimbursed, reimbursedDate: !cur.reimbursed ? todayISO() : '' };
      return { ...prev, petty };
    });
  }

  function settleAllFor(name) {
    if (!confirm(`Mark all unreimbursed entries for ${name} as settled today?`)) return;
    updateDB((prev) => ({
      ...prev,
      petty: prev.petty.map((e) => (payerName(e) === name && !e.reimbursed ? { ...e, reimbursed: true, reimbursedDate: todayISO() } : e)),
    }));
    setSettleTarget(null);
  }

  function save() {
    if (!form.desc.trim() || !parseFloat(form.amount)) { alert('Description and amount are required'); return; }
    const record = { ...form, amount: parseFloat(form.amount) || 0 };
    if (form.gstApplicable) {
      record.taxableAmt = parseFloat(form.taxableAmt) || 0;
      record.gstAmt = parseFloat(form.gstAmt) || 0;
    }
    updateDB((prev) => {
      const petty = [...prev.petty];
      if (editIdx !== null) petty[editIdx] = record; else petty.push(record);
      return { ...prev, petty };
    });
    setModalOpen(false);
  }

  function recalcGST(amount, rate) {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    const taxableAmt = a / (1 + r / 100);
    return { taxableAmt, gstAmt: a - taxableAmt };
  }

  const categories = form.type === 'travel' ? TRAVEL_CATEGORIES : PETTY_CATEGORIES;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Spent" value={`₹${fmt(totalAmount)}`} sub={`${entries.length} entries`} />
        <StatCard label="Reclaimable GST" value={`₹${fmt(totalGST)}`} tone="blue" />
        <StatCard label="Petty Entries" value={entries.filter((e) => e.type === 'petty').length} />
        <StatCard label="Travel Entries" value={entries.filter((e) => e.type === 'travel').length} tone="amber" />
      </div>

      {ledger.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
          <div className="flex items-center gap-2 border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">
            <Users size={15} /> Reimbursement Ledger
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {ledger.map((l) => (
              <div key={l.name} className="rounded-lg border border-ink/10 bg-[#FAFAF8] p-4 dark:border-white/10 dark:bg-black/20">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium text-ink dark:text-white">{l.name}</div>
                  {l.owed > 0 && <Button size="sm" onClick={() => settleAllFor(l.name)}>Settle Up</Button>}
                </div>
                <div className="flex justify-between text-xs text-ink/50 dark:text-white/45"><span>Spent</span><span>₹{fmt(l.spent)}</span></div>
                <div className="flex justify-between text-xs text-ink/50 dark:text-white/45"><span>Reimbursed</span><span>₹{fmt(l.reimbursed)}</span></div>
                <div className={`mt-1.5 flex justify-between border-t border-ink/10 pt-1.5 text-sm font-semibold dark:border-white/10 ${l.owed > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  <span>{l.owed > 0 ? 'Company owes' : 'Settled up'}</span><span>₹{fmt(l.owed)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">Petty Cash &amp; Travel Expenses</div>
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="!w-auto py-1.5 text-xs">
              <option value="all">All Types</option>
              <option value="petty">Petty Cash</option>
              <option value="travel">Travel</option>
            </Select>
            {DB.projects.length > 0 && (
              <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="!w-auto py-1.5 text-xs">
                <option value="all">All Projects</option>
                {DB.projects.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
              </Select>
            )}
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Entry</Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Coins size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No petty cash or travel entries yet.</div>
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Entry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-ink/40 dark:text-white/40">No entries match your filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Description</th>
                  <th className="px-5 py-2.5 font-medium">Project</th>
                  <th className="px-5 py-2.5 font-medium">Paid By</th>
                  <th className="px-5 py-2.5 font-medium">GST</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ e, i }) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(e.date)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 font-medium text-ink dark:text-white">
                        {e.type === 'travel' ? <Plane size={12} className="text-blue-500" /> : <Wallet2 size={12} className="text-ink/30 dark:text-white/30" />}
                        {e.desc}
                      </div>
                      <div className="text-xs text-ink/40 dark:text-white/35">{e.category}</div>
                    </td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">{e.projectLabel || '—'}</td>
                    <td className="px-5 py-3">
                      <span className="text-ink/70 dark:text-white/70">{payerName(e)}</span>
                      {payerName(e) !== 'Company' && (
                        <button onClick={() => toggleReimbursed(i)} className={`ml-1.5 inline-flex items-center gap-0.5 text-[11px] ${e.reimbursed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                          {e.reimbursed ? <CheckCircle2 size={12} /> : <Circle size={12} />} {e.reimbursed ? 'Reimbursed' : 'Owed'}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-ink/60 dark:text-white/55">{e.gstApplicable ? `₹${fmt(e.gstAmt)}` : '—'}</td>
                    <td className="px-5 py-3 font-medium text-ink dark:text-white">₹{fmt(e.amount)}</td>
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
        title={editIdx !== null ? 'Edit Entry' : 'Add Petty Cash / Travel Entry'}
        wide
        footer={<><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save Entry</Button></>}
      >
        <div className="mb-4 flex gap-1 rounded-lg bg-ink/5 p-1 dark:bg-white/5">
          <button onClick={() => setForm({ ...form, type: 'petty', category: PETTY_CATEGORIES[0] })} className={`flex-1 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${form.type === 'petty' ? 'bg-white text-ink shadow-sm dark:bg-noir-soft dark:text-white' : 'text-ink/50 dark:text-white/45'}`}>💵 Petty Cash</button>
          <button onClick={() => setForm({ ...form, type: 'travel', category: TRAVEL_CATEGORIES[0] })} className={`flex-1 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${form.type === 'travel' ? 'bg-white text-ink shadow-sm dark:bg-noir-soft dark:text-white' : 'text-ink/50 dark:text-white/45'}`}>✈️ Travel Expense</button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2"><Input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder={form.type === 'travel' ? 'Flight — Mumbai to Delhi for shoot' : 'Cab fare to location'} /></Field>
          <Field label="Amount (₹)"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Project (optional)">
            <Select value={form.projectLabel} onChange={(e) => setForm({ ...form, projectLabel: e.target.value })}>
              <option value="">— No project —</option>
              {DB.projects.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
            </Select>
          </Field>
          {form.type === 'travel' && (
            <Field label="Vendor (Airline / Hotel Name)"><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Field>
          )}
          <Field label="Paid By">
            <Select value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })}>
              {PAYER_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="Other">Other (type name)</option>
            </Select>
          </Field>
          {form.paidBy === 'Other' && (
            <Field label="Payer Name"><Input value={form.paidByCustom} onChange={(e) => setForm({ ...form, paidByCustom: e.target.value })} /></Field>
          )}
          {form.type === 'travel' && <Field label="Bill / Ticket Ref."><Input value={form.billRef} onChange={(e) => setForm({ ...form, billRef: e.target.value })} /></Field>}
        </div>

        <div className="mt-5 rounded-lg border border-ink/10 bg-[#FAFAF8] p-4 dark:border-white/10 dark:bg-black/20">
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink dark:text-white">
            <input
              type="checkbox"
              checked={form.gstApplicable}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked && form.amount) {
                  const { taxableAmt, gstAmt } = recalcGST(form.amount, form.gstRate);
                  setForm({ ...form, gstApplicable: checked, taxableAmt: taxableAmt.toFixed(2), gstAmt: gstAmt.toFixed(2) });
                } else {
                  setForm({ ...form, gstApplicable: checked });
                }
              }}
            />
            This bill includes GST (claim as Input Tax Credit)
          </label>
          {form.gstApplicable && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="GST Rate (%)">
                <Input type="number" value={form.gstRate} onChange={(e) => {
                  const { taxableAmt, gstAmt } = recalcGST(form.amount, e.target.value);
                  setForm({ ...form, gstRate: e.target.value, taxableAmt: taxableAmt.toFixed(2), gstAmt: gstAmt.toFixed(2) });
                }} />
              </Field>
              <Field label="Taxable Amount (₹)"><Input readOnly disabled value={form.taxableAmt} /></Field>
              <Field label="GST Amount (₹)"><Input readOnly disabled value={form.gstAmt} /></Field>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  const toneClass = { default: 'text-ink dark:text-white', blue: 'text-blue-600 dark:text-blue-400', amber: 'text-brass-600 dark:text-brass-400' }[tone || 'default'];
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/40 dark:text-white/35">{sub}</div>}
    </div>
  );
}
