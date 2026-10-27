-- Private live conversation history; no learning grades or raw audio are stored.
create table public.live_conversation_sessions (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (length(course_id) between 1 and 100),
  content_version text not null check (length(content_version) between 1 and 80),
  topic_id text not null check (length(topic_id) between 1 and 140),
  topic jsonb not null check (jsonb_typeof(topic)='object' and octet_length(topic::text)<=14000),
  settings jsonb not null check (jsonb_typeof(settings)='object'),
  request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
  reservation_id uuid not null references public.ai_requests(id),
  provider_id text,
  status text not null default 'starting' check(status in ('starting','active','paused','completed','failed','expired')),
  started_at timestamptz not null default clock_timestamp(),
  deadline_at timestamptz not null default (clock_timestamp()+interval '8 minutes'),
  ended_at timestamptz,
  transcript jsonb not null default '[]'::jsonb check(jsonb_typeof(transcript)='array' and octet_length(transcript::text)<=120000),
  report jsonb check(report is null or (jsonb_typeof(report)='object' and octet_length(report::text)<=15000)),
  report_error text,
  report_claimed_at timestamptz,
  report_attempts integer not null default 0 check(report_attempts between 0 and 3),
  seconds_used integer not null default 0 check(seconds_used between 0 and 7200),
  closure_confirmed boolean not null default false
);
create index live_conversation_owner_started on public.live_conversation_sessions(owner_id,started_at desc);
alter table public.live_conversation_sessions enable row level security;
revoke all on public.live_conversation_sessions from public,anon,authenticated;
grant select(id,course_id,content_version,topic_id,topic,settings,status,started_at,deadline_at,ended_at,transcript,report,report_error,seconds_used,closure_confirmed) on public.live_conversation_sessions to authenticated;
create policy live_conversation_read_own on public.live_conversation_sessions for select to authenticated using (owner_id=(select auth.uid()) and (select public.mfa_access_allowed()));
grant all on public.live_conversation_sessions to service_role;

create or replace function public.reserve_live_conversation(p_id uuid,p_course text,p_version text,p_topic_id text,p_topic jsonb,p_settings jsonb,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); existing public.live_conversation_sessions; reservation uuid; created public.live_conversation_sessions;
begin
 if u is null or not public.mfa_access_allowed() then raise exception 'Authentication required' using errcode='42501';end if;
 if p_id is null or p_course is null or length(p_course) not between 1 and 100 or p_version is null or length(p_version) not between 1 and 80
 or p_topic_id is null or length(p_topic_id) not between 1 and 140 or p_topic is null or jsonb_typeof(p_topic)<>'object' or octet_length(p_topic::text)>14000
 or p_settings is null or jsonb_typeof(p_settings)<>'object' or p_hash is null or p_hash!~'^[a-f0-9]{64}$'
 or (p_settings->>'level') is null or (p_settings->>'level') not in ('beginner','intermediate','advanced')
 or (p_settings->>'correction') is null or (p_settings->>'correction') not in ('immediate','end')
 or (p_settings->>'voice') is null or (p_settings->>'voice') not in ('female','male')
 or (select count(*) from jsonb_object_keys(p_settings))<>3 then raise exception 'Invalid configuration' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(79143303);
 select * into existing from public.live_conversation_sessions where id=p_id;
 if found then
   if existing.owner_id<>u or existing.request_hash<>p_hash
       or existing.course_id is distinct from p_course
       or existing.content_version is distinct from p_version
       or existing.topic_id is distinct from p_topic_id
       or existing.topic is distinct from p_topic
       or existing.settings is distinct from p_settings then raise exception 'LIVE_CONFLICT' using errcode='22023';end if;
   return jsonb_build_object('id',existing.id,'status',existing.status,'deadlineAt',existing.deadline_at,'existing',true);
 end if;
 if exists(select 1 from public.live_conversation_sessions where owner_id=u and ended_at is null)
 then raise exception 'LIVE_ACTIVE' using errcode='P0001';end if;
 if (select count(*) from public.live_conversation_sessions where owner_id=u and started_at>clock_timestamp()-interval '1 hour')>=3
 or (select count(*) from public.live_conversation_sessions where started_at>clock_timestamp()-interval '24 hours')>=12
 then raise exception 'LIVE_LIMIT' using errcode='P0001';end if;
 reservation:=public.reserve_ai_request('live_conversation');
 if reservation is null then raise exception 'LIVE_LIMIT' using errcode='P0001';end if;
 insert into public.live_conversation_sessions(id,owner_id,course_id,content_version,topic_id,topic,settings,request_hash,reservation_id)
 values(p_id,u,p_course,p_version,p_topic_id,p_topic,p_settings,p_hash,reservation) returning * into created;
 return jsonb_build_object('id',created.id,'status',created.status,'deadlineAt',created.deadline_at,'existing',false);
end;$$;
revoke all on function public.reserve_live_conversation(uuid,text,text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.reserve_live_conversation(uuid,text,text,text,jsonb,jsonb,text) to authenticated;

create or replace function public.claim_live_review(p_id uuid,p_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare claimed public.live_conversation_sessions;
begin
 update public.live_conversation_sessions set report_claimed_at=clock_timestamp(),report_attempts=report_attempts+1
 where id=p_id and owner_id=p_owner and ended_at is not null and report is null and report_attempts<3
 and (report_claimed_at is null or report_claimed_at<clock_timestamp()-interval '2 minutes') returning * into claimed;
 if not found then return null;end if;
 return jsonb_build_object('claimedAt',claimed.report_claimed_at,'attempt',claimed.report_attempts);
end;$$;
revoke all on function public.claim_live_review(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_live_review(uuid,uuid) to service_role;
