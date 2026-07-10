// Data sync helpers for the app's own data (the `app_data` table).
// These now go through the authenticated Supabase client (see
// supabaseClient.js), so Row Level Security can require a logged-in
// session instead of trusting the bare anon key for everything.

import { supabase } from './supabaseClient.js';

export const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

/** Loads all rows from app_data and reassembles them into the DB shape. */
export async function supabaseLoad(emptyDbShape) {
  if (!supabaseConfigured) return null;
  const { data: rows, error } = await supabase.from('app_data').select('section,data').limit(1000);
  if (error) throw error;

  const db = structuredClone(emptyDbShape);
  (rows || []).forEach((row) => {
    if (Array.isArray(db[row.section])) db[row.section].push(row.data);
    else db[row.section] = row.data;
  });
  return db;
}

/** Saves the full DB object back to Supabase, one bulk request per section. */
export async function supabaseSave(DB) {
  if (!supabaseConfigured) return;
  for (const section of Object.keys(DB)) {
    const data = DB[section];
    const { error: delErr } = await supabase.from('app_data').delete().eq('section', section);
    if (delErr) throw new Error(`Failed to clear "${section}" before saving: ${delErr.message}`);

    if (Array.isArray(data)) {
      if (data.length === 0) continue;
      const rows = data.map((item) => ({ section, data: item }));
      // Single bulk insert instead of one request per row — far fewer round
      // trips, and no risk of a partial save if one row in a long loop fails.
      const { error } = await supabase.from('app_data').insert(rows);
      if (error) throw new Error(`Failed to save "${section}" (${rows.length} item(s)): ${error.message}`);
    } else {
      const { error } = await supabase.from('app_data').insert({ section, data });
      if (error) throw new Error(`Failed to save "${section}": ${error.message}`);
    }
  }
}
