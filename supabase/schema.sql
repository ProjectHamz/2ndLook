-- 2ndLook runtime tables. Run once in the Supabase SQL editor.
-- Demo data is synthetic, so the anon key may read and write these three tables (nothing else).

create table if not exists founder_proofs (
  id bigint generated always as identity primary key,
  token text not null,
  milestone text not null,
  url text not null,
  label text not null check (label in ('supports', 'contradicts', 'irrelevant')),
  quote text not null,
  created_at timestamptz not null default now()
);
create index if not exists founder_proofs_token on founder_proofs (token);

create table if not exists deal_leads (
  deal_id text primary key,
  deal_lead text not null,
  follow_up_date date
);

create table if not exists affinity_sync_log (
  id bigint generated always as identity primary key,
  deal_id text not null,
  field text not null,
  value text not null,
  synced_at timestamptz not null default now()
);

alter table founder_proofs enable row level security;
alter table deal_leads enable row level security;
alter table affinity_sync_log enable row level security;

create policy "anon read" on founder_proofs for select to anon using (true);
create policy "anon insert" on founder_proofs for insert to anon with check (true);
create policy "anon read" on deal_leads for select to anon using (true);
create policy "anon insert" on deal_leads for insert to anon with check (true);
create policy "anon update" on deal_leads for update to anon using (true);
create policy "anon read" on affinity_sync_log for select to anon using (true);
create policy "anon insert" on affinity_sync_log for insert to anon with check (true);
