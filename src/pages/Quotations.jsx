import { useMemo, useState } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, Printer, X as XIcon, Eye } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO, uid, autoQNo, calcT } from '../lib/utils.js';
import { printQuotation } from '../lib/quotationHtml.js';
import QuotationPreview from '../components/QuotationPreview.jsx';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

function emptyItem() {
  return { id: uid(), desc: '', qty: 1, rate: '', tax: 18 };
}

function defaultValidDate() {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().split('T')[0];
}

function emptyQuotation(DB) {
  return {
    no: autoQNo(DB.quotations), date: todayISO(), valid: defaultValidDate(), ref: '',
    cname: '', caddr: '', ccity: '', cmob: '',
    gstType: 'intra', discount: 0,
    items: [emptyItem()],
    notes: 'Prices are inclusive of all applicable taxes. Subject to revision upon scope change.',
    tnc: '1) This quotation is valid for 15 days from date of issue.\n2) 50% advance required to confirm booking.\n3) Subject to local jurisdiction.',
    desc: '', operators: '', deliverables: '', status: 'draft',
  };
}

export default function Quotations() {
  const { DB, updateDB } = useDB();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [tab, setTab] = useState('form');
  const [form, setForm] = useState(() => emptyQuotation(DB));

  const totalValue = DB.quotations.reduce((s, q) => s + (q.total || 0), 0);
  const acceptedCount = DB.quotations.filter((q) => q.status === 'accepted').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DB.quotations
      .map((qt, i) => ({ qt, i }))
      .filter(({ qt }) => statusFilter === 'all' || (qt.status || 'draft') === statusFilter)
      .filter(({ qt }) => !q || [qt.no, qt.cname, qt.ref].filter(Boolean).join(' ').toLowerCase().includes(q))
      .reverse();
  }, [DB.quotations, search, statusFilter]);

  function openAdd() { setEditIdx(null); setForm(emptyQuotation(DB)); setTab('form'); setModalOpen(true); }
  function openEdit(i) { setEditIdx(i); setForm({ ...DB.quotations[i], items: DB.quotations[i].items.map((it) => ({ id: uid(), ...it })) }); setTab('form'); setModalOpen(true); }

  function remove(i) {
    if (!confirm('Delete this quotation?')) return;
    updateDB((prev) => ({ ...prev, quotations: prev.quotations.filter((_, idx) => idx !== i) }));
  }

  function fillFromClient(idx) {
    if (idx === '') return;
    const c = DB.clients[idx];
    const addr = (c.addresses || []).find((a) => a.isDefault) || (c.addresses || [])[0] || {};
    setForm((f) => ({ ...f, cname: c.name || '', caddr: addr.addr || '', ccity: addr.city || '', cmob: c.mobile || '' }));
  }

  function updateItem(id, patch) {
    setForm((f) => ({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }
  function addItemRow() { setForm((f) => ({ ...f, items: [...f.items, emptyItem()] })); }
  function removeItemRow(id) { setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((it) => it.id !== id) : f.items })); }

  const totals = calcT(form.items, form.gstType, parseFloat(form.discount) || 0);

  function buildRecord() {
    const t = calcT(form.items, form.gstType, parseFloat(form.discount) || 0);
    return {
      ...form,
      discount: parseFloat(form.discount) || 0,
      items: form.items.map(({ id, ...it }) => ({ ...it, qty: parseFloat(it.qty) || 0, rate: parseFloat(it.rate) || 0, tax: parseFloat(it.tax) || 0 })),
      subtotal: t.subtotal, totalTax: t.totalTax, cgstAmt: t.cgst, sgstAmt: t.sgst, igstAmt: t.igst, total: t.total,
    };
  }

  function save() {
    if (!form.no.trim()) { alert('Quotation Number required'); return; }
    if (!form.cname.trim()) { alert('Client Name required'); return; }
    const record = buildRecord();
    updateDB((prev) => {
      const quotations = [...prev.quotations];
      if (editIdx !== null) quotations[editIdx] = record; else quotations.push(record);
      return { ...prev, quotations };
    });
    setModalOpen(false);
  }

  function doPrint() { printQuotation(buildRecord(), DB.settings); }
  function printStored(qt) { printQuotation(qt, DB.settings); }

  function setStatus(i, status) {
    updateDB((prev) => {
      const quotations = [...prev.quotations];
      quotations[i] = { ...quotations[i], status };
      return { ...prev, quotations };
    });
  }

  const statusBadgeClass = (st) => ({
    accepted: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    sent: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    rejected: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
    draft: 'bg-ink/5 text-ink/60 dark:bg-white/10 dark:text-white/50',
  }[st || 'draft']);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Quotations" value={DB.quotations.length} />
        <StatCard label="Total Value" value={`₹${fmt(totalValue)}`} />
        <StatCard label="Accepted" value={acceptedCount} tone="green" />
        <StatCard label="Conversion Rate" value={DB.quotations.length ? `${Math.round((acceptedCount / DB.quotations.length) * 100)}%` : '—'} tone="amber" />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">Quotations</div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-auto py-1.5 text-xs">
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </Select>
            <input
              placeholder="Search quotations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-ink/40 dark:border-white/15 dark:bg-black/20 dark:text-white"
            />
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> New Quotation</Button>
          </div>
        </div>

        {DB.quotations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <ClipboardList size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No quotations yet.</div>
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> New Quotation</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-ink/40 dark:text-white/40">No quotations match your filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Quotation</th>
                  <th className="px-5 py-2.5 font-medium">Client</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Valid Until</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ qt, i }) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-3 font-mono text-ink dark:text-white">{qt.no}</td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">{qt.cname}</td>
                    <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(qt.date)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(qt.valid)}</td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">₹{fmt(qt.total)}</td>
                    <td className="px-5 py-3">
                      <Select value={qt.status || 'draft'} onChange={(e) => setStatus(i, e.target.value)} className={`!w-auto !py-0.5 !px-2 text-[11px] font-medium ${statusBadgeClass(qt.status)}`}>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </Select>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" title="Print / PDF" onClick={() => printStored(qt)}><Printer size={14} /></Button>
                        <Button size="sm" variant="ghost" title="Edit" onClick={() => openEdit(i)}><Pencil size={14} /></Button>
                        <Button size="sm" variant="danger" title="Delete" onClick={() => remove(i)}><Trash2 size={14} /></Button>
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
        title={editIdx !== null ? 'Edit Quotation' : 'New Quotation'}
        wide
        footer={<><Button onClick={doPrint}><Printer size={14} /> Print / PDF</Button><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save Quotation</Button></>}
      >
        <div className="mb-4 flex border-b border-ink/10 dark:border-white/10">
          <button onClick={() => setTab('form')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === 'form' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>Form</button>
          <button onClick={() => setTab('preview')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === 'preview' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}><Eye size={13} className="mr-1 inline" />Preview</button>
        </div>

        {tab === 'preview' ? (
          <div className="overflow-x-auto rounded-lg bg-[#e9e9e9] p-4">
            <QuotationPreview data={buildRecord()} settings={DB.settings} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Quotation No."><Input value={form.no} onChange={(e) => setForm({ ...form, no: e.target.value })} /></Field>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Valid Until"><Input type="date" value={form.valid} onChange={(e) => setForm({ ...form, valid: e.target.value })} /></Field>
              <Field label="Subject / Reference" className="sm:col-span-2"><Input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} /></Field>
              <Field label="GST Type">
                <Select value={form.gstType} onChange={(e) => setForm({ ...form, gstType: e.target.value })}>
                  <option value="intra">Intra-state (CGST+SGST)</option>
                  <option value="inter">Inter-state (IGST)</option>
                  <option value="none">No GST</option>
                </Select>
              </Field>
            </div>

            <div className="mt-6 mb-3 border-b border-ink/10 pb-2 font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:border-white/10 dark:text-white/40">Prepared For</div>
            {DB.clients.length > 0 && (
              <Field label="Select Saved Client" className="mb-3">
                <Select defaultValue="" onChange={(e) => fillFromClient(e.target.value)}>
                  <option value="">— Select client (auto-fills) —</option>
                  {DB.clients.map((c, idx) => <option key={idx} value={idx}>{c.name}</option>)}
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Client Name"><Input value={form.cname} onChange={(e) => setForm({ ...form, cname: e.target.value })} /></Field>
              <Field label="Client Mobile"><Input value={form.cmob} onChange={(e) => setForm({ ...form, cmob: e.target.value })} /></Field>
              <Field label="Client Address" className="sm:col-span-2"><Textarea rows={2} value={form.caddr} onChange={(e) => setForm({ ...form, caddr: e.target.value })} /></Field>
              <Field label="City"><Input value={form.ccity} onChange={(e) => setForm({ ...form, ccity: e.target.value })} /></Field>
            </div>

            <div className="mt-6 mb-3 border-b border-ink/10 pb-2 font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:border-white/10 dark:text-white/40">Project Description &amp; Scope (optional)</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Operators / Crew"><Input value={form.operators} onChange={(e) => setForm({ ...form, operators: e.target.value })} /></Field>
              <Field label="Deliverables"><Input value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} /></Field>
              <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></Field>
            </div>

            <div className="mt-6 mb-3 flex items-center justify-between border-b border-ink/10 pb-2 dark:border-white/10">
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:text-white/40">Line Items</div>
              <Button size="sm" onClick={addItemRow}><Plus size={13} /> Add Item</Button>
            </div>
            <div className="flex flex-col gap-2">
              {form.items.map((it) => (
                <div key={it.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_70px_100px_70px_100px_30px] sm:items-center">
                  <Input placeholder="Photography — Full Day Coverage" value={it.desc} onChange={(e) => updateItem(it.id, { desc: e.target.value })} className="col-span-2 sm:col-span-1" />
                  <Input type="number" value={it.qty} onChange={(e) => updateItem(it.id, { qty: e.target.value })} />
                  <Input type="number" placeholder="12000" value={it.rate} onChange={(e) => updateItem(it.id, { rate: e.target.value })} />
                  <Input type="number" value={it.tax} onChange={(e) => updateItem(it.id, { tax: e.target.value })} disabled={form.gstType === 'none'} />
                  <Input readOnly disabled value={fmt((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0))} />
                  <button onClick={() => removeItemRow(it.id)} className="justify-self-end rounded-md p-1.5 text-ink/35 hover:bg-rose-50 hover:text-rose-500 dark:text-white/35 dark:hover:bg-rose-500/10"><XIcon size={14} /></button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-xs rounded-lg border border-ink/10 bg-[#FAFAF8] p-4 text-[13px] dark:border-white/10 dark:bg-black/20">
                <Field label="Discount (₹)" className="mb-2"><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></Field>
                <div className="flex justify-between py-0.5 text-ink/70 dark:text-white/70"><span>Subtotal</span><span>₹{fmt(totals.subtotal)}</span></div>
                {form.gstType === 'intra' && <>
                  <div className="flex justify-between py-0.5 text-ink/70 dark:text-white/70"><span>CGST</span><span>₹{fmt(totals.cgst)}</span></div>
                  <div className="flex justify-between py-0.5 text-ink/70 dark:text-white/70"><span>SGST</span><span>₹{fmt(totals.sgst)}</span></div>
                </>}
                {form.gstType === 'inter' && <div className="flex justify-between py-0.5 text-ink/70 dark:text-white/70"><span>IGST</span><span>₹{fmt(totals.igst)}</span></div>}
                <div className="mt-1.5 flex justify-between border-t border-ink/10 pt-1.5 font-serif text-lg text-ink dark:border-white/10 dark:text-white"><span>Total Estimate</span><span>₹{fmt(totals.total)}</span></div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <Field label="Terms & Conditions"><Textarea rows={2} value={form.tnc} onChange={(e) => setForm({ ...form, tnc: e.target.value })} /></Field>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClass = { default: 'text-ink dark:text-white', green: 'text-emerald-600 dark:text-emerald-400', amber: 'text-brass-600 dark:text-brass-400' }[tone || 'default'];
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
    </div>
  );
}
