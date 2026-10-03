-- A course owns its learning state. The old per-user snapshot stays as a read-only
-- compatibility source until every existing learner has saved a course state.
create table if not exists public.user_course_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id),
  language_code text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table public.user_course_state enable row level security;
create policy user_course_state_own on public.user_course_state
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into public.user_course_state (user_id, course_id, language_code, state, updated_at)
select old.user_id, courses.course_id, coalesce(courses.state->>'languageCode', 'es'), courses.state, old.updated_at
from public.user_study_state old
cross join lateral (
  select key as course_id, value as state
  from jsonb_each(coalesce(old.state->'courses', '{}'::jsonb))
  where old.state->>'schemaVersion' = '2'
  union all
  select 'frecuencias-a1', old.state
  where old.state->>'schemaVersion' is distinct from '2'
) courses
join public.courses c on c.id = courses.course_id
on conflict (user_id, course_id) do nothing;

create table if not exists public.user_review_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id),
  target_kind text not null check (target_kind in ('structure', 'pronunciation')),
  target_id text not null,
  payload jsonb not null default '{}'::jsonb,
  schedule jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, target_kind, target_id)
);
alter table public.user_review_targets enable row level security;
create policy user_review_targets_own on public.user_review_targets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create index user_review_targets_course on public.user_review_targets(user_id, course_id, target_kind);
