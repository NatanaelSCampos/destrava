create table public.interactive_lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.courses(id),
  lesson_id text not null references public.lessons(id),
  content_version text not null,
  status text not null check (status in ('in_progress','paused','completed')),
  runtime_phase text not null,
  current_segment_id text not null,
  playback_position_ms integer not null default 0 check (playback_position_ms >= 0),
  completed_segment_ids text[] not null default '{}',
  runtime_path jsonb not null default '[]'::jsonb,
  board_snapshot jsonb not null default '{}'::jsonb,
  resume_anchor_ms integer check (resume_anchor_ms >= 0),
  runtime_state jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(user_id, course_id, lesson_id)
);
create index interactive_lesson_sessions_user_course_updated_idx
  on public.interactive_lesson_sessions(user_id, course_id, updated_at desc);
alter table public.interactive_lesson_sessions enable row level security;
create policy interactive_lesson_sessions_own on public.interactive_lesson_sessions
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy interactive_lesson_sessions_mfa on public.interactive_lesson_sessions
  as restrictive for all to authenticated
  using ((select public.mfa_access_allowed()))
  with check ((select public.mfa_access_allowed()));
