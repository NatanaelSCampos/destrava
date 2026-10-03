alter table public.mistakes
  add column course_id text references public.courses(id),
  add column language_code text,
  add column topic_id text,
  add column last_correct_at timestamptz;

update public.mistakes m
set course_id = u.course_id, language_code = 'es'
from public.units u
where u.id = m.unit_id and m.course_id is null;

alter table public.mistakes
  alter column course_id set not null,
  alter column language_code set not null;

create index mistakes_user_course on public.mistakes(user_id, course_id, last_missed_at desc);
