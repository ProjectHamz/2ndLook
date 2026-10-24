/**
 * Shared Supabase client. SERVER ONLY. Null when SUPABASE_URL / SUPABASE_ANON_KEY aren't set,
 * so callers can fall back to local data. SUPABASE_URL is the https Project URL, not postgresql://.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  }
  return client;
}
