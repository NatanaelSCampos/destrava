-- Content is shared; learning data belongs to auth.users.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  goal text not null default '',
  daily_minutes integer not null default 45 check (daily_minutes between 5 and 180),
  days_per_week integer not null default 4 check (days_per_week between 1 and 7),
  current_level text not null default 'A1',
  prior_knowledge text not null default 'none' check (prior_knowledge in ('none','some','returning')),
  timezone text not null default 'America/Sao_Paulo',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

create table public.courses (
  id text primary key, slug text not null unique, title text not null, level text not null,
  description text not null default '', active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.units (
  id text primary key, course_id text not null references public.courses(id) on delete cascade,
  slug text not null, title text not null, number integer not null check (number > 0),
  description text not null default '', objectives jsonb not null default '[]'::jsonb,
  active boolean not null default true, unique(course_id, slug), unique(course_id, number)
);
create table public.lessons (
  id text primary key, unit_id text not null references public.units(id) on delete cascade,
  slug text not null, title text not null, eyebrow text not null default '', description text not null default '',
  position integer not null check (position > 0), estimated_minutes integer not null default 5,
  active boolean not null default true, unique(unit_id, slug), unique(unit_id, position)
);
create table public.activities (
  id text primary key, lesson_id text not null references public.lessons(id) on delete cascade,
  type text not null check (type in ('lesson_content','multiple_choice','true_false','fill_blank','matching','ordering','short_answer','writing','listening','speaking','flashcard','review','quiz')),
  title text not null, prompt text not null default '', skill text not null check (skill in ('vocabulary','grammar','listening','writing','speaking','reading')),
  position integer not null check (position > 0), estimated_minutes integer not null default 2,
  payload jsonb not null default '{}'::jsonb, source_reference jsonb,
  schema_version integer not null default 1, active boolean not null default true,
  unique(lesson_id, position)
);
create table public.activity_options (
  activity_id text not null references public.activities(id) on delete cascade,
  position integer not null check (position > 0), label text not null,
  primary key(activity_id, position)
);
create table public.activity_answers (
  activity_id text primary key references public.activities(id) on delete cascade,
  answer jsonb not null
);
create table public.vocabulary_items (
  id text primary key, unit_id text not null references public.units(id) on delete cascade,
  lesson_id text references public.lessons(id) on delete set null,
  spanish text not null, translation text not null, example text not null default '',
  position integer not null default 0, active boolean not null default true
);
create table public.assessments (
  id text primary key, unit_id text not null references public.units(id) on delete cascade,
  title text not null, passing_score integer not null default 75 check (passing_score between 0 and 100),
  active boolean not null default true
);
create table public.assessment_items (
  assessment_id text not null references public.assessments(id) on delete cascade,
  activity_id text not null references public.activities(id) on delete cascade,
  position integer not null check (position > 0),
  primary key(assessment_id, activity_id), unique(assessment_id, position)
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  unit_id text not null references public.units(id), started_at timestamptz not null default now(),
  finished_at timestamptz, duration_seconds integer not null default 0 check (duration_seconds >= 0),
  performance jsonb not null default '{}'::jsonb,
  unique(id, user_id), check (finished_at is null or finished_at >= started_at)
);
create table public.study_session_activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null, activity_id text not null references public.activities(id),
  position integer not null check (position > 0), planned_minutes integer not null default 0,
  started_at timestamptz, finished_at timestamptz, performance jsonb not null default '{}'::jsonb,
  foreign key(session_id, user_id) references public.study_sessions(id, user_id) on delete cascade,
  unique(session_id, position)
);
create table public.user_activity_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id),
  completed_at timestamptz not null default now(),
  primary key(user_id, activity_id)
);
create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id text not null references public.assessments(id), started_at timestamptz not null default now(),
  finished_at timestamptz, objective_score numeric(5,2), result jsonb,
  unique(id, user_id)
);
create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id), session_id uuid, assessment_attempt_id uuid,
  answer jsonb not null, is_correct boolean, score numeric(5,2), feedback jsonb,
  attempted_at timestamptz not null default now(),
  foreign key(session_id, user_id) references public.study_sessions(id, user_id),
  foreign key(assessment_attempt_id, user_id) references public.assessment_attempts(id, user_id)
);
create table public.user_vocabulary (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_item_id text not null references public.vocabulary_items(id) on delete cascade,
  status text not null default 'new' check (status in ('new','learning','known','difficult')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, vocabulary_item_id), unique(id, user_id)
);
create table public.mistakes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  unit_id text not null references public.units(id), activity_id text not null references public.activities(id),
  category text not null check (category in ('grammar','vocabulary','spelling','listening','writing','speaking','reading')),
  original_answer text not null, correct_answer text not null, explanation text not null default '',
  times_missed integer not null default 1 check (times_missed >= 0), times_correct integer not null default 0 check (times_correct >= 0),
  last_missed_at timestamptz not null default now(), last_reviewed_at timestamptz,
  unique(user_id, activity_id, category), unique(id, user_id)
);
create table public.review_schedules (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  user_vocabulary_id uuid, mistake_id uuid,
  next_review_at timestamptz not null default now(), interval_days integer not null default 0,
  ease_factor numeric(4,2) not null default 2.50, review_count integer not null default 0,
  mastery_score integer not null default 0 check (mastery_score between 0 and 100),
  consecutive_correct integer not null default 0,
  foreign key(user_vocabulary_id, user_id) references public.user_vocabulary(id, user_id) on delete cascade,
  foreign key(mistake_id, user_id) references public.mistakes(id, user_id) on delete cascade,
  check ((user_vocabulary_id is null) <> (mistake_id is null)), unique(id, user_id)
);
create unique index review_schedules_one_vocabulary on public.review_schedules(user_vocabulary_id) where user_vocabulary_id is not null;
create unique index review_schedules_one_mistake on public.review_schedules(mistake_id) where mistake_id is not null;
create table public.reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid not null, is_correct boolean not null, reviewed_at timestamptz not null default now(),
  interval_before integer not null, interval_after integer not null,
  foreign key(schedule_id, user_id) references public.review_schedules(id, user_id) on delete cascade
);
create table public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade, lesson_id text not null references public.lessons(id),
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  completed_at timestamptz, updated_at timestamptz not null default now(), primary key(user_id, lesson_id)
);
create table public.unit_progress (
  user_id uuid not null references auth.users(id) on delete cascade, unit_id text not null references public.units(id),
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  completed_at timestamptz, mastered_at timestamptz,
  exercise_score numeric(5,2), review_score numeric(5,2), assessment_score numeric(5,2),
  updated_at timestamptz not null default now(), primary key(user_id, unit_id)
);
create table public.skill_progress (
  user_id uuid not null references auth.users(id) on delete cascade, course_id text not null references public.courses(id),
  skill text not null check (skill in ('vocabulary','grammar','listening','writing','speaking','reading')),
  practiced_count integer not null default 0, correct_count integer not null default 0, completed_count integer not null default 0,
  updated_at timestamptz not null default now(), primary key(user_id, course_id, skill)
);
create table public.writing_submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id), assessment_attempt_id uuid,
  text text not null, created_at timestamptz not null default now(),
  foreign key(assessment_attempt_id, user_id) references public.assessment_attempts(id, user_id),
  unique(id, user_id)
);
create table public.speaking_submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id), audio_path text,
  transcription text, feedback jsonb,
  pronunciation_score numeric(5,2), grammar_score numeric(5,2), vocabulary_score numeric(5,2),
  created_at timestamptz not null default now(), unique(id, user_id)
);
create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  writing_submission_id uuid, speaking_submission_id uuid,
  feature text not null, payload jsonb not null, created_at timestamptz not null default now(),
  foreign key(writing_submission_id, user_id) references public.writing_submissions(id, user_id) on delete cascade,
  foreign key(speaking_submission_id, user_id) references public.speaking_submissions(id, user_id) on delete cascade
);
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null, model text not null, input_tokens integer not null default 0,
  output_tokens integer not null default 0, estimated_cost_usd numeric(12,6),
  created_at timestamptz not null default now()
);
create table public.study_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, activity_id text references public.activities(id),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
-- A compact, account-scoped read model keeps the interactive client resumable.
-- Normalized tables above remain the reporting and audit projection.
create table public.user_study_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index exercise_attempts_user_date on public.exercise_attempts(user_id, attempted_at desc);
create index study_sessions_user_date on public.study_sessions(user_id, started_at desc);
create index review_schedules_due on public.review_schedules(user_id, next_review_at);
create index study_events_user_date on public.study_events(user_id, created_at desc);
create index ai_requests_user_date on public.ai_requests(user_id, created_at desc);

-- Content: authenticated users read active records. Answers are never exposed through the Data API.
alter table public.courses enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.activities enable row level security;
alter table public.activity_options enable row level security;
alter table public.activity_answers enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_items enable row level security;
create policy courses_read on public.courses for select to authenticated using (active);
create policy units_read on public.units for select to authenticated using (active);
create policy lessons_read on public.lessons for select to authenticated using (active);
create policy activities_read on public.activities for select to authenticated using (active);
create policy activity_options_read on public.activity_options for select to authenticated using (exists (select 1 from public.activities where id = activity_id and active));
create policy vocabulary_read on public.vocabulary_items for select to authenticated using (active);
create policy assessments_read on public.assessments for select to authenticated using (active);
create policy assessment_items_read on public.assessment_items for select to authenticated using (exists (select 1 from public.assessments where id = assessment_id and active));
revoke all on public.activity_answers from anon, authenticated;

-- Every student table is scoped by auth.uid(). RLS also protects access from direct Data API calls.
alter table public.profiles enable row level security;
create policy profiles_own on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'study_sessions','study_session_activities','user_activity_progress','assessment_attempts','exercise_attempts',
    'user_vocabulary','mistakes','review_schedules','reviews','lesson_progress','unit_progress',
    'skill_progress','writing_submissions','speaking_submissions','ai_feedback','ai_requests','study_events','user_study_state'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name || '_own', table_name);
  end loop;
end $$;

-- Private speaking files live under <user-id>/<submission-id>.<extension>.
insert into storage.buckets(id, name, public) values ('speaking-audio', 'speaking-audio', false) on conflict (id) do nothing;
create policy speaking_audio_read on storage.objects for select to authenticated
  using (bucket_id = 'speaking-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy speaking_audio_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'speaking-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy speaking_audio_update on storage.objects for update to authenticated
  using (bucket_id = 'speaking-audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'speaking-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
