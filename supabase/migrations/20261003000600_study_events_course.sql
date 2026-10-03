-- New study events carry an explicit course scope. Older events without a recoverable
-- activity or course marker remain intact and can still be read from user_course_state.
alter table public.study_events
  add column if not exists course_id text references public.courses(id);

update public.study_events events
set course_id = units.course_id
from public.activities activities
join public.lessons lessons on lessons.id = activities.lesson_id
join public.units units on units.id = lessons.unit_id
where events.activity_id = activities.id and events.course_id is null;

update public.study_events events
set course_id = courses.id
from public.courses courses
where events.course_id is null and events.metadata->>'courseId' = courses.id;

create index if not exists study_events_user_course_created_idx
  on public.study_events(user_id, course_id, created_at desc);
