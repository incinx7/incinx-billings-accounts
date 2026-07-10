import { supabase } from './supabaseClient.js';

export async function fetchVendorSubmissions() {
  const { data, error } = await supabase
    .from('vendors')
    .select('id, data, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function markSubmissionStatus(id, status, currentData) {
  const { error } = await supabase
    .from('vendors')
    .update({ data: { ...currentData, status } })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSubmission(id) {
  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) throw error;
}

export async function getAadhaarSignedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from('vendor-documents')
    .createSignedUrl(path, 300);
  if (error) throw error;
  return data?.signedUrl || null;
}