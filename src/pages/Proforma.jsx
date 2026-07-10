import { useMemo, useState } from 'react';
import { FileText, Plus, Pencil, Trash2, Printer, X as XIcon, Eye } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO, uid, autoPFNo, calcT } from '../lib/utils.js';
import { printProforma } from '../lib/proformaHtml.js';
import ProformaPreview from '../components/ProformaPreview.jsx';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

function emptyItem() {
  return { id: uid(), desc: '', qty: 1, rate: '', tax: 18 };
}

function emptyProforma(DB) {
  return {
    no: autoPFNo(DB.proforma), date: todayISO(), po: '', pos: '',
    clientType: 'gst', cname: '', caddr: '', ccity: '', cpan: '', cgst: '', cmob: '', cstate: '',
    advance: 0, gstType: 'intra',
    items: [emptyItem()],
    notes: 'Thank you for trusting us with your business',
    tnc: '1) This is a Proforma Invoice and is not a demand for payment.\n2) Final Tax Invoice will be raised upon confirmation.\n3) 50% advance required to confirm booking.\n4) Subject to local jurisdiction.',
    projectLabel: '',
  };
}

export default function Proforma() {
  const { DB, updateDB } = useDB();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [tab, setTab] = useState('form');
  const [form, setForm] = useState(() => emptyProforma(DB));

  const totalValue = DB.proforma.reduce((s, p) => s + (p.total || 0), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DB.proforma
      .map((pf, i) => ({ pf, i }))
      .filter(({ pf }) => !q || [pf.no, pf.cname, pf.po].filter(Boolean).join(' ').toLowerCase().includes(q))
      .reverse();
  }, [DB.proforma, search]);

  function openAdd() { setEditIdx(null); setForm(emptyProforma(DB)); setTab('form'); setModalOpen(true); }
  function openEdit(i) { setEditIdx(i); setForm({ ...DB.proforma[i], items: DB.proforma[i].items.map((it) => ({ id: uid(), ...it })) }); setTab('form'); setModalOpen(true); }

  function remove(i) {
    if (!confirm('Delete this proforma invoice?')) return;
    updateDB((prev) => ({ ...prev, proforma: prev.proforma.filter((_, idx) => idx !== i) }));
  }

  function fillFromClient(idx) {
    if (idx === '') return;
    const c = DB.clients[idx];
    const addr = (c.addresses || []).find((a) => a.isDefault) || (c.addresses || [])[0] || {};
    setForm((f) => ({
      ...f,
      cname: c.name || '', caddr: addr.addr || '', ccity: addr.city || '',
      cpan: c.pan || '', cgst: addr.gst || '', cmob: c.mobile || '', cstate: addr.state || '',
      clientType: c.type || 'gst',
      gstType: c.type === 'nogst' ? 'none' : f.gstType,
      _clientAddresses: c.addresses || [],
    }));
  }

  function selectAddress(addrId) {
    const addr = (form._clientAddresses || []).find((a) => a.id === addrId);
    if (!addr) return;
    setForm((f) => ({ ...f, caddr: addr.addr, ccity: addr.city, cstate: addr.state, cgst: addr.gst }));
  }

  function updateItem(id, patch) {
    setForm((f) => ({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }
  function addItemRow() { setForm((f) => ({ ...f, items: [...f.items, emptyItem()] })); }
  function removeItemRow(id) { setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((it) => it.id !== id) : f.items })); }

  const totals = calcT(form.items, form.gstType, parseFloat(form.advance) || 0);

  function buildRecord() {
    const t = calcT(form.items, form.gstType, parseFloat(form.advance) || 0);
    const { _clientAddresses, ...rest } = form;
    return {
      ...rest,
      advance: parseFloat(form.advance) || 0,
      items: form.items.map(({ id, ...it }) => ({ ...it, qty: parseFloat(it.qty) || 0, rate: parseFloat(it.rate) || 0, tax: parseFloat(it.tax) || 0 })),
      subtotal: t.subtotal, totalTax: t.totalTax, cgstAmt: t.cgst, sgstAmt: t.sgst, igstAmt: t.igst, total: t.total,
    };
  }

  function save() {
    if (!form.no.trim()) { alert('Proforma Number required'); return; }
    if (!form.cname.trim()) { alert('Client Name required'); return; }
    const record = buildRecord();
    updateDB((prev) => {
      const proforma = [...prev.proforma];
      if (editIdx !== null) proforma[editIdx] = record; else proforma.push(record);
      return { ...prev, proforma };
    });
    setModalOpen(false);
  }

  function doPrint() { printProforma(buildRecord(), DB.settings); }
  function printStored(pf) { printProforma(pf, DB.settings); }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Total Proforma Invoices" value={DB.proforma.length} />
        <StatCard label="Total Value" value={`₹${fmt(totalValue)}`} />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">Proforma Invoices</div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-ink/40 dark:border-white/15 dark:bg-black/20 dark:text-white"
            />
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> New Proforma</Button>
          </div>
        </div>

        {DB.proforma.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <FileText size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No proforma invoices yet.</div>
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> New Proforma</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-ink/40 dark:text-white/40">No results for "{search}"</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Proforma</th>
                  <th className="px-5 py-2.5 font-medium">Client</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ pf, i }) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-3 font-mono text-ink dark:text-white">{pf.no}</td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">{pf.cname}</td>
                    <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(pf.date)}</td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">₹{fmt(pf.total)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" title="Print / PDF" onClick={() => printStored(pf)}><Printer size={14} /></Button>
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
        title={editIdx !== null ? 'Edit Proforma Invoice' : 'New Proforma Invoice'}
        wide
        footer={<><Button onClick={doPrint}><Printer size={14} /> Print / PDF</Button><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}
      >
        <div className="mb-4 flex border-b border-ink/10 dark:border-white/10">
          <button onClick={() => setTab('form')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === 'form' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>Form</button>
          <button onClick={() => setTab('preview')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === 'preview' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}><Eye size={13} className="mr-1 inline" />Preview</button>
        </div>

        {tab === 'preview' ? (
          <div className="overflow-x-auto rounded-lg bg-[#e9e9e9] p-4">
            <ProformaPreview data={buildRecord()} settings={DB.settings} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Proforma No."><Input value={form.no} onChange={(e) => setForm({ ...form, no: e.target.value })} /></Field>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Purchase Order No."><Input value={form.po} onChange={(e) => setForm({ ...form, po: e.target.value })} /></Field>
              <Field label="Place of Supply"><Input value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })} /></Field>
              <Field label="GST Type">
                <Select value={form.gstType} onChange={(e) => setForm({ ...form, gstType: e.target.value })}>
                  <option value="intra">Intra-state (CGST+SGST)</option>
                  <option value="inter">Inter-state (IGST)</option>
                  <option value="none">No GST</option>
                </Select>
              </Field>
              <Field label="Advance / Discount (₹)"><Input type="number" value={form.advance} onChange={(e) => setForm({ ...form, advance: e.target.value })} /></Field>
            </div>

            <div className="mt-6 mb-3 border-b border-ink/10 pb-2 font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:border-white/10 dark:text-white/40">Client Details</div>
            {DB.clients.length > 0 && (
              <Field label="Select Saved Client" className="mb-3">
                <Select defaultValue="" onChange={(e) => fillFromClient(e.target.value)}>
                  <option value="">— Select client (auto-fills) —</option>
                  {DB.clients.map((c, idx) => <option key={idx} value={idx}>{c.name}</option>)}
                </Select>
              </Field>
            )}
            {form._clientAddresses && form._clientAddresses.length > 1 && (
              <Field label="Billing Office / Address" className="mb-3">
                <Select onChange={(e) => selectAddress(e.target.value)}>
                  {form._clientAddresses.map((a) => <option key={a.id} value={a.id}>{a.label || a.city}{a.isDefault ? ' (default)' : ''}</option>)}
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Client Name"><Input value={form.cname} onChange={(e) => setForm({ ...form, cname: e.target.value })} /></Field>
              <Field label="Client Mobile"><Input value={form.cmob} onChange={(e) => setForm({ ...form, cmob: e.target.value })} /></Field>
              <Field label="Client Address" className="sm:col-span-2"><Textarea rows={2} value={form.caddr} onChange={(e) => setForm({ ...form, caddr: e.target.value })} /></Field>
              <Field label="City"><Input value={form.ccity} onChange={(e) => setForm({ ...form, ccity: e.target.value })} /></Field>
              <Field label="State"><Input value={form.cstate} onChange={(e) => setForm({ ...form, cstate: e.target.value })} /></Field>
              <Field label="PAN"><Input value={form.cpan} onChange={(e) => setForm({ ...form, cpan: e.target.value.toUpperCase() })} /></Field>
              <Field label="GSTIN"><Input value={form.cgst} onChange={(e) => setForm({ ...form, cgst: e.target.value.toUpperCase() })} /></Field>
            </div>

            <div className="mt-6 mb-3 flex items-center justify-between border-b border-ink/10 pb-2 dark:border-white/10">
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:text-white/40">Line Items</div>
              <Button size="sm" onClick={addItemRow}><Plus size={13} /> Add Item</Button>
            </div>
            <div className="flex flex-col gap-2">
              {form.items.map((it) => (
                <div key={it.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_70px_100px_70px_100px_30px] sm:items-center">
                  <Input placeholder="Media Expo Event Coverage" value={it.desc} onChange={(e) => updateItem(it.id, { desc: e.target.value })} className="col-span-2 sm:col-span-1" />
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
                <div className="flex justify-between py-0.5 text-ink/70 dark:text-white/70"><span>Subtotal</span><span>₹{fmt(totals.subtotal)}</span></div>
                {form.gstType === 'intra' && <>
                  <div className="flex justify-between py-0.5 text-ink/70 dark:text-white/70"><span>CGST</span><span>₹{fmt(totals.cgst)}</span></div>
                  <div className="flex justify-between py-0.5 text-ink/70 dark:text-white/70"><span>SGST</span><span>₹{fmt(totals.sgst)}</span></div>
                </>}
                {form.gstType === 'inter' && <div className="flex justify-between py-0.5 text-ink/70 dark:text-white/70"><span>IGST</span><span>₹{fmt(totals.igst)}</span></div>}
                {parseFloat(form.advance) > 0 && <div className="flex justify-between py-0.5 text-ink/70 dark:text-white/70"><span>Advance / Discount</span><span>− ₹{fmt(form.advance)}</span></div>}
                <div className="mt-1.5 flex justify-between border-t border-ink/10 pt-1.5 font-serif text-lg text-ink dark:border-white/10 dark:text-white"><span>Total</span><span>₹{fmt(totals.total)}</span></div>
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

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className="mt-1.5 font-serif text-2xl text-ink dark:text-white">{value}</div>
    </div>
  );
}
