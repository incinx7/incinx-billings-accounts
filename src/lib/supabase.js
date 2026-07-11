// Data layer for the 13-table Supabase architecture (one table per
// section, e.g. `invoices`, `clients`, `expenses`...) instead of the
// original single `app_data` table. Each table is expected to have
// columns: id (any type, auto-generated), data (jsonb), created_at.

import { supabase } from './supabaseClient.js';

export const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

const tableMap = {
  clients: 'clients',
  expenses: 'expenses',
  expo: 'expo',
  gstBills: 'gst_bills',
  informal: 'informal',
  invoices: 'invoices',
  petty: 'petty_cash',
  pin: 'pin',
  proforma: 'proforma',
  projects: 'projects',
  quotations: 'quotations',
  settings: 'settings',
  vendors: 'vendors',
};

export async function supabaseLoad(emptyDbShape) {
  if (!supabaseConfigured) return null;
  const db = structuredClone(emptyDbShape);

  for (const [dbKey, tableName] of Object.entries(tableMap)) {
    const { data: rows, error } = await supabase
      .from(tableName)
      .select('id,data,created_at')
      .order('id', { ascending: true });

    if (error) {
      // Surface this instead of silently skipping — a silently-skipped
      // section (e.g. from a missing RLS policy) looks identical to
      // "genuinely empty," which is exactly what caused the earlier
      // confusion. Better to fail loudly and know immediately.
      throw new Error(`Failed to load "${tableName}": ${error.message}`);
    }

    if (Array.isArray(emptyDbShape[dbKey])) {
      db[dbKey] = (rows || []).map((row) => row.data);
    } else {
      db[dbKey] = rows?.[0]?.data ?? emptyDbShape[dbKey];
    }
  }
  return db;
}

export async function supabaseSave(DB) {
  if (!supabaseConfigured) return;

  for (const [dbKey, tableName] of Object.entries(tableMap)) {
    const value = DB[dbKey];

    // Delete-all that works regardless of the id column's type
    // (bigint, uuid, text, ...) — every real row has a non-null id.
    const { error: delErr } = await supabase
      .from(tableName)
      .delete()
      .not('id', 'is', null);
    if (delErr) {
      throw new Error(`Failed to clear "${tableName}" before saving: ${delErr.message}`);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const rows = value.map((item) => ({ data: item }));
      const { error } = await supabase.from(tableName).insert(rows);
      if (error) throw new Error(`Failed to save "${tableName}" (${rows.length} item(s)): ${error.message}`);
    } else {
      const { error } = await supabase.from(tableName).insert([{ data: value }]);
      if (error) throw new Error(`Failed to save "${tableName}": ${error.message}`);
    }
  }
}
