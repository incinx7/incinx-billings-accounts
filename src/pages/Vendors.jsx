import { useEffect, useMemo, useState } from 'react';
import { Wrench, Plus, Pencil, Trash2, Inbox, FileText, Check, X as XIcon } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt } from '../lib/utils.js';
import { fetchVendorSubmissions, markSubmissionStatus, deleteSubmission, getAadhaarSignedUrl } from '../lib/vendorSubmissions.js';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Select } from '../components/ui/Field.jsx';

const CATEGORIES = ['Photographer', 'Videographer', 'Video Editor', 'Graphic Designer', 'Drone Operator', 'Sound Engineer', 'Equipment Rental', 'Studio / Location', 'Hair & Makeup', 'Logistics / Transport', 'Post Production', 'Other'];

function emptyVendor() {
  return {
    vendorType: 'nogst', cat: 'Photographer', name: '', biz: '', mobile: '', email: '',
    pan: '', gst: '', bank: '', acc: '', ifsc: '', branch: '', accName: '', upi: '',
  };
}

export default function Vendors() {
  const { DB, updateDB } = useDB();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [form, setForm] = useState(emptyVendor());

  const [submissions, setSubmissions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState('');
  const [viewingDoc, setViewingDoc] = useState(null);

  const gstCount = DB.vendors.filter((v) => v.vendorType === 'gst' || v.gst).length;
  const nonGstCount = DB.vendors.length - gstCount;
  const totalPaid = DB.expenses.reduce((s, e) => s + (e.paymentSplits || []).reduce((ps, p) => ps + (parseFloat(p.amt) || 0), 0), 0);

  const pendingSubs = submissions.filter((s) => (s.data?.status || 'pending') === 'pending');

  async function loadSubmissions() {
    setSubsLoading(true);
    setSubsError('');
    try {
      setSubmissions(await fetchVendorSubmissions());
    } catch (e) {
      console.error(e);
      setSubsError('Could not load submissions — check you are signed in and RLS policies are set up.');
    } finally {
      setSubsLoading(false);
    }
  }

  useEffect(() => { loadSubmissions(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DB.vendors.map((v, i) => ({ v, i }));
    return DB.vendors.map((v, i) => ({ v, i })).filter(({ v }) =>
      [v.name, v.biz, v.mobile, v.email, v.pan, v.gst].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [DB.vendors, search]);

  function openAdd() { setEditIdx(null); setForm(emptyVendor()); setModalOpen(true); }
  function openEdit(i) { setEditIdx(i); setForm({ ...DB.vendors[i] }); setModalOpen(true); }

  function remove(i) {
    if (!confirm('Delete this vendor?')) return;
    updateDB((prev) => ({ ...prev, vendors: prev.vendors.filter((_, idx) => idx !== i) }));
  }

  function save() {
    if (!form.name.trim() && !form.biz.trim()) { alert('Enter a name or business name'); return; }
    updateDB((prev) => {
      const vendors = [...prev.vendors];
      if (editIdx !== null) vendors[editIdx] = form; else vendors.push(form);
      return { ...prev, vendors };
    });
    setModalOpen(false);
  }

  async function approve(sub) {
    const d = sub.data || {};
    const vendor = {
      vendorType: d.vendorType || (d.gst ? 'gst' : 'nogst'),
      cat: d.cat || 'Other',
      name: d.name || '', biz: d.biz || '', mobile: d.mobile || '', email: d.email || '',
      pan: d.pan || '', gst: d.gst || '', bank: d.bank || '', acc: d.acc || '',
      ifsc: d.ifsc || '', branch: d.branch || '', accName: d.accName || '', upi: d.upi || '',
      aadhaarDoc: d.aadhaarDoc || '',
    };
    updateDB((prev) => ({ ...prev, vendors: [...prev.vendors, vendor] }));
    try {
      await markSubmissionStatus(sub.id, 'approved', d);
      loadSubmissions();
    } catch (e) {
      console.error(e);
      alert('Vendor was added, but marking the submission as approved failed. You can safely ignore or retry.');
    }
  }

  async function reject(sub) {
    if (!confirm('Reject this submission? It will stay in the list marked as rejected.')) return;
    try {
      await markSubmissionStatus(sub.id, 'rejected', sub.data || {});
      loadSubmissions();
    } catch (e) {
      console.error(e);
      alert('Could not update this submission — try again.');
    }
  }

  async function removeSubmission(id) {
    if (!confirm('Permanently delete this submission record?')) return;
    try {
      await deleteSubmission(id);
      loadSubmissions();
    } catch (e) {
      console.error(e);
      alert('Could not delete — try again.');
    }
  }

  async function viewDoc(path) {
    try {
      const url = await getAadhaarSignedUrl(path);
      if (!url) { alert('No document on file for this submission.'); return; }
      setViewingDoc({ url, name: path });
    } catch (e) {
      console.error(e);
      alert('Could not load the document — check the storage bucket/policies are set up.');
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Vendors" value={DB.vendors.length} sub="Freelancers & companies you pay" />
        <StatCard label="GST Registered" value={gstCount} tone="blue" />
        <StatCard label="Non-GST" value={nonGstCount} tone="amber" />
        <StatCard label="Total Paid Out" value={`₹${fmt(totalPaid)}`} tone="red" />
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink dark:text-white">
            <Inbox size={15} className="text-brass-500" />
            Pending Vendor Submissions
            {pendingSubs.length > 0 && (
              <span className="rounded-full bg-brass-500 px-2 py-0.5 text-[11px] font-bold text-white">{pendingSubs.length}</span>
            )}
          </div>
          <Button size="sm" onClick={loadSubmissions}>{subsLoading ? 'Loading…' : 'Refresh'}</Button>
        </div>

        {subsError ? (
          <div className="px-5 py-8 text-center text-[13px] text-rose-500">{subsError}</div>
        ) : pendingSubs.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink/40 dark:text-white/40">
            No pending submissions from the vendor registration form right now.
          </div>
        ) : (
          <div className="divide-y divide-ink/10 dark:divide-white/10">
            {pendingSubs.map((sub) => {
              const d = sub.data || {};
              return (
                <div key={sub.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <div className="font-medium text-ink dark:text-white">{d.biz || d.name || 'Unnamed vendor'}</div>
                    <div className="mt-0.5 text-xs text-ink/50 dark:text-white/45">
                      {d.name}{d.name && d.mobile ? ' · ' : ''}{d.mobile}{d.email ? ' · ' + d.email : ''}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-ink/40 dark:text-white/35">
                      {d.vendorType === 'gst' ? `GST · ${d.gst || '—'}` : 'Non-GST'} · PAN {d.pan || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {d.aadhaarDoc && (
                      <Button size="sm" onClick={() => viewDoc(d.aadhaarDoc)}><FileText size={13} /> Document</Button>
                    )}
                    <Button size="sm" variant="primary" onClick={() => approve(sub)}><Check size={13} /> Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => reject(sub)}><XIcon size={13} /> Reject</Button>
                    <Button size="sm" variant="ghost" onClick={() => removeSubmission(sub.id)}><Trash2 size={13} /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
          <div className="text-[13px] font-semibold text-ink dark:text-white">All Vendors</div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink outline-none focus:border-ink/40 dark:border-white/15 dark:bg-black/20 dark:text-white"
            />
            <Button variant="primary" size="sm" onClick={openAdd}><Plus size={14} /> Add Vendor</Button>
          </div>
        </div>

        {DB.vendors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Wrench size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No vendors yet.<br />Add one manually, or approve a submission above.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-ink/40 dark:text-white/40">No vendors match "{search}"</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Business / Name</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Category</th>
                  <th className="px-5 py-2.5 font-medium">Mobile</th>
                  <th className="px-5 py-2.5 font-medium">PAN / GST</th>
                  <th className="px-5 py-2.5 font-medium">Bank</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ v, i }) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink dark:text-white">{v.biz || v.name}</div>
                      {v.biz && v.name && <div className="text-xs text-ink/40 dark:text-white/35">{v.name}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${v.vendorType === 'gst' || v.gst ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-400'}`}>
                        {v.vendorType === 'gst' || v.gst ? 'GST' : 'Non-GST'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink/70 dark:text-white/70">{v.cat || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{v.mobile || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-ink/70 dark:text-white/70">{v.gst || v.pan || '—'}</td>
                    <td className="px-5 py-3 text-xs text-ink/70 dark:text-white/70">{v.bank ? `${v.bank}${v.acc ? ' · ' + v.acc.slice(-4) : ''}` : '—'}</td>
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
        title={editIdx !== null ? 'Edit Vendor' : 'Add Vendor'}
        wide
        footer={<><Button onClick={() => setModalOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Save Vendor</Button></>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vendor Type">
            <Select value={form.vendorType} onChange={(e) => setForm({ ...form, vendorType: e.target.value })}>
              <option value="nogst">Non-GST / Freelancer</option>
              <option value="gst">GST Registered</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Full Name (Contact Person)"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Business / Company Name"><Input value={form.biz} onChange={(e) => setForm({ ...form, biz: e.target.value })} /></Field>
          <Field label="Mobile"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="PAN"><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></Field>
          {form.vendorType === 'gst' && (
            <Field label="GST Number"><Input value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value.toUpperCase() })} /></Field>
          )}
        </div>

        <div className="mt-6 mb-3 border-b border-ink/10 pb-2 font-mono text-[10px] uppercase tracking-wider text-ink/45 dark:border-white/10 dark:text-white/40">
          Bank Details & UPI
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Account Holder Name"><Input value={form.accName} onChange={(e) => setForm({ ...form, accName: e.target.value })} /></Field>
          <Field label="Account Number"><Input value={form.acc} onChange={(e) => setForm({ ...form, acc: e.target.value })} /></Field>
          <Field label="IFSC Code"><Input value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })} /></Field>
          <Field label="Bank Name"><Input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} /></Field>
          <Field label="Branch"><Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></Field>
          <Field label="UPI ID"><Input value={form.upi} onChange={(e) => setForm({ ...form, upi: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!viewingDoc} onClose={() => setViewingDoc(null)} title="Vendor Document">
        {viewingDoc && (
          <div className="flex flex-col items-center gap-3">
            <a href={viewingDoc.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline dark:text-blue-400">
              Open in new tab
            </a>
            <img src={viewingDoc.url} alt="Vendor document" className="max-h-[60vh] rounded-lg border border-ink/10 object-contain dark:border-white/10" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  const toneClass = { default: 'text-ink dark:text-white', blue: 'text-blue-600 dark:text-blue-400', amber: 'text-brass-600 dark:text-brass-400', red: 'text-rose-600 dark:text-rose-400' }[tone || 'default'];
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/40 dark:text-white/35">{sub}</div>}
    </div>
  );
}