import { useMemo, useState } from 'react';
import { Receipt, Plus, Pencil, Trash2, Printer, CreditCard, X as XIcon, Eye, FileText } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO, uid, autoInvNo, calcT, netReceivable } from '../lib/utils.js';
import { printInvoice } from '../lib/invoiceHtml.js';
import { printClientStatement } from '../lib/clientStatement.js';
import InvoicePreview from '../components/InvoicePreview.jsx';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

function emptyItem() {
  return { id: uid(), desc: '', qty: 1, rate: '', tax: 18 };
}

function emptyInvoice(DB) {
  return {
    no: autoInvNo(DB.invoices), date: todayISO(), po: '', pos: '',
    clientType: 'gst', cname: '', caddr: '', ccity: '', cpan: '', cgst: '', cmob: '', cstate: '',
    advance: 0, gstType: 'intra',
    items: [emptyItem()],
    notes: DB.settings.defaultNotes || '', tnc: DB.settings.defaultTnC || '',
    projectLabel: '', status: 'unpaid',
    payAmt: 0, balDue: 0, payDate: todayISO(), payMode: 'UPI', payNote: '',
    tdsApplicable: false, tdsRate: 10, tdsAmount: 0, dueDays: 15,
  };
}

const PAY_MODES = ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Card'];

export default function Invoices() {
  const { DB, updateDB } = useDB();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [view, setView] = useState('list'); // list | statements
  const [statementClientIdx, setStatementClientIdx] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [tab, setTab] = useState('form');
  const [form, setForm] = useState(() => emptyInvoice(DB));

  const [payModal, setPayModal] = useState(null); // { idx, status, amt, date, mode, note }

  const months = useMemo(() => {
    const set = new Set();
    DB.invoices.forEach((i) => i.date && set.add(i.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [DB.invoices]);

  const monthLabel = (ym) => {
    if (ym === 'all') return 'All Time';
    const [y, m] = ym.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[parseInt(m, 10) - 1] + ' ' + y;
  };

  const inScopeInvoices = useMemo(() => {
    if (monthFilter === 'all') return DB.invoices;
    return DB.invoices.filter((i) => i.date && i.date.slice(0, 7) === monthFilter);
  }, [DB.invoices, monthFilter]);

  const totalRevenue = inScopeInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalReceived = inScopeInvoices.reduce((s, i) => s + (i.status === 'paid' ? netReceivable(i) : i.status === 'partial' ? (i.payAmt || 0) : 0), 0);
  const totalOutstanding = totalRevenue - totalReceived;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DB.invoices
      .map((inv, i) => ({ inv, i }))
      .filter(({ inv }) => statusFilter === 'all' || inv.status === statusFilter)
      .filter(({ inv }) => monthFilter === 'all' || (inv.date && inv.date.slice(0, 7) === monthFilter))
      .filter(({ inv }) => !q || [inv.no, inv.cname, inv.po].filter(Boolean).join(' ').toLowerCase().includes(q))
      .reverse();
  }, [DB.invoices, search, statusFilter, monthFilter]);

  function openAdd() { setEditIdx(null); setForm(emptyInvoice(DB)); setTab('form'); setModalOpen(true); }
  function openEdit(i) { setEditIdx(i); setForm({ ...DB.invoices[i], items: DB.invoices[i].items.map((it) => ({ id: uid(), ...it })) }); setTab('form'); setModalOpen(true); }

  function remove(i) {
    if (!confirm('Delete this invoice?')) return;
    updateDB((prev) => ({ ...prev, invoices: prev.invoices.filter((_, idx) => idx !== i) }));
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
      dueDays: parseInt(form.dueDays, 10) || 0,
      tdsRate: parseFloat(form.tdsRate) || 0,
      tdsAmount: form.tdsApplicable ? (parseFloat(form.tdsAmount) || 0) : 0,
      items: form.items.map(({ id, ...it }) => ({ ...it, qty: parseFloat(it.qty) || 0, rate: parseFloat(it.rate) || 0, tax: parseFloat(it.tax) || 0 })),
      subtotal: t.subtotal, totalTax: t.totalTax, cgstAmt: t.cgst, sgstAmt: t.sgst, igstAmt: t.igst, total: t.total,
    };
  }

  function save() {
    if (!form.no.trim()) { alert('Invoice Number required'); return; }
    if (!form.cname.trim()) { alert('Client Name required'); return; }
    const record = buildRecord();
    updateDB((prev) => {
      const invoices = [...prev.invoices];
      if (editIdx !== null) invoices[editIdx] = record; else invoices.push(record);
      return { ...prev, invoices };
    });
    setModalOpen(false);
  }

  function doPrint() {
    printInvoice(buildRecord(), DB.settings);
  }

  function printStored(inv) {
    printInvoice(inv, DB.settings);
  }

  function openPayment(i) {
    const inv = DB.invoices[i];
    setPayModal({ idx: i, status: inv.status || 'unpaid', amt: inv.payAmt || '', date: inv.payDate || todayISO(), mode: inv.payMode || 'UPI', note: inv.payNote || '' });
  }

  function savePayment() {
    const inv = DB.invoices[payModal.idx];
    const paidAmt = payModal.status === 'paid' ? netReceivable(inv) : (parseFloat(payModal.amt) || 0);
    const balDue = payModal.status === 'paid' ? 0 : Math.max(0, netReceivable(inv) - paidAmt);
    updateDB((prev) => {
      const invoices = [...prev.invoices];
      invoices[payModal.idx] = { ...inv, status: payModal.status, payAmt: paidAmt, balDue, payDate: payModal.date, payMode: payModal.mode, payNote: payModal.note };
      return { ...prev, invoices };
    });
    setPayModal(null);
  }

  const statusBadgeClass = (st) => ({
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    partial: 'bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-400',
    unpaid: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  }[st]);

  return (
    <div>
      <div className="mb-5 flex border-b border-ink/10 dark:border-white/10">
        <button onClick={() => setView('list')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${view === 'list' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>Invoices</button>
        <button onClick={() => setView('statements')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${view === 'statements' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>Client Statements</button>
      </div>

      {view === 'statements' ? (
        <ClientStatementsView DB={DB} statementClientIdx={statementClientIdx} setStatementClientIdx={setStatementClientIdx} />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={monthFilter === 'all' ? 'Total Invoiced' : 'Invoiced — ' + monthLabel(monthFilter)} value={`₹${fmt(totalRevenue)}`} sub={`${inScopeInvoices.length} invoices`} />
        <StatCard label="Received" value={`₹${fmt(totalReceived)}`} tone="green" />
        <StatCard label="Outstanding" value={`₹${fmt(totalOutstanding)}`} tone="amber" />
        <StatCard label="Avg. Invoice Value" value={`₹${fmt(inScopeInvoices.length ? totalRevenue / inScopeInvoices.length : 0)}`} sub={monthFilter === 'all' ? 'across all time' : monthLabel(monthFilter)} />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">Invoices</div>
          <div className="flex items-center gap-2">
            <Select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="!w-auto py-1.5 text-xs">
              <option value="all">All Time</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-auto py-1.5 text-xs">
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </Select>
            <input
              placeholder="Search invoices…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-ink/40 dark:border-white/15 dark:bg-black/20 dark:text-white"
            />
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> New Invoice</Button>
          </div>
        </div>

        {DB.invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Receipt size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No invoices yet.</div>
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> New Invoice</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-ink/40 dark:text-white/40">No invoices match your filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Invoice</th>
                  <th className="px-5 py-2.5 font-medium">Client</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ inv, i }) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-3 font-mono text-ink dark:text-white">{inv.no}</td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">{inv.cname}</td>
                    <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(inv.date)}</td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">
                      ₹{fmt(inv.total)}
                      {inv.status === 'partial' && <div className="text-[11px] text-ink/40 dark:text-white/35">₹{fmt(inv.balDue)} due</div>}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => openPayment(i)} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(inv.status)}`}>
                        {inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : 'Unpaid'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" title="Print / PDF" onClick={() => printStored(inv)}><Printer size={14} /></Button>
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
      </>
      )}

      {/* Add / Edit Invoice */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editIdx !== null ? 'Edit Invoice' : 'New Invoice'}
        wide
        footer={
          <>
            <Button onClick={doPrint}><Printer size={14} /> Print / PDF</Button>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save Invoice</Button>
          </>
        }
      >
        <div className="mb-4 flex border-b border-ink/10 dark:border-white/10">
          <button onClick={() => setTab('form')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === 'form' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}>Form</button>
          <button onClick={() => setTab('preview')} className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${tab === 'preview' ? 'border-brass-500 text-ink dark:text-white' : 'border-transparent text-ink/40 dark:text-white/40'}`}><Eye size={13} className="mr-1 inline" />Preview</button>
        </div>

        {tab === 'preview' ? (
          <div className="overflow-x-auto rounded-lg bg-[#e9e9e9] p-4">
            <InvoicePreview data={buildRecord()} settings={DB.settings} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Invoice No."><Input value={form.no} onChange={(e) => setForm({ ...form, no: e.target.value })} /></Field>
              <Field label="Invoice Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Purchase Order No."><Input value={form.po} onChange={(e) => setForm({ ...form, po: e.target.value })} /></Field>
              <Field label="Payment Due In (days)"><Input type="number" value={form.dueDays} onChange={(e) => setForm({ ...form, dueDays: e.target.value })} /></Field>
              <Field label="Place of Supply"><Input value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value })} /></Field>
              <Field label="GST Type">
                <Select value={form.gstType} onChange={(e) => setForm({ ...form, gstType: e.target.value })}>
                  <option value="intra">Intra-state (CGST+SGST)</option>
                  <option value="inter">Inter-state (IGST)</option>
                  <option value="none">No GST</option>
                </Select>
              </Field>
              <Field label="Advance / Discount (₹)"><Input type="number" value={form.advance} onChange={(e) => setForm({ ...form, advance: e.target.value })} /></Field>
              <Field label="Project (optional)">
                <Select value={form.projectLabel || ''} onChange={(e) => setForm({ ...form, projectLabel: e.target.value })}>
                  <option value="">— No project —</option>
                  {DB.projects.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
                </Select>
              </Field>
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
              <div className="hidden grid-cols-[2fr_70px_100px_70px_100px_30px] gap-2 px-1 text-[10px] uppercase tracking-wider text-ink/40 sm:grid dark:text-white/35">
                <span>Description</span><span>Qty</span><span>Rate</span><span>Tax %</span><span>Amount</span><span></span>
              </div>
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
                {form.tdsApplicable && (
                  <div className="mt-1.5 flex justify-between border-t border-ink/10 pt-1.5 text-xs text-blue-600 dark:border-white/10 dark:text-blue-400">
                    <span>Net Receivable (after TDS)</span><span>₹{fmt(totals.total - (parseFloat(form.tdsAmount) || 0))}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-ink/10 bg-[#FAFAF8] p-4 dark:border-white/10 dark:bg-black/20">
              <label className="flex items-center gap-2 text-[13px] font-medium text-ink dark:text-white">
                <input
                  type="checkbox"
                  checked={form.tdsApplicable}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked) {
                      const amt = (totals.total * (parseFloat(form.tdsRate) || 0)) / 100;
                      setForm({ ...form, tdsApplicable: checked, tdsAmount: amt.toFixed(2) });
                    } else {
                      setForm({ ...form, tdsApplicable: checked });
                    }
                  }}
                />
                Client will deduct TDS from this payment
              </label>
              {form.tdsApplicable && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="TDS Rate (%)">
                    <Input
                      type="number"
                      value={form.tdsRate}
                      onChange={(e) => {
                        const rate = e.target.value;
                        const amt = (totals.total * (parseFloat(rate) || 0)) / 100;
                        setForm({ ...form, tdsRate: rate, tdsAmount: amt.toFixed(2) });
                      }}
                    />
                  </Field>
                  <Field label="TDS Amount (₹) — editable"><Input type="number" value={form.tdsAmount} onChange={(e) => setForm({ ...form, tdsAmount: e.target.value })} /></Field>
                  <Field label="Net Receivable (₹)"><Input readOnly disabled value={fmt(totals.total - (parseFloat(form.tdsAmount) || 0))} /></Field>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <Field label="Terms & Conditions"><Textarea rows={2} value={form.tnc} onChange={(e) => setForm({ ...form, tnc: e.target.value })} /></Field>
            </div>
          </>
        )}
      </Modal>

      {/* Payment quick-update */}
      <Modal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title="Update Payment"
        footer={<><Button onClick={() => setPayModal(null)}>Cancel</Button><Button variant="primary" onClick={savePayment}>Save</Button></>}
      >
        {payModal && (
          <div className="flex flex-col gap-4">
            <div className="text-[13px] text-ink/70 dark:text-white/70">
              <strong className="text-ink dark:text-white">{DB.invoices[payModal.idx]?.no}</strong> · {DB.invoices[payModal.idx]?.cname} · <strong>₹{fmt(DB.invoices[payModal.idx]?.total)}</strong>
              {DB.invoices[payModal.idx]?.tdsApplicable && (
                <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  TDS @ {DB.invoices[payModal.idx]?.tdsRate}% (₹{fmt(DB.invoices[payModal.idx]?.tdsAmount)}) deducted — net receivable ₹{fmt(netReceivable(DB.invoices[payModal.idx] || {}))}
                </div>
              )}
            </div>
            <Field label="Status">
              <Select value={payModal.status} onChange={(e) => setPayModal({ ...payModal, status: e.target.value })}>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partially Paid</option>
                <option value="paid">Fully Paid</option>
              </Select>
            </Field>
            {payModal.status === 'partial' && (
              <Field label="Amount Paid (₹)"><Input type="number" value={payModal.amt} onChange={(e) => setPayModal({ ...payModal, amt: e.target.value })} /></Field>
            )}
            {payModal.status !== 'unpaid' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Payment Date"><Input type="date" value={payModal.date} onChange={(e) => setPayModal({ ...payModal, date: e.target.value })} /></Field>
                <Field label="Mode">
                  <Select value={payModal.mode} onChange={(e) => setPayModal({ ...payModal, mode: e.target.value })}>
                    {PAY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </Field>
              </div>
            )}
            <Field label="Note"><Input value={payModal.note} onChange={(e) => setPayModal({ ...payModal, note: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  const toneClass = { default: 'text-ink dark:text-white', green: 'text-emerald-600 dark:text-emerald-400', amber: 'text-brass-600 dark:text-brass-400' }[tone || 'default'];
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/40 dark:text-white/35">{sub}</div>}
    </div>
  );
}

function ClientStatementsView({ DB, statementClientIdx, setStatementClientIdx }) {
  const client = statementClientIdx !== '' ? DB.clients[statementClientIdx] : null;
  const clientInvoices = client ? DB.invoices.filter((i) => i.cname === client.name) : [];

  const totalBilled = clientInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalReceived = clientInvoices.reduce((s, i) => s + (i.status === 'paid' ? netReceivable(i) : i.status === 'partial' ? (i.payAmt || 0) : 0), 0);
  const totalOutstanding = totalBilled - totalReceived;

  const statusBadgeClass = (st) => ({
    paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    partial: 'bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-400',
    unpaid: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  }[st]);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">Client Statement</div>
          {client && (
            <Button variant="primary" size="sm" onClick={() => printClientStatement(client, clientInvoices, DB.settings)}>
              <FileText size={13} /> Print / Download Statement
            </Button>
          )}
        </div>
        <div className="p-5">
          <Field label="Select Client">
            <Select value={statementClientIdx} onChange={(e) => setStatementClientIdx(e.target.value)}>
              <option value="">— Select a client —</option>
              {DB.clients.map((c, idx) => <option key={idx} value={idx}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      {client && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Total Billed" value={`₹${fmt(totalBilled)}`} sub={`${clientInvoices.length} invoices`} />
            <StatCard label="Total Received" value={`₹${fmt(totalReceived)}`} tone="green" />
            <StatCard label="Balance Due" value={`₹${fmt(totalOutstanding)}`} tone={totalOutstanding > 0 ? 'amber' : 'green'} />
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
            {clientInvoices.length === 0 ? (
              <div className="px-6 py-12 text-center text-[13px] text-ink/40 dark:text-white/40">No invoices for this client yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                      <th className="px-5 py-2.5 font-medium">Invoice</th>
                      <th className="px-5 py-2.5 font-medium">Date</th>
                      <th className="px-5 py-2.5 font-medium">Billed</th>
                      <th className="px-5 py-2.5 font-medium">Received</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientInvoices.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((inv, idx) => {
                      const received = inv.status === 'paid' ? netReceivable(inv) : inv.status === 'partial' ? (inv.payAmt || 0) : 0;
                      return (
                        <tr key={idx} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                          <td className="px-5 py-2.5 font-mono text-ink dark:text-white">{inv.no}</td>
                          <td className="px-5 py-2.5 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(inv.date)}</td>
                          <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">₹{fmt(inv.total)}</td>
                          <td className="px-5 py-2.5 text-emerald-600 dark:text-emerald-400">₹{fmt(received)}</td>
                          <td className="px-5 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(inv.status)}`}>{inv.status}</span></td>
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
