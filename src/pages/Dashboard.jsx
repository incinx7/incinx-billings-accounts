import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Wallet, AlertTriangle } from 'lucide-react';
import { useDB } from '../context/DBContext.jsx';
import { fmt, fmtDate, netReceivable, addDays, daysBetween, todayISO } from '../lib/utils.js';

function StatCard({ label, value, sub, tone }) {
  const toneClass = {
    default: 'text-ink dark:text-white',
    green: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-brass-600 dark:text-brass-400',
    red: 'text-rose-600 dark:text-rose-400',
  }[tone || 'default'];

  return (
    <div className="rounded-xl border border-ink/10 bg-white p-5 shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink/40 dark:text-white/40">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/40 dark:text-white/35">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card dark:border-white/10 dark:bg-noir-soft">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3.5 dark:border-white/10">
        <div className="text-[13px] font-semibold text-ink dark:text-white">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { DB } = useDB();
  const [selMonth, setSelMonth] = useState('all');

  const months = useMemo(() => {
    const set = new Set();
    DB.invoices.forEach((i) => i.date && set.add(i.date.slice(0, 7)));
    DB.expenses.forEach((e) => e.date && set.add(e.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [DB.invoices, DB.expenses]);

  const overdueInvoices = useMemo(() => {
    const today = todayISO();
    return DB.invoices
      .filter((i) => i.status !== 'paid' && i.date && i.dueDays)
      .map((i) => ({ ...i, dueDate: addDays(i.date, i.dueDays) }))
      .filter((i) => i.dueDate < today)
      .map((i) => ({ ...i, daysOverdue: daysBetween(i.dueDate, today), balance: i.status === 'partial' ? Math.max(0, netReceivable(i) - (i.payAmt || 0)) : netReceivable(i) }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [DB.invoices]);

  const inMonth = (dateStr) => (selMonth === 'all' ? true : dateStr && dateStr.slice(0, 7) === selMonth);
  const filtInv = DB.invoices.filter((i) => inMonth(i.date));
  const filtExp = DB.expenses.filter((e) => inMonth(e.date));
  const filtInf = (DB.informal || []).filter((f) => inMonth(f.date));

  const informalTotal = filtInf.reduce((s, f) => s + (parseFloat(f.amt) || 0), 0);
  const informalPassThrough = filtInf.reduce((s, f) => s + (f.to ? (parseFloat(f.toAmt) || parseFloat(f.amt) || 0) : 0), 0);

  const totalRevenue = filtInv.reduce((s, i) => s + (i.total || 0), 0) + informalTotal;
  const totalReceived = filtInv.filter((i) => i.status === 'paid').reduce((s, i) => s + netReceivable(i), 0)
    + filtInv.filter((i) => i.status === 'partial').reduce((s, i) => s + (i.payAmt || 0), 0) + informalTotal;
  const outstanding = totalRevenue - totalReceived;
  const totalExpenses = filtExp.reduce((s, e) => s + (parseFloat(e.amt) || 0), 0) + informalPassThrough;

  const monthLabel = (ym) => {
    if (ym === 'all') return 'All Time';
    const [y, m] = ym.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[parseInt(m, 10) - 1] + ' ' + y;
  };

  const statusBadge = (st) => {
    const map = {
      paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
      partial: 'bg-brass-50 text-brass-600 dark:bg-brass-500/10 dark:text-brass-400',
      unpaid: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
    };
    return map[st] || map.unpaid;
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <select
          value={selMonth}
          onChange={(e) => setSelMonth(e.target.value)}
          className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-[13px] text-ink outline-none dark:border-white/15 dark:bg-noir-soft dark:text-white"
        >
          <option value="all">All Time</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Revenue" value={`₹${fmt(totalRevenue)}`} sub={`${filtInv.length} invoice${filtInv.length !== 1 ? 's' : ''}`} />
        <StatCard label="Received" value={`₹${fmt(totalReceived)}`} tone="green" />
        <StatCard label="Outstanding" value={`₹${fmt(outstanding)}`} tone="amber" />
        <StatCard label="Expenses" value={`₹${fmt(totalExpenses)}`} tone="red" />
      </div>

      {overdueInvoices.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-rose-200 bg-rose-50 shadow-card dark:border-rose-500/20 dark:bg-rose-500/[0.06]">
          <div className="flex items-center gap-2 border-b border-rose-200 px-5 py-3.5 dark:border-rose-500/20">
            <AlertTriangle size={15} className="text-rose-500" />
            <div className="text-[13px] font-semibold text-rose-700 dark:text-rose-400">
              {overdueInvoices.length} Overdue Invoice{overdueInvoices.length !== 1 ? 's' : ''}
            </div>
            <span className="ml-auto text-xs font-medium text-rose-600 dark:text-rose-400">
              ₹{fmt(overdueInvoices.reduce((s, i) => s + i.balance, 0))} total overdue
            </span>
          </div>
          <div className="divide-y divide-rose-200/60 dark:divide-rose-500/10">
            {overdueInvoices.slice(0, 6).map((inv, idx) => (
              <Link key={idx} to="/invoices" className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px] hover:bg-rose-100/40 dark:hover:bg-rose-500/10">
                <div>
                  <span className="font-mono font-medium text-ink dark:text-white">{inv.no}</span>
                  <span className="ml-2 text-ink/60 dark:text-white/55">{inv.cname}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-rose-600 dark:text-rose-400">₹{fmt(inv.balance)}</span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">{inv.daysOverdue}d overdue</span>
                </div>
              </Link>
            ))}
            {overdueInvoices.length > 6 && (
              <div className="px-5 py-2 text-center text-xs text-rose-500 dark:text-rose-400">+{overdueInvoices.length - 6} more overdue</div>
            )}
          </div>
        </div>
      )}

      <SectionCard
        title={selMonth === 'all' ? 'Recent Invoices' : 'Invoices — ' + monthLabel(selMonth)}
        action={<Link className="rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5" to="/invoices">View All</Link>}
      >
        {filtInv.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-ink/40 dark:text-white/35">
            <Receipt size={28} strokeWidth={1.5} />
            <div className="text-[13px]">{selMonth === 'all' ? 'No invoices yet' : 'No invoices in ' + monthLabel(selMonth)}</div>
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                <th className="px-5 py-2.5 font-medium">Invoice</th>
                <th className="px-5 py-2.5 font-medium">Client</th>
                <th className="px-5 py-2.5 font-medium">Amount</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtInv.slice().reverse().slice(0, selMonth === 'all' ? 5 : undefined).map((inv, i) => (
                <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                  <td className="px-5 py-2.5 font-mono text-ink dark:text-white">{inv.no}</td>
                  <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{inv.cname}</td>
                  <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">₹{fmt(inv.total)}</td>
                  <td className="px-5 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(inv.status)}`}>{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard
        title={selMonth === 'all' ? 'Recent Expenses' : 'Expenses — ' + monthLabel(selMonth)}
        action={<Link className="rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5" to="/expenses">View All</Link>}
      >
        {filtExp.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-ink/40 dark:text-white/35">
            <Wallet size={28} strokeWidth={1.5} />
            <div className="text-[13px]">{selMonth === 'all' ? 'No expenses yet' : 'No expenses in ' + monthLabel(selMonth)}</div>
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-ink/40 dark:border-white/10 dark:text-white/35">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">Description</th>
                <th className="px-5 py-2.5 font-medium">Amount</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtExp.slice().reverse().slice(0, selMonth === 'all' ? 5 : undefined).map((e, i) => {
                const st = e.status || 'unpaid';
                return (
                  <tr key={i} className="border-b border-ink/5 last:border-0 dark:border-white/5">
                    <td className="px-5 py-2.5 font-mono text-xs text-ink/70 dark:text-white/70">{fmtDate(e.date)}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">{e.desc}</td>
                    <td className="px-5 py-2.5 text-ink/70 dark:text-white/70">₹{fmt(parseFloat(e.amt))}</td>
                    <td className="px-5 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(st)}`}>
                        {st === 'paid' ? 'Paid' : st === 'partial' ? 'Partial' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
