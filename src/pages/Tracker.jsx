import { useMemo, useState } from 'react';
import { CalendarRange, CreditCard, Receipt } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, todayISO, netReceivable, dateToFYStart, isInFY, fyLabel } from '../lib/utils.js';
import Modal from '../components/ui/Modal.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Select, Input } from '../components/ui/Field.jsx';

const MONTH_LABELS = { 1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December' };
const FY_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]; // Indian financial year: April -> March
const PAY_MODES = ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Card'];

export default function Tracker() {
  const { DB, updateDB } = useDB();
  const now = new Date();
  const [selFY, setSelFY] = useState(dateToFYStart(now.toISOString().split('T')[0]));
  const [selMonth, setSelMonth] = useState('all');
  const [payModal, setPayModal] = useState(null);

  const fyOptions = useMemo(() => {
    const set = new Set();
    DB.invoices.forEach((i) => i.date && set.add(dateToFYStart(i.date)));
    DB.expenses.forEach((e) => e.date && set.add(dateToFYStart(e.date)));
    set.add(dateToFYStart(now.toISOString().split('T')[0]));
    return Array.from(set).sort((a, b) => b - a);
  }, [DB.invoices, DB.expenses]);

  function inSelection(dateStr) {
    if (!dateStr) return false;
    if (dateToFYStart(dateStr) !== selFY) return false;
    if (selMonth === 'all') return true;
    return String(parseInt(dateStr.split('-')[1], 10)) === String(selMonth);
  }
  const fInv = DB.invoices.filter((inv) => inSelection(inv.date));
  const fExp = DB.expenses.filter((e) => inSelection(e.date));
  const fInf = (DB.informal || []).filter((f) => inSelection(f.date));
  const informalTotal = fInf.reduce((s, f) => s + (parseFloat(f.amt) || 0), 0);
  const informalPassThrough = fInf.reduce((s, f) => s + (f.to ? (parseFloat(f.toAmt) || parseFloat(f.amt) || 0) : 0), 0);

  const ti = fInv.reduce((s, i) => s + (i.total || 0), 0) + informalTotal;
  const pa = fInv.filter((i) => i.status === 'paid').reduce((s, i) => s + netReceivable(i), 0) + informalTotal;
  const ua = fInv.filter((i) => i.status !== 'paid').reduce((s, i) => s + (netReceivable(i) - (i.status === 'partial' ? (i.payAmt || 0) : 0)), 0);
  const te = fExp.reduce((s, e) => s + (parseFloat(e.amt) || 0), 0) + informalPassThrough;
  const gst = fInv.reduce((s, i) => s + (i.totalTax || 0), 0);

  const monthlyBreakdown = useMemo(() => {
    if (selMonth !== 'all') return [];
    const bm = {};
    DB.invoices.filter((i) => i.date && dateToFYStart(i.date) === selFY).forEach((i) => {
      const m = parseInt(i.date.split('-')[1], 10);
      if (!bm[m]) bm[m] = { inv: 0, paid: 0, exp: 0, gst: 0, cnt: 0 };
      bm[m].inv += i.total || 0;
      if (i.status === 'paid') bm[m].paid += netReceivable(i);
      bm[m].gst += i.totalTax || 0;
      bm[m].cnt++;
    });
    DB.expenses.filter((e) => e.date && dateToFYStart(e.date) === selFY).forEach((e) => {
      const m = parseInt(e.date.split('-')[1], 10);
      if (!bm[m]) bm[m] = { inv: 0, paid: 0, exp: 0, gst: 0, cnt: 0 };
      bm[m].exp += parseFloat(e.amt) || 0;
    });
    (DB.informal || []).filter((f) => f.date && dateToFYStart(f.date) === selFY).forEach((f) => {
      const m = parseInt(f.date.split('-')[1], 10);
      if (!bm[m]) bm[m] = { inv: 0, paid: 0, exp: 0, gst: 0, cnt: 0 };
      const amt = parseFloat(f.amt) || 0;
      bm[m].inv += amt;
      bm[m].paid += amt;
      if (f.to) bm[m].exp += (parseFloat(f.toAmt) || amt);
    });
    const rows = [];
    for (const m of FY_MONTH_ORDER) {
      const d = bm[m] || { inv: 0, paid: 0, exp: 0, gst: 0, cnt: 0 };
      rows.push({ m, ...d, net: d.paid - d.exp });
    }
    return rows;
  }, [DB.invoices, DB.expenses, DB.informal, selFY, selMonth]);

  function openPayment(inv, idx) {
    setPayModal({ idx, status: inv.status || 'unpaid', amt: inv.payAmt || '', date: inv.payDate || todayISO(), mode: inv.payMode || 'UPI', note: inv.payNote || '' });
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
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 shadow-card dark:border-white/10 dark:bg-noir-soft">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40 dark:text-white/35">Financial Year</span>
        <Select value={selFY} onChange={(e) => setSelFY(parseInt(e.target.value, 10))} className="!w-auto py-1.5 text-[13px]">
          {fyOptions.map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
        </Select>
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink/40 dark:text-white/35">Month</span>
        <Select value={selMonth} onChange={(e) => setSelMonth(e.target.value)} className="!w-auto py-1.5 text-[13px]">
          <option value="all">All Months</option>
          {FY_MONTH_ORDER.map((m) => <option key={m} value={m}>{MONTH_LABELS[m]}</option>)}
        </Select>
        <span className="ml-auto text-xs text-ink/40 dark:text-white/40">{fInv.length} invoice{fInv.length !== 1 ? 's' : ''} in view</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Invoiced" value={`₹${fmt(ti)}`} sub={`${fInv.length} invoices`} />
        <StatCard label="Received" value={`₹${fmt(pa)}`} tone="green" />
        <StatCard label="Outstanding" value={`₹${fmt(ua)}`} tone="amber" />
        <StatCard label="Net Profit" value={`₹${fmt(pa - te)}`} tone={pa - te >= 0 ? 'green' : 'red'} sub={`GST: ₹${fmt(gst)}`} />
      </div>

      {selMonth === 'all' && (
        <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
          <div className="border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">Monthly Breakdown — {fyLabel(selFY)}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Month</th>
                  <th className="px-5 py-2.5 font-medium">Invoices</th>
                  <th className="px-5 py-2.5 font-medium">Invoiced</th>
                  <th className="px-5 py-2.5 font-medium">Received</th>
                  <th className="px-5 py-2.5 font-medium">GST</th>
                  <th className="px-5 py-2.5 font-medium">Expenses</th>
                  <th className="px-5 py-2.5 font-medium">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {monthlyBreakdown.map((d) => (
                  <tr key={d.m} onClick={() => setSelMonth(String(d.m))} className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-ink/[0.02] dark:border-white/5 dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-2.5 font-medium text-ink dark:text-white">{MONTH_LABELS[d.m]}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{d.cnt}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">₹{fmt(d.inv)}</td>
                    <td className="px-5 py-2.5 text-emerald-600 dark:text-emerald-400">₹{fmt(d.paid)}</td>
                    <td className="px-5 py-2.5 text-brass-600 dark:text-brass-400">₹{fmt(d.gst)}</td>
                    <td className="px-5 py-2.5 text-rose-600 dark:text-rose-400">₹{fmt(d.exp)}</td>
                    <td className={`px-5 py-2.5 font-medium ${d.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>₹{fmt(d.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#FAFAF8] font-semibold dark:bg-black/20">
                  <td className="px-5 py-2.5 text-ink dark:text-white">Total</td>
                  <td className="px-5 py-2.5 text-ink dark:text-white">{fInv.length}</td>
                  <td className="px-5 py-2.5 text-ink dark:text-white">₹{fmt(ti)}</td>
                  <td className="px-5 py-2.5 text-emerald-600 dark:text-emerald-400">₹{fmt(pa)}</td>
                  <td className="px-5 py-2.5 text-brass-600 dark:text-brass-400">₹{fmt(gst)}</td>
                  <td className="px-5 py-2.5 text-rose-600 dark:text-rose-400">₹{fmt(te)}</td>
                  <td className={`px-5 py-2.5 ${pa - te >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>₹{fmt(pa - te)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
        <div className="border-b border-ink/10 px-5 py-3.5 text-[13px] font-semibold text-ink dark:border-white/10 dark:text-white">
          Invoices — {selMonth === 'all' ? fyLabel(selFY) : MONTH_LABELS[parseInt(selMonth, 10)] + ' ' + fyLabel(selFY)}
        </div>
        {fInv.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Receipt size={28} strokeWidth={1.5} className="text-ink/30 dark:text-white/30" />
            <div className="text-[13px] text-ink/45 dark:text-white/45">No invoices in this period</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                  <th className="px-5 py-2.5 font-medium">Invoice</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Client</th>
                  <th className="px-5 py-2.5 font-medium">Total</th>
                  <th className="px-5 py-2.5 font-medium">GST</th>
                  <th className="px-5 py-2.5 font-medium">Received</th>
                  <th className="px-5 py-2.5 font-medium">Balance</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fInv.map((inv) => {
                  const idx = DB.invoices.indexOf(inv);
                  const recv = inv.status === 'paid' ? netReceivable(inv) : (inv.payAmt || 0);
                  const bal = inv.status === 'paid' ? 0 : Math.max(0, netReceivable(inv) - recv);
                  return (
                    <tr key={idx} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                      <td className="px-5 py-2.5 font-mono text-ink dark:text-white">{inv.no}</td>
                      <td className="px-5 py-2.5 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(inv.date)}</td>
                      <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{inv.cname}</td>
                      <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">₹{fmt(inv.total)}</td>
                      <td className="px-5 py-2.5 text-brass-600 dark:text-brass-400">₹{fmt(inv.totalTax || 0)}</td>
                      <td className="px-5 py-2.5 text-emerald-600 dark:text-emerald-400">{recv ? '₹' + fmt(recv) : '—'}</td>
                      <td className={bal > 0 ? 'px-5 py-2.5 text-rose-600 dark:text-rose-400' : 'px-5 py-2.5 text-emerald-600 dark:text-emerald-400'}>{bal > 0 ? '₹' + fmt(bal) : 'Nil'}</td>
                      <td className="px-5 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(inv.status)}`}>{inv.status}</span></td>
                      <td className="px-5 py-2.5"><Button size="sm" onClick={() => openPayment(inv, idx)}><CreditCard size={13} /> Payment</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
  const toneClass = { default: 'text-ink dark:text-white', green: 'text-emerald-600 dark:text-emerald-400', amber: 'text-brass-600 dark:text-brass-400', red: 'text-rose-600 dark:text-rose-400' }[tone || 'default'];
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/40 dark:text-white/35">{sub}</div>}
    </div>
  );
}
