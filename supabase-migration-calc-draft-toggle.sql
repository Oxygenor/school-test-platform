-- Run once in the SQL editor of the live Supabase project to add
-- per-work toggles for the calculator and draft (чернетка) tools.
alter table public.works
  add column if not exists calculator_enabled boolean not null default true,
  add column if not exists draft_enabled boolean not null default true;
