import { useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Receipt, MapPin, Star } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { uid } from '../lib/utils.js';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

function emptyAddress(isDefault = false) {
  return { id: uid(), label: '', addr: '', city: '', state: 'Maharashtra', gst: '', isDefault };
}

function emptyClient() {
  return {
    name: '', type: 'gst', contact: '', mobile: '', email: '', pan: '',
    addresses: [emptyAddress(true)],
  };
}

export default function Clients() {
  const { DB, updateDB } = useDB();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(emptyClient());

  const gstCount = DB.clients.filter((c) => c.type !== 'nogst').length;
  const nonGstCount = DB.clients.filter((c) => c.type === 'nogst').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DB.clients.map((c, i) => ({ c, i }));
    return DB.clients
      .map((c, i) => ({ c, i }))
      .filter(({ c }) =>
        [c.name, c.contact, c.mobile, c.email, c.pan, ...(c.addresses || []).map((a) => a.gst)]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      );
  }, [DB.clients, search]);

  function openAdd() {
    setEditIdx(null);
    setForm(emptyClient());
    setModalOpen(true);
  }

  function openEdit(i) {
    setEditIdx(i);
    const c = DB.clients[i];
    setForm({
      ...c,
      addresses: (c.addresses && c.addresses.length ? c.addresses : [emptyAddress(true)]).map((a) => ({ ...a })),
    });
    setModalOpen(true);
  }

  function remove(i) {
    if (!confirm('Delete this client?')) return;
    updateDB((prev) => ({ ...prev, clients: prev.clients.filter((_, idx) => idx !== i) }));
  }

  function updateAddr(id, patch) {
    setForm((f) => ({
      ...f,
      addresses: f.addresses.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  }

  function setDefaultAddr(id) {
    setForm((f) => ({
      ...f,
      addresses: f.addresses.map((a) => ({ ...a, isDefault: a.id === id })),
    }));
  }

  function addAddr() {
    setForm((f) => ({ ...f, addresses: [...f.addresses, emptyAddress(false)] }));
  }

  function removeAddr(id) {
    setForm((f) => {
      const remaining = f.addresses.filter((a) => a.id !== id);
      if (remaining.length === 0) return f;
      if (!remaining.some((a) => a.isDefault)) remaining[0].isDefault = true;
      return { ...f, addresses: remaining };
    });
  }

  function save() {
    if (!form.name.trim()) { alert('Company / client name is required'); return; }
    if (!form.addresses.some((a) => a.isDefault)) form.addresses[0].isDefault = true;

    updateDB((prev) => {
      const clients = [...prev.clients];
      if (editIdx !== null) clients[editIdx] = form;
      else clients.push(form);
      return { ...prev, clients };
    });
    setModalOpen(false);
  }

  const defaultAddr = (c) => (c.addresses || []).find((a) => a.isDefault) || (c.addresses || [])[0];

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total Clients" value={DB.clients.length} sub="Companies & individuals who hire you" />
        <StatCard label="GST Registered" value={gstCount} tone="green" />
        <StatCard label="Non-GST / Individual" value={nonGstCount} tone="amber" />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">Saved Clients</div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-ink/40 dark:border-white/15 dark:bg-black/20 dark:text-white"
            />
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Client</Button>
          </div>
        </div>

        {DB.clients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Users size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No clients yet.<br />Add a client to get started.</div>
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Client</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-ink/40 dark:text-white/40">No clients match "{search}"</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Company / Name</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Contact</th>
                  <th className="px-5 py-2.5 font-medium">Mobile</th>
                  <th className="px-5 py-2.5 font-medium">Offices</th>
                  <th className="px-5 py-2.5 font-medium">Default GSTIN</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ c, i }) => {
                  const d = defaultAddr(c);
                  const n = (c.addresses || []).length;
                  return (
                    <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink dark:text-white">{c.name}</div>
                        {c.email && <div className="text-xs text-ink/40 dark:text-white/35">{c.email}</div>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.type === 'nogst' ? 'bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                          {c.type === 'nogst' ? 'Non-GST' : 'GST Reg.'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink/70 dark:text-white/70">{c.contact || '—'}</td>
                      <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{c.mobile || '—'}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 text-ink/70 dark:text-white/70">
                          <MapPin size={12} className="text-ink/35 dark:text-white/35" />
                          {n} {n === 1 ? 'office' : 'offices'}
                          {n > 1 && <span className="text-ink/35 dark:text-white/35">· {d?.label || d?.city || 'default'}</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{d?.gst || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="ghost" title="Edit" onClick={() => openEdit(i)}><Pencil size={14} /></Button>
                          <Button size="sm" variant="danger" title="Delete" onClick={() => remove(i)}><Trash2 size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editIdx !== null ? 'Edit Client' : 'Add Client'}
        wide
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save Client</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company / Client Name" className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Studios Pvt Ltd" />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="gst">GST Registered</option>
              <option value="nogst">Non-GST / Individual</option>
            </Select>
          </Field>
          <Field label="PAN">
            <Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" />
          </Field>
          <Field label="Contact Person">
            <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </Field>
          <Field label="Mobile">
            <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </Field>
          <Field label="Email" className="sm:col-span-2">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>

        <div className="mt-6 mb-3 flex items-center justify-between border-b border-ink/10 pb-2 dark:border-white/10">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:text-white/40">
            Registered Offices & Billing Addresses
          </div>
          <Button size="sm" onClick={addAddr}><Plus size={13} /> Add Office</Button>
        </div>

        <div className="flex flex-col gap-3">
          {form.addresses.map((a) => (
            <div key={a.id} className="rounded-lg border border-ink/10 bg-[#FAFAF8] p-4 dark:border-white/10 dark:bg-black/20">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Input
                  value={a.label}
                  onChange={(e) => updateAddr(a.id, { label: e.target.value })}
                  placeholder="e.g. Head Office, Mumbai Branch, Billing Address"
                  className="max-w-xs !bg-transparent font-medium"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDefaultAddr(a.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      a.isDefault
                        ? 'bg-brass-50 text-brass-600 dark:bg-brass-500/15 dark:text-brass-400'
                        : 'text-ink/40 hover:bg-ink/5 dark:text-white/35 dark:hover:bg-white/5'
                    }`}
                  >
                    <Star size={12} fill={a.isDefault ? 'currentColor' : 'none'} />
                    {a.isDefault ? 'Default for billing' : 'Set as default'}
                  </button>
                  {form.addresses.length > 1 && (
                    <button type="button" onClick={() => removeAddr(a.id)} className="rounded-md p-1.5 text-ink/35 hover:bg-rose-50 hover:text-rose-500 dark:text-white/35 dark:hover:bg-rose-500/10">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Address" className="sm:col-span-2">
                  <Textarea rows={2} value={a.addr} onChange={(e) => updateAddr(a.id, { addr: e.target.value })} />
                </Field>
                <Field label="City">
                  <Input value={a.city} onChange={(e) => updateAddr(a.id, { city: e.target.value })} />
                </Field>
                <Field label="State">
                  <Select value={a.state} onChange={(e) => updateAddr(a.id, { state: e.target.value })}>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="GSTIN (for this office)" className="sm:col-span-2">
                  <Input value={a.gst} onChange={(e) => updateAddr(a.id, { gst: e.target.value.toUpperCase() })} placeholder="27ABCDE1234F1Z5" />
                </Field>
              </div>
            </div>
          ))}
        </div>
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