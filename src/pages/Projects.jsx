import { useMemo, useState } from 'react';
import { Clapperboard, Plus, Pencil, Trash2, X as XIcon, TrendingUp, TrendingDown, LayoutList, BarChart3, Link2 } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO, uid, netReceivable } from '../lib/utils.js';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

function emptyDeliverable() {
  return { id: uid(), title: '', assignedVendor: '', assignedVendorManual: '', vendorPayStatus: 'pending', baseCost: '', additionalCost: '', status: 'not_started', deadline: '', edits: '', notes: '' };
}
function emptyLink() { return { id: uid(), label: '', url: '' }; }

function emptyProject() {
  return {
    name: '', clientName: '', date: todayISO(), loc: '', val: '', status: 'Active', notes: '',
    deliverables: [], finalLinks: [],
  };
}

const DELIVERABLE_STATUS = { not_started: 'Not Started', in_progress: 'In Progress', partial: 'Partially Done', completed: 'Completed' };
const PAY_STATUS = { pending: 'Pending', partial: 'Partially Paid', paid: 'Fully Paid', included: 'Included in Cost' };

export default function Projects() {
  const { DB, updateDB } = useDB();
  const [view, setView] = useState('manage'); // manage | pl
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(emptyProject());

  const [plMode, setPlMode] = useState('actual'); // actual | expected
  const [plFilter, setPlFilter] = useState('all');

  const activeCount = DB.projects.filter((p) => p.status === 'Active').length;
  const completedCount = DB.projects.filter((p) => p.status === 'Completed').length;
  const totalValue = DB.projects.reduce((s, p) => s + (parseFloat(p.val) || 0), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DB.projects.map((p, i) => ({ p, i })).filter(({ p }) => !q || [p.name, p.clientName, p.loc].filter(Boolean).join(' ').toLowerCase().includes(q)).reverse();
  }, [DB.projects, search]);

  function openAdd() { setEditIdx(null); setForm(emptyProject()); setModalOpen(true); }
  function openEdit(i) { setEditIdx(i); setForm({ ...DB.projects[i], deliverables: (DB.projects[i].deliverables || []).map((d) => ({ ...d })), finalLinks: (DB.projects[i].finalLinks || []).map((l) => ({ ...l })) }); setModalOpen(true); }

  function remove(i) {
    if (!confirm('Delete this project? Linked invoices/expenses will keep their data but lose the project link.')) return;
    updateDB((prev) => ({ ...prev, projects: prev.projects.filter((_, idx) => idx !== i) }));
  }

  function save() {
    if (!form.name.trim()) { alert('Project name is required'); return; }
    updateDB((prev) => {
      const projects = [...prev.projects];
      if (editIdx !== null) projects[editIdx] = form; else projects.push(form);
      return { ...prev, projects };
    });
    setModalOpen(false);
  }

  function fillFromClient(idx) {
    if (idx === '') return;
    setForm((f) => ({ ...f, clientName: DB.clients[idx].name }));
  }

  function updateDeliverable(id, patch) {
    setForm((f) => ({ ...f, deliverables: f.deliverables.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  }
  function addDeliverable() { setForm((f) => ({ ...f, deliverables: [...f.deliverables, emptyDeliverable()] })); }
  function removeDeliverable(id) { setForm((f) => ({ ...f, deliverables: f.deliverables.filter((d) => d.id !== id) })); }

  function updateLink(id, patch) {
    setForm((f) => ({ ...f, finalLinks: f.finalLinks.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }
  function addLink() { setForm((f) => ({ ...f, finalLinks: [...f.finalLinks, emptyLink()] })); }
  function removeLink(id) { setForm((f) => ({ ...f, finalLinks: f.finalLinks.filter((l) => l.id !== id) })); }

  // ── P&L computation ──────────────────────────────────────────────
  const plRows = useMemo(() => DB.projects.map((p) => {
    const projInvs = DB.invoices.filter((i) => i.projectLabel === p.name);
    const projInf = (DB.informal || []).filter((f) => f.project === p.name);
    const informalRevenue = projInf.reduce((s, f) => s + (parseFloat(f.amt) || 0), 0);
    const informalPassThrough = projInf.reduce((s, f) => s + (f.to ? (parseFloat(f.toAmt) || parseFloat(f.amt) || 0) : 0), 0);

    const revenue = projInvs.reduce((s, i) => s + (parseFloat(i.total) || 0), 0) + informalRevenue;
    const received = projInvs.filter((i) => i.status === 'paid').reduce((s, i) => s + netReceivable(i), 0)
      + projInvs.filter((i) => i.status === 'partial').reduce((s, i) => s + (parseFloat(i.payAmt) || 0), 0) + informalRevenue;
    const outstanding = revenue - received;

    const projExps = DB.expenses.filter((e) => e.projectLabel === p.name);
    const expTotal = projExps.reduce((s, e) => s + (parseFloat(e.amt) || 0), 0) + informalPassThrough;

    const projPetty = (DB.petty || []).filter((e) => e.projectLabel === p.name);
    const pettyTotal = projPetty.reduce((s, e) => s + (parseFloat(e.amt) || 0), 0);

    const totalCost = expTotal + pettyTotal;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
    const projVal = parseFloat(p.val || 0);
    const expectedProfit = projVal - totalCost;
    const expectedMargin = projVal > 0 ? Math.round((expectedProfit / projVal) * 100) : 0;

    return { p, projInvs, projExps, revenue, received, outstanding, expTotal, pettyTotal, totalCost, profit, margin, projVal, expectedProfit, expectedMargin };
  }), [DB.projects, DB.invoices, DB.expenses, DB.petty, DB.informal]);


  const filtRows = plFilter === 'all' ? plRows : plRows.filter((r) => r.p.name === plFilter);
  const totalRev = filtRows.reduce((s, r) => s + r.revenue, 0);
  const totalRec = filtRows.reduce((s, r) => s + r.received, 0);
  const totalOut = filtRows.reduce((s, r) => s + r.outstanding, 0);
  const totalCostAll = filtRows.reduce((s, r) => s + r.totalCost, 0);
  const modeProfit = (r) => (plMode === 'expected' ? r.expectedProfit : r.profit);
  const totalModeProfit = filtRows.reduce((s, r) => s + modeProfit(r), 0);
  const totalProjVal = filtRows.reduce((s, r) => s + r.projVal, 0);

  const statusBadgeClass = (st) => ({
    Active: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    Completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    'On Hold': 'bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-400',
  }[st] || 'bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-white/50');

  return (
    <div>
      <div className="mb-5 flex border-b border-ink/10 dark:border-white/10">
        <button onClick={() => setView('manage')} className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${view === 'manage' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>
          <LayoutList size={14} /> Manage Projects
        </button>
        <button onClick={() => setView('pl')} className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${view === 'pl' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>
          <BarChart3 size={14} /> P&amp;L Report
        </button>
      </div>

      {view === 'manage' ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total Projects" value={DB.projects.length} />
            <StatCard label="Active" value={activeCount} tone="blue" />
            <StatCard label="Completed" value={completedCount} tone="green" />
            <StatCard label="Total Quoted Value" value={`₹${fmt(totalValue)}`} />
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
              <div className="text-[13px] font-semibold text-ink dark:text-white">Projects</div>
              <div className="flex items-center gap-2">
                <input placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-44 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-ink/40 dark:border-white/15 dark:bg-black/20 dark:text-white" />
                <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Project</Button>
              </div>
            </div>

            {DB.projects.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <Clapperboard size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
                <div className="text-[13px] text-ink/45 dark:text-white/45">No projects yet.</div>
                <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Project</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                      <th className="px-5 py-2.5 font-medium">Project</th>
                      <th className="px-5 py-2.5 font-medium">Client</th>
                      <th className="px-5 py-2.5 font-medium">Date</th>
                      <th className="px-5 py-2.5 font-medium">Location</th>
                      <th className="px-5 py-2.5 font-medium">Value</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ p, i }) => (
                      <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                        <td className="px-5 py-3 font-medium text-ink dark:text-white">{p.name}</td>
                        <td className="px-5 py-3 text-ink/70 dark:text-white/70">{p.clientName || '—'}</td>
                        <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(p.date)}</td>
                        <td className="px-5 py-3 text-ink/70 dark:text-white/70">{p.loc || '—'}</td>
                        <td className="px-5 py-3 text-ink/70 dark:text-white/70">₹{fmt(p.val)}</td>
                        <td className="px-5 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(p.status)}`}>{p.status}</span></td>
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
        </>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-ink/5 p-1 dark:bg-white/5">
              <button onClick={() => setPlMode('actual')} className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${plMode === 'actual' ? 'bg-white text-ink shadow-sm dark:bg-noir-soft dark:text-white' : 'text-ink/50 dark:text-white/45'}`}>💰 Actual P&amp;L</button>
              <button onClick={() => setPlMode('expected')} className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${plMode === 'expected' ? 'bg-white text-ink shadow-sm dark:bg-noir-soft dark:text-white' : 'text-ink/50 dark:text-white/45'}`}>📋 Expected P&amp;L</button>
            </div>
            <div className="rounded-lg border border-ink/10 bg-white px-3 py-1.5 text-[11px] text-ink/50 dark:border-white/10 dark:bg-noir-soft dark:text-white/45">
              {plMode === 'expected' ? 'Quoted project value − total costs = estimated profit' : 'Total invoiced revenue − total costs = actual P&L'}
            </div>
            <Select value={plFilter} onChange={(e) => setPlFilter(e.target.value)} className="!w-auto ml-auto py-1.5 text-xs">
              <option value="all">All Projects</option>
              {DB.projects.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Total Invoiced" value={`₹${fmt(totalRev)}`} sub={`${filtRows.length} projects`} />
            <StatCard label="Cash Received" value={`₹${fmt(totalRec)}`} tone="green" />
            <StatCard label="Outstanding" value={`₹${fmt(totalOut)}`} tone="amber" />
            <StatCard label="Total Costs" value={`₹${fmt(totalCostAll)}`} tone="red" />
            <StatCard
              label={plMode === 'expected' ? 'Expected Profit' : 'Actual P&L'}
              value={`₹${fmt(Math.abs(totalModeProfit))}`}
              tone={totalModeProfit >= 0 ? 'green' : 'red'}
              sub={plMode === 'expected' ? `of ₹${fmt(totalProjVal)} quoted` : ''}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {filtRows.length === 0 ? (
              <div className="rounded-xl border border-ink/10 bg-white p-10 text-center text-[13px] text-ink/40 shadow-card dark:border-white/10 dark:bg-noir-soft dark:text-white/40">
                No projects found. Create projects and link invoices/expenses to them via the "Project" field on each.
              </div>
            ) : filtRows.map((r, idx) => {
              const profit = modeProfit(r);
              const isPositive = profit >= 0;
              return (
                <div key={idx} className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
                    <div>
                      <div className="font-medium text-ink dark:text-white">{r.p.name}</div>
                      <div className="text-xs text-ink/40 dark:text-white/35">{r.p.clientName}{r.p.loc ? ' · ' + r.p.loc : ''}</div>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${isPositive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                      {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />} ₹{fmt(Math.abs(profit))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                    <MiniStat label="Revenue" value={`₹${fmt(r.revenue)}`} />
                    <MiniStat label="Received" value={`₹${fmt(r.received)}`} />
                    <MiniStat label="Costs" value={`₹${fmt(r.totalCost)}`} />
                    <MiniStat label={plMode === 'expected' ? 'Margin (on quote)' : 'Margin'} value={`${plMode === 'expected' ? r.expectedMargin : r.margin}%`} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Project */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editIdx !== null ? 'Edit Project' : 'Add Project'}
        wide
        footer={<><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save Project</Button></>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Project Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Brand X — Product Launch Shoot" /></Field>
          {DB.clients.length > 0 ? (
            <Field label="Client">
              <Select value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })}>
                <option value="">— Select or type below —</option>
                {DB.clients.map((c, idx) => <option key={idx} value={c.name}>{c.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field label="Client"><Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></Field>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Shoot Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Shoot Location"><Input value={form.loc} onChange={(e) => setForm({ ...form, loc: e.target.value })} placeholder="NESCO, Mumbai" /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Project Value (₹)"><Input type="number" value={form.val} onChange={(e) => setForm({ ...form, val: e.target.value })} placeholder="12000" /></Field>
          <Field label="Internal Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>

        <div className="mt-6 mb-2 flex items-center justify-between border-b border-ink/10 pb-2 dark:border-white/10">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:text-white/40">Deliverables</div>
          <Button size="sm" onClick={addDeliverable}><Plus size={13} /> Add Deliverable</Button>
        </div>
        <div className="mb-1 text-xs text-ink/40 dark:text-white/35">Add each deliverable separately — assign a vendor, set a deadline, and track its status.</div>

        <div className="flex flex-col gap-3">
          {form.deliverables.map((d) => {
            const total = (parseFloat(d.baseCost) || 0) + (parseFloat(d.additionalCost) || 0);
            return (
              <div key={d.id} className="rounded-lg border border-ink/10 bg-[#FAFAF8] p-4 dark:border-white/10 dark:bg-black/20">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Input value={d.title} onChange={(e) => updateDeliverable(d.id, { title: e.target.value })} placeholder="e.g. Highlight Reel, Full Photo Set" className="max-w-sm font-medium" />
                  <button onClick={() => removeDeliverable(d.id)} className="rounded-md p-1.5 text-ink/35 hover:bg-rose-50 hover:text-rose-500 dark:text-white/35 dark:hover:bg-rose-500/10"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Assign to Vendor">
                    <Select value={d.assignedVendor} onChange={(e) => updateDeliverable(d.id, { assignedVendor: e.target.value, assignedVendorManual: '' })}>
                      <option value="">— None / manual below —</option>
                      {DB.vendors.map((v, idx) => <option key={idx} value={v.biz || v.name}>{v.biz || v.name}</option>)}
                    </Select>
                    {!d.assignedVendor && (
                      <Input className="mt-1.5" placeholder="Vendor name (not in system)" value={d.assignedVendorManual} onChange={(e) => updateDeliverable(d.id, { assignedVendorManual: e.target.value })} />
                    )}
                  </Field>
                  <Field label="Vendor Payment Status">
                    <Select value={d.vendorPayStatus} onChange={(e) => updateDeliverable(d.id, { vendorPayStatus: e.target.value })}>
                      {Object.entries(PAY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Base Cost (₹)"><Input type="number" value={d.baseCost} onChange={(e) => updateDeliverable(d.id, { baseCost: e.target.value })} /></Field>
                  <Field label="Additional Cost (₹)"><Input type="number" value={d.additionalCost} onChange={(e) => updateDeliverable(d.id, { additionalCost: e.target.value })} /></Field>
                  <Field label="Total to Vendor (₹)"><Input readOnly disabled value={fmt(total)} /></Field>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Status">
                    <Select value={d.status} onChange={(e) => updateDeliverable(d.id, { status: e.target.value })}>
                      {Object.entries(DELIVERABLE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                  </Field>
                  <Field label="Deadline"><Input type="date" value={d.deadline} onChange={(e) => updateDeliverable(d.id, { deadline: e.target.value })} /></Field>
                  <Field label="Edits Allowed"><Input type="number" value={d.edits} onChange={(e) => updateDeliverable(d.id, { edits: e.target.value })} placeholder="2" /></Field>
                </div>
                <Field label="Notes" className="mt-3"><Input value={d.notes} onChange={(e) => updateDeliverable(d.id, { notes: e.target.value })} placeholder="Instructions…" /></Field>
              </div>
            );
          })}
        </div>

        <div className="mt-6 mb-2 flex items-center justify-between border-b border-ink/10 pb-2 dark:border-white/10">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:text-white/40">Final Files / Links</div>
          <Button size="sm" onClick={addLink}><Plus size={13} /> Add Link</Button>
        </div>
        {form.finalLinks.length === 0 ? (
          <div className="text-xs italic text-ink/40 dark:text-white/35">No final file links added yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {form.finalLinks.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <Input placeholder="Label (e.g. Final Reel — Google Drive)" value={l.label} onChange={(e) => updateLink(l.id, { label: e.target.value })} className="flex-1" />
                <Input placeholder="https://drive.google.com/…" value={l.url} onChange={(e) => updateLink(l.id, { url: e.target.value })} className="flex-[2]" />
                <button onClick={() => removeLink(l.id)} className="rounded-md p-1.5 text-ink/35 hover:bg-rose-50 hover:text-rose-500 dark:text-white/35 dark:hover:bg-rose-500/10"><XIcon size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  const toneClass = { default: 'text-ink dark:text-white', green: 'text-emerald-600 dark:text-emerald-400', amber: 'text-brass-600 dark:text-brass-400', red: 'text-rose-600 dark:text-rose-400', blue: 'text-blue-600 dark:text-blue-400' }[tone || 'default'];
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/40 dark:text-white/35">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink/40 dark:text-white/35">{label}</div>
      <div className="mt-1 text-[15px] font-medium text-ink dark:text-white">{value}</div>
    </div>
  );
}
