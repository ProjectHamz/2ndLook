-- Pass log data the UI reads (lib/secondlook/types.ts). Run once after schema.sql.
-- The app only reads these tables (anon select). Rows are loaded with scripts/seed-sample-data.ts
-- (or, later, the real pipeline) over the direct Postgres connection, not the anon key.

create table if not exists funds (
  id text primary key,
  name text not null,
  sectors text[] not null default '{}',
  stages text[] not null default '{}',
  keywords text[] not null default '{}',
  max_round_size_usd bigint not null
);

create table if not exists companies (
  id text primary key,
  name text not null,
  domain text not null,
  sector text not null,
  stage_at_pass text not null,
  pass_date date not null,
  partner text not null,
  founder_name text not null,
  pass_reason_text text not null,
  objections text[] not null default '{}',
  open_questions text[] not null default '{}'
);

create table if not exists evidence (
  id text primary key,
  company_id text not null references companies (id) on delete cascade,
  source text not null check (source in ('akta_news', 'akta_company', 'edgar')),
  url text not null,
  published_date date not null,
  title text not null,
  quote text not null,
  objection_code text not null,
  llm_label text not null check (llm_label in ('supports', 'contradicts', 'irrelevant')),
  primary_company_match boolean not null,
  tag_maps_to_objection boolean not null,
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative')),
  amount_usd bigint
);
create index if not exists evidence_company_id on evidence (company_id);

alter table funds enable row level security;
alter table companies enable row level security;
alter table evidence enable row level security;

create policy "anon read" on funds for select to anon using (true);
create policy "anon read" on companies for select to anon using (true);
create policy "anon read" on evidence for select to anon using (true);
