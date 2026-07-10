import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, ClipboardList, FileText, Wallet, Coins,
  Users, Wrench, Clapperboard, CalendarRange,
  IndianRupee, FileBarChart2, Settings, Lock, X,
} from 'lucide-react';

const NAV = [
  { section: null, items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }] },
  {
    section: 'Billing',
    items: [
      { to: '/invoices', icon: Receipt, label: 'Invoices' },
      { to: '/quotations', icon: ClipboardList, label: 'Quotations' },
      { to: '/proforma', icon: FileText, label: 'Proforma' },
      { to: '/expenses', icon: Wallet, label: 'Expenses' },
      { to: '/petty', icon: Coins, label: 'Petty Cash' },
    ],
  },
  {
    section: 'Business',
    items: [
      { to: '/clients', icon: Users, label: 'Clients' },
      { to: '/vendors', icon: Wrench, label: 'Vendors' },
      { to: '/projects', icon: Clapperboard, label: 'Projects' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { to: '/tracker', icon: CalendarRange, label: 'Monthly Tracker' },
      { to: '/informal', icon: IndianRupee, label: 'Informal Income' },
      { to: '/reports', icon: FileBarChart2, label: 'Reports & CA' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Sidebar({ mobileOpen, onCloseMobile, onLock }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onCloseMobile}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-noir transition-transform duration-200 ease-out
          md:static md:z-auto md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <img src="/logo.jpg" alt="INCINX" className="h-7 w-auto rounded" />
          <button className="text-white/40 hover:text-white/80 md:hidden" onClick={onCloseMobile}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
              {group.section && (
                <div className="px-3 pb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/25">
                  {group.section}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors
                       ${isActive ? 'bg-white/[0.07] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white/85'}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full transition-colors
                            ${isActive ? 'bg-brass-400' : 'bg-transparent'}`}
                        />
                        <Icon size={16} strokeWidth={1.75} className={isActive ? 'text-brass-400' : 'text-white/40 group-hover:text-white/70'} />
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.08] px-3 py-3">
          <button
            onClick={onLock}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 font-mono text-[12px] text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/70"
          >
            <Lock size={14} strokeWidth={1.75} />
            Lock App
          </button>
        </div>
      </aside>
    </>
  );
}