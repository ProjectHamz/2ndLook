/**
 * The only runtime writes: founder proofs, deal leads and the Affinity write-back log.
 * SERVER ONLY. Uses Supabase when SUPABASE_URL and SUPABASE_ANON_KEY are set; otherwise an
 * in-memory store, so local dev and tests work without a database (it resets on restart).
 * Tables: supabase/schema.sql.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AffinitySyncRow, DealLeadRow, FounderProofRow } from "./types";

let client: SupabaseClient | null | undefined;

function supabase(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  }
  return client;
}

const memory = {
  founder_proofs: [] as FounderProofRow[],
  deal_leads: new Map<string, DealLeadRow>(),
  affinity_sync_log: [] as AffinitySyncRow[],
};

async function rows<T>(table: string): Promise<T[]> {
  const db = supabase()!;
  const { data, error } = await db.from(table).select("*");
  if (error) throw new Error(`Supabase ${table}: ${error.message}`);
  return (data ?? []) as T[];
}

async function insert(table: string, row: object, upsertOn?: string): Promise<void> {
  const db = supabase()!;
  const q = upsertOn ? db.from(table).upsert(row, { onConflict: upsertOn }) : db.from(table).insert(row);
  const { error } = await q;
  if (error) throw new Error(`Supabase ${table}: ${error.message}`);
}

export async function listFounderProofs(): Promise<FounderProofRow[]> {
  return supabase() ? rows<FounderProofRow>("founder_proofs") : [...memory.founder_proofs];
}

export async function addFounderProof(row: Omit<FounderProofRow, "created_at">): Promise<FounderProofRow> {
  const full = { ...row, created_at: new Date().toISOString() };
  if (supabase()) await insert("founder_proofs", full);
  else memory.founder_proofs.push(full);
  return full;
}

export async function listDealLeads(): Promise<DealLeadRow[]> {
  return supabase() ? rows<DealLeadRow>("deal_leads") : [...memory.deal_leads.values()];
}

export async function setDealLead(row: DealLeadRow): Promise<DealLeadRow> {
  if (supabase()) await insert("deal_leads", row, "deal_id");
  else memory.deal_leads.set(row.deal_id, row);
  return row;
}

export async function listAffinitySyncs(): Promise<AffinitySyncRow[]> {
  return supabase() ? rows<AffinitySyncRow>("affinity_sync_log") : [...memory.affinity_sync_log];
}

export async function logAffinitySync(row: Omit<AffinitySyncRow, "synced_at">): Promise<AffinitySyncRow> {
  const full = { ...row, synced_at: new Date().toISOString() };
  if (supabase()) await insert("affinity_sync_log", full);
  else memory.affinity_sync_log.push(full);
  return full;
}
