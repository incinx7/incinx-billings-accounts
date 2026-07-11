import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabaseLoad, supabaseSave, supabaseConfigured } from '../lib/supabase';

const DB_KEY = 'incinx_v2';

export function emptyDB() {
  return {
    invoices: [], clients: [], vendors: [], projects: [], expenses: [], petty: [],
    quotations: [], proforma: [], expo: [], gstBills: [], informal: [],
    pin: '',
    settings: {
      gstin: '', pan: '', hsn: '', companyName: 'My Company', address: '', city: '',
      mobile: '', email: '', logoData: '', qrData: '', signData: '',
      bankName: '', bankAcc: '', bankIFSC: '', bankBranch: '',
      defaultTnC: '', defaultNotes: '',
    },
  };
}

const DBContext = createContext(null);

export function DBProvider({ children }) {
  const [DB, setDB] = useState(() => {
    try {
      const raw = localStorage.getItem(DB_KEY);
      return raw ? { ...emptyDB(), ...JSON.parse(raw) } : emptyDB();
    } catch {
      return emptyDB();
    }
  });

  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | error
  const saveTimer = useRef(null);
  const pendingSave = useRef(false);
  const didInitialLoad = useRef(false);

  // This now only ever mounts after login is confirmed (see App.jsx), so
  // there's no longer a race between "is the user logged in yet" and
  // "try to load their data."
  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    if (!supabaseConfigured) return;
    (async () => {
      try {
        setSyncStatus('syncing');
        const remote = await supabaseLoad(emptyDB());
        if (remote) {
          setDB(remote);
          localStorage.setItem(DB_KEY, JSON.stringify(remote));
        }
        setSyncStatus('idle');
      } catch (e) {
        console.error('Supabase load failed', e);
        setSyncStatus('error');
      }
    })();
  }, []);

  useEffect(() => {
    function handler(e) {
      if (pendingSave.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const runSave = useCallback(async (nextDB) => {
    if (!supabaseConfigured) { pendingSave.current = false; return; }
    try {
      setSyncStatus('syncing');
      await supabaseSave(nextDB);
      setSyncStatus('idle');
    } catch (e) {
      console.error('Supabase save failed', e);
      setSyncStatus('error');
    } finally {
      pendingSave.current = false;
    }
  }, []);

  const persist = useCallback((nextDB) => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(nextDB)); } catch { /* ignore quota errors */ }
    pendingSave.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => runSave(nextDB), 150);
  }, [runSave]);

  const retrySync = useCallback(() => {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return;
    try {
      const current = JSON.parse(raw);
      pendingSave.current = true;
      runSave(current);
    } catch { /* ignore */ }
  }, [runSave]);

  const updateDB = useCallback((updater) => {
    setDB((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <DBContext.Provider value={{ DB, updateDB, syncStatus, retrySync }}>
      {children}
    </DBContext.Provider>
  );
}

export function useDB() {
  const ctx = useContext(DBContext);
  if (!ctx) throw new Error('useDB must be used inside <DBProvider>');
  return ctx;
}
