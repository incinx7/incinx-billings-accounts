import { useMemo, useState } from 'react';
import { IndianRupee, Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO } from '../lib/utils.js';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

const MODES = ['Cash', 'UPI', 'Bank Transfer', 'Other'];

function emptyEntry() {
  return { date: todayISO(), client: '', desc: '', amt: '', mode: 'Cash', to: '', toAmt: '', project: '', notes: '' };
}

function monthLabel(ym) {
  if (ym === 'all') return 'All Months';
  const [y, m] = ym.split('-');
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m, 10) - 1] + ' ' + y;
}

export default function Informal() {
  const { DB, updateDB } = useDB();
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(emptyEntry());

  const entries = DB.informal || [];

  const months = useMemo(() => {
    const set = new Set();
    entries.forEach((f) => f.date && set.add(f.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [entries]);

  const inMonth = (d) => monthFilter === 'all' || (d && d.slice(0, 7) === monthFilter);
  const srcInf = monthFilter === 'all' ? entries : entries.filter((f) => inMonth(f.date));

  const total = srcInf.reduce((s, f) => s + (parseFloat(f.amt) || 0), 0);
  const cashTotal = srcInf.filter((f) => f.mode === 'Cash').reduce((s, f) => s + (parseFloat(f.amt) || 0), 0);
  const onlineTotal = srcInf.filter((f) => f.mode !== 'Cash').reduce((s, f) => s + (parseFloat(f.amt) || 0), 0);
  const passedThrough = srcInf.reduce((s, f) => s + (f.to ? (parseFloat(f.toAmt) || parseFloat(f.amt) || 0) : 0), 0);
  const netKept = total - passedThrough;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => inMonth(f.date))
      .filter(({ f }) => !q || [f.client, f.desc, f.mode, f.to].filter(Boolean).join(' ').toLowerCase().includes(q))
      .reverse();
  }, [entries, search, monthFilter]);

  function openAdd() { setEditIdx(null); setForm(emptyEntry()); setModalOpen(true); }
  function openEdit(i) { setEditIdx(i); setForm({ ...entries[i] }); setModalOpen(true); }

  function remove(i) {
    if (!confirm('Delete this entry?')) return;
    updateDB((prev) => ({ ...prev, informal: prev.informal.filter((_, idx) => idx !== i) }));
  }

  function save() {
    if (!parseFloat(form.amt)) { alert('Amount is required'); return; }
    const record = { ...form, amt: parseFloat(form.amt) || 0, toAmt: form.to ? (parseFloat(form.toAmt) || parseFloat(form.amt) || 0) : '' };
    updateDB((prev) => {
      const informal = [...(prev.informal || [])];
      if (editIdx !== null) informal[editIdx] = record; else informal.push(record);
      return { ...prev, informal };
    });
    setModalOpen(false);
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40 dark:text-white/35">Month:</span>
        <Select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="!w-auto py-1.5 text-[13px]">
          <option value="all">All Months</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Informal" value={`₹${fmt(total)}`} sub={`${srcInf.length} entries`} tone="green" />
        <StatCard label="Cash Received" value={`₹${fmt(cashTotal)}`} sub={`${srcInf.filter((f) => f.mode === 'Cash').length} entries`} />
        <StatCard label="Online / Transfer" value={`₹${fmt(onlineTotal)}`} tone="amber" />
        <StatCard label="Net Kept by Business" value={`₹${fmt(netKept)}`} tone={netKept >= 0 ? 'green' : 'red'} sub={passedThrough > 0 ? `₹${fmt(passedThrough)} passed to vendors` : 'Feeds into Revenue & P&L'} />
      </div>

      <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
        Informal income counts toward Revenue and Net Profit on your Dashboard, Monthly Tracker, and Reports — but is kept out of all GST figures, since it's off-invoice.
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">{filtered.length} Informal Income {filtered.length === 1 ? 'Entry' : 'Entries'}</div>
          <div className="flex items-center gap-2">
            <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-40 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-ink/40 dark:border-white/15 dark:bg-black/20 dark:text-white" />
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Entry</Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <IndianRupee size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No informal income entries yet.<br />Record cash payments, direct transfers &amp; off-invoice income here.</div>
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add First Entry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-ink/40 dark:text-white/40">No entries match your filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Client</th>
                  <th className="px-5 py-2.5 font-medium">Description</th>
                  <th className="px-5 py-2.5 font-medium">Mode</th>
                  <th className="px-5 py-2.5 font-medium">Flow</th>
                  <th className="px-5 py-2.5 font-medium">Project</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ f, i }) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-2.5 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(f.date)}</td>
                    <td className="px-5 py-2.5 font-medium text-ink dark:text-white">{f.client || '—'}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">
                      {f.desc || '—'}
                      {f.notes && <div className="text-xs text-ink/40 dark:text-white/35">{f.notes}</div>}
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${f.mode === 'Cash' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'}`}>{f.mode || 'Cash'}</span>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-ink/60 dark:text-white/55">
                      {f.to ? <span className="inline-flex items-center gap-1"><ArrowRight size={11} /> {f.to}</span> : <span className="text-emerald-600 dark:text-emerald-400">Kept</span>}
                    </td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{f.project || '—'}</td>
                    <td className="px-5 py-2.5 font-medium text-emerald-600 dark:text-emerald-400">₹{fmt(f.amt)}</td>
                    <td className="px-5 py-2.5">
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
        title={editIdx !== null ? 'Edit Informal Income' : 'Add Informal Income'}
        footer={<><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save Entry</Button></>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Amount Received (₹)"><Input type="number" value={form.amt} onChange={(e) => setForm({ ...form, amt: e.target.value })} /></Field>
          <Field label="Client Name"><Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
          <Field label="Payment Mode">
            <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2"><Input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="e.g. Extra hour of coverage, paid direct" /></Field>
          <Field label="Project (optional)">
            <Select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}>
              <option value="">— No project —</option>
              {DB.projects.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
            </Select>
          </Field>
        </div>

        <div className="mt-5 rounded-lg border border-ink/10 bg-[#FAFAF8] p-4 dark:border-white/10 dark:bg-black/20">
          <Field label="Paid directly to a vendor? (optional)">
            <Input value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="Vendor / freelancer name — leave blank if you kept the full amount" />
          </Field>
          {form.to && (
            <div className="mt-3">
              <Field label="Amount Passed to Vendor (₹) — leave blank if the full amount was passed through">
                <Input type="number" value={form.toAmt} onChange={(e) => setForm({ ...form, toAmt: e.target.value })} placeholder={form.amt || '0'} />
              </Field>
              <div className="mt-2 text-xs text-ink/50 dark:text-white/45">
                This will show as revenue of ₹{fmt(form.amt)} and a matching expense of ₹{fmt(form.toAmt || form.amt)} — so your net profit correctly reflects what you actually kept.
              </div>
            </div>
          )}
        </div>

        <Field label="Internal Notes" className="mt-4"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  const toneClass = { default: 'text-ink dark:text-white', green: 'text-emerald-600 dark:text-emerald-400', amber: 'text-brass-600 dark:text-brass-400', red: 'text-rose-600 dark:text-rose-400' }[tone || 'default'];
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/40 dark:text-white/35">{sub}</div>}
    </div>
  );
}
