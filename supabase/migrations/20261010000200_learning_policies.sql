-- Prepared locally; depends on the explicit assessments migration. Not applied remotely.
alter table public.units add column if not exists learning_policy jsonb;
alter table public.unit_progress add column if not exists content_version text;
alter table public.unit_progress add column if not exists participation_percent integer check (participation_percent between 0 and 100);
alter table public.unit_progress add column if not exists policy_state jsonb;
-- No backfill guesses: existing aggregates are not reclassified as current policy outcomes.
