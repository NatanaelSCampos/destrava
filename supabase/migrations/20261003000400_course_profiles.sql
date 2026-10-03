-- Preserve account profiles; course goals and preferences live in a separate projection.
create table if not exists public.user_course_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  goal text not null default '',
  daily_minutes integer not null default 45 check (daily_minutes between 5 and 180),
  days_per_week integer not null default 4 check (days_per_week between 1 and 7),
  current_level text not null default 'A1',
  prior_knowledge text not null default 'none',
  variant_id text not null default 'general',
  onboarding_completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

alter table public.user_course_profiles enable row level security;
create policy user_course_profiles_own on public.user_course_profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy user_course_profiles_mfa on public.user_course_profiles
  as restrictive for all to authenticated
  using ((select public.mfa_access_allowed()))
  with check ((select public.mfa_access_allowed()));

insert into public.user_course_profiles (
  user_id, course_id, goal, daily_minutes, days_per_week,
  current_level, prior_knowledge, variant_id, onboarding_completed_at, updated_at
)
select user_id, course_id,
  coalesce(state->'profile'->>'goal', ''),
  coalesce((state->'profile'->>'dailyMinutes')::integer, 45),
  coalesce((state->'profile'->>'daysPerWeek')::integer, 4),
  coalesce(state->'profile'->>'level', 'A1'),
  coalesce(state->'profile'->>'priorKnowledge', 'none'),
  coalesce(state->'profile'->>'variantId', state->'profile'->>'spanishRegion', 'general'),
  case when coalesce((state->'profile'->>'onboarded')::boolean, false) then updated_at else null end,
  updated_at
from public.user_course_state
on conflict (user_id, course_id) do nothing;
