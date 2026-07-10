import { useState } from 'react';
import { Image, QrCode, PenTool, Trash2, Save, Lock } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import Button from '../components/ui/Button.jsx';
import { Field, Input, Textarea } from '../components/ui/Field.jsx';

function UploadCard({ icon: Icon, title, hint, value, onUpload, onRemove, previewClass }) {
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onUpload(e.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">{title}</div>
      <div className="p-5">
        {value ? (
          <div className="flex flex-col items-center gap-3">
            <img src={value} alt={title} className={previewClass || 'max-h-24 rounded-lg border border-ink/10 object-contain dark:border-white/10'} />
            <div className="text-xs text-ink/40 dark:text-white/40">Saved — appears on all documents</div>
            <Button size="sm" variant="danger" onClick={onRemove}><Trash2 size={13} /> Remove</Button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-ink/15 py-8 text-center transition-colors hover:border-ink/30 hover:bg-ink/[0.02] dark:border-white/15 dark:hover:border-white/30 dark:hover:bg-white/[0.02]">
            <Icon size={22} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] font-medium text-ink dark:text-white">Upload {title}</div>
            <div className="text-xs text-ink/40 dark:text-white/40">{hint}</div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          </label>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { DB, updateDB } = useDB();
  const [form, setForm] = useState({ ...DB.settings });
  const [pw, setPw] = useState({ newPass: '', confirmPass: '' });
  const [pwStatus, setPwStatus] = useState('');

  function setImage(field, value) {
    updateDB((prev) => ({ ...prev, settings: { ...prev.settings, [field]: value } }));
  }

  function save() {
    updateDB((prev) => ({ ...prev, settings: { ...prev.settings, ...form } }));
    alert('Settings saved!');
  }

  async function changePassword() {
    setPwStatus('');
    if (!pw.newPass || pw.newPass.length < 6) { setPwStatus('Password must be at least 6 characters'); return; }
    if (pw.newPass !== pw.confirmPass) { setPwStatus('Passwords do not match'); return; }
    const { error } = await supabase.auth.updateUser({ password: pw.newPass });
    if (error) { setPwStatus(error.message); return; }
    setPw({ newPass: '', confirmPass: '' });
    setPwStatus('Password updated successfully.');
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <UploadCard
          icon={Image} title="Company Logo" hint="PNG or JPG — appears on all invoices"
          value={DB.settings.logoData} onUpload={(v) => setImage('logoData', v)} onRemove={() => setImage('logoData', '')}
          previewClass="max-h-20 max-w-[200px] rounded-lg border border-ink/10 object-contain bg-white p-2 dark:border-white/10"
        />
        <UploadCard
          icon={QrCode} title="Payment QR Code" hint="Shown in the invoice payment section"
          value={DB.settings.qrData} onUpload={(v) => setImage('qrData', v)} onRemove={() => setImage('qrData', '')}
          previewClass="h-28 w-28 rounded-lg border border-ink/10 object-contain bg-white p-2 dark:border-white/10"
        />
        <UploadCard
          icon={PenTool} title="Stamped Signature" hint="PNG with transparent background recommended"
          value={DB.settings.signData} onUpload={(v) => setImage('signData', v)} onRemove={() => setImage('signData', '')}
          previewClass="max-h-20 max-w-[220px] rounded-lg border border-ink/10 object-contain bg-white p-2 dark:border-white/10"
        />

        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
          <div className="border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">Company Details</div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Company Name"><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
            <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></Field>
            <Field label="PAN"><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></Field>
            <Field label="HSN/SAC Code"><Input value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="City, State, PIN"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Mobile"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
          <div className="border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">Bank Details</div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Bank Name"><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
            <Field label="Account Number"><Input value={form.bankAcc} onChange={(e) => setForm({ ...form, bankAcc: e.target.value })} /></Field>
            <Field label="IFSC Code"><Input value={form.bankIFSC} onChange={(e) => setForm({ ...form, bankIFSC: e.target.value.toUpperCase() })} /></Field>
            <Field label="Branch"><Input value={form.bankBranch} onChange={(e) => setForm({ ...form, bankBranch: e.target.value })} /></Field>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
          <div className="border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">Invoice Defaults</div>
          <div className="flex flex-col gap-4 p-5">
            <Field label="Default Notes"><Textarea rows={2} value={form.defaultNotes} onChange={(e) => setForm({ ...form, defaultNotes: e.target.value })} /></Field>
            <Field label="Default Terms & Conditions"><Textarea rows={4} value={form.defaultTnC} onChange={(e) => setForm({ ...form, defaultTnC: e.target.value })} /></Field>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={save}><Save size={14} /> Save All Settings</Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
          <div className="flex items-center gap-2 border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">
            <Lock size={14} /> Change Login Password
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="New Password"><Input type="password" placeholder="Min 6 characters" value={pw.newPass} onChange={(e) => setPw({ ...pw, newPass: e.target.value })} /></Field>
            <Field label="Confirm New Password"><Input type="password" value={pw.confirmPass} onChange={(e) => setPw({ ...pw, confirmPass: e.target.value })} /></Field>
          </div>
          {pwStatus && <div className="px-5 pb-2 text-xs text-ink/60 dark:text-white/60">{pwStatus}</div>}
          <div className="flex justify-end px-5 pb-5">
            <Button onClick={changePassword}>Update Password</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
