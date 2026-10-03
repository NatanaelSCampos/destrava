-- Course-scoped pedagogical preferences extend the existing enrollment projection.
-- The full study state remains in user_course_state; neither table is reset.
alter table public.user_course_profiles
  add column if not exists learning_preferences jsonb not null default
    '{"goal":"general","contexts":[],"skillPriorities":[],"skillWeights":{"speaking":0.6,"listening":0.6,"reading":0.6,"writing":0.6},"preferredSessionMinutes":15}'::jsonb,
  add column if not exists self_reported_level text,
  add column if not exists onboarding_step integer not null default 0;

alter table public.user_course_profiles
  add constraint user_course_profiles_self_reported_level_check
  check (self_reported_level is null or self_reported_level in
    ('zero','basic','simple_conversation','comfortable','advanced','unknown'));

update public.user_course_profiles as profile
set learning_preferences = state.state->'profile'->'learningPreferences',
    self_reported_level = state.state->'profile'->>'selfReportedLevel',
    onboarding_step = coalesce((state.state->'profile'->>'onboardingStep')::integer, 0)
from public.user_course_state as state
where state.user_id = profile.user_id and state.course_id = profile.course_id
  and jsonb_typeof(state.state->'profile'->'learningPreferences') = 'object';

-- Existing own-row and restrictive MFA RLS policies remain in force.
