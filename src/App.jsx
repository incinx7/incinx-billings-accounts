import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import PinScreen from './components/PinScreen.jsx';
import Layout from './components/Layout.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Invoices from './pages/Invoices.jsx';
import Quotations from './pages/Quotations.jsx';
import Proforma from './pages/Proforma.jsx';
import Expenses from './pages/Expenses.jsx';
import Petty from './pages/Petty.jsx';
import Clients from './pages/Clients.jsx';
import Vendors from './pages/Vendors.jsx';
import Projects from './pages/Projects.jsx';
import Tracker from './pages/Tracker.jsx';
import Informal from './pages/Informal.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PinScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <Routes>
      <Route element={<Layout onLock={() => setUnlocked(false)} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/quotations" element={<Quotations />} />
        <Route path="/proforma" element={<Proforma />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/petty" element={<Petty />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/informal" element={<Informal />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
