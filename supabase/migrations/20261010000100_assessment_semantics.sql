-- Prepared locally for review. No interpretation of legacy IDs or quiz markers.
alter table public.courses add column if not exists content_version text;
alter table public.courses add column if not exists assessment_refs jsonb not null default '{}'::jsonb;
alter table public.units add column if not exists assessment_refs jsonb not null default '{}'::jsonb;
alter table public.assessments add column if not exists course_id text references public.courses(id) on delete cascade;
alter table public.assessments add column if not exists lesson_id text references public.lessons(id) on delete set null;
alter table public.assessments add column if not exists purpose text check (purpose in ('diagnostic', 'formative', 'summative'));
alter table public.assessments add column if not exists method text check (method in ('adaptive', 'fixed'));
alter table public.assessments add column if not exists definition jsonb;
-- Existing associations are structural; their purpose remains unknown until an explicit seed.
update public.assessments as assessment
set course_id = unit.course_id
from public.units as unit
where assessment.unit_id = unit.id and assessment.course_id is null;
alter table public.assessments alter column unit_id drop not null;
alter table public.assessments alter column course_id set not null;
-- Insufficient evidence has no numeric score. It must not be stored as zero.
alter table public.assessment_attempts alter column objective_score drop not null;
