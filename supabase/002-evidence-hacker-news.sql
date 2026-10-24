-- Run once on databases created before Hacker News evidence was allowed.
alter table evidence drop constraint if exists evidence_source_check;
alter table evidence add constraint evidence_source_check
  check (source in ('akta_news', 'akta_company', 'edgar', 'hacker_news'));
