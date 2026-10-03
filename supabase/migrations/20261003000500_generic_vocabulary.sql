-- Preserve existing Spanish values while allowing vocabulary from any target language.
alter table public.vocabulary_items add column if not exists term text;
update public.vocabulary_items set term = spanish where term is null;
alter table public.vocabulary_items alter column term set not null;
alter table public.vocabulary_items alter column spanish drop not null;
