import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useDB } from '../context/DBContext.jsx';

const TITLES = {
  '/': 'Dashboard',
  '/invoices': 'Invoices',
  '/quotations': 'Quotations',
  '/proforma': 'Proforma Invoices',
  '/expenses': 'Expenses',
  '/petty': 'Petty Cash',
  '/clients': 'Clients',
  '/vendors': 'Vendors',
  '/projects': 'Projects',
  '/tracker': 'Monthly Tracker',
  '/informal': 'Informal Income',
  '/reports': 'Reports & CA',
  '/settings': 'Settings',
};

export default function Layout({ onLock }) {
  const location = useLocation();
  const { syncStatus, retrySync } = useDB();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    try { return (localStorage.getItem('incinx_theme') || 'light') === 'dark'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    try { localStorage.setItem('incinx_theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);

  const title = TITLES[location.pathname] || 'INCINX';

  return (
    <div className="flex h-screen overflow-hidden bg-[#F3F1EC] dark:bg-[#0D0C0A]">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} onLock={onLock} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
          onOpenMobile={() => setMobileOpen(true)}
          syncStatus={syncStatus}
          onRetrySync={retrySync}
        />
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
