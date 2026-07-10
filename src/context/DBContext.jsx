import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabaseLoad, supabaseSave, supabaseConfigured } from '../lib/supabase';

const DB_KEY = 'incinx_v2';

// Same default shape as the original app's `DB` object.
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
  const pendingSave = useRef(false); // true whenever a save is queued OR in flight
  const lastGoodDB = useRef(null);
  const didInitialLoad = useRef(false);

  // On first mount, try to pull the latest from Supabase (source of truth
  // across devices), falling back silently to whatever's in localStorage.
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
          lastGoodDB.current = remote;
          localStorage.setItem(DB_KEY, JSON.stringify(remote));
        }
        setSyncStatus('idle');
      } catch (e) {
        console.error('Supabase load failed', e);
        setSyncStatus('error');
      }
    })();
  }, []);

  // Warn before closing/reloading if a save hasn't finished yet — this is
  // what stops a fast reload from silently losing the last change (the app
  // would otherwise fetch from Supabase before that save landed, and
  // overwrite the newer local copy with the older remote one).
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
      lastGoodDB.current = nextDB;
      setSyncStatus('idle');
    } catch (e) {
      console.error('Supabase save failed', e);
      setSyncStatus('error');
    } finally {
      pendingSave.current = false;
    }
  }, []);

  // Persist to localStorage immediately. The Supabase push is only briefly
  // debounced (just enough to coalesce rapid successive edits) — not the
  // 600ms delay this used to have, which was long enough for a quick
  // reload to slip through before the save ever left the browser.
  const persist = useCallback((nextDB) => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(nextDB)); } catch { /* ignore quota errors */ }
    pendingSave.current = true;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => runSave(nextDB), 150);
  }, [runSave]);

  /** Retries the last save immediately — used by the sync-error indicator. */
  const retrySync = useCallback(() => {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return;
    try {
      const current = JSON.parse(raw);
      pendingSave.current = true;
      runSave(current);
    } catch { /* ignore */ }
  }, [runSave]);

  /** Update the DB. Accepts either a new object or an updater function, React-setState style. */
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
