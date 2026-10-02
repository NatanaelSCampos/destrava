-- Claim each product announcement atomically once per authenticated learner.
create table public.user_feature_announcements (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id text not null check (length(announcement_id) between 1 and 80),
  seen_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table public.user_feature_announcements enable row level security;
revoke all on public.user_feature_announcements from public, anon, authenticated;

create or replace function public.claim_feature_announcements(p_ids text[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed text[];
begin
  if auth.uid() is null or not public.mfa_access_allowed() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_ids is null or array_length(p_ids, 1) > 20 or exists (
    select 1 from unnest(p_ids) as id
    where id is null or id !~ '^[a-z0-9][a-z0-9-]{0,79}$'
  ) then
    raise exception 'Invalid announcement ids' using errcode = '22023';
  end if;
  with claimed as (
    insert into public.user_feature_announcements (user_id, announcement_id)
    select auth.uid(), id from (select distinct unnest(p_ids) as id) requested
    on conflict do nothing
    returning announcement_id
  )
  select coalesce(array_agg(announcement_id), array[]::text[]) into v_claimed from claimed;
  return v_claimed;
end;
$$;

revoke all on function public.claim_feature_announcements(text[]) from public, anon;
grant execute on function public.claim_feature_announcements(text[]) to authenticated;

-- A spoken turn uses speech transcription plus one AI reply. Keep separate
-- limits so a learner can complete a 16-turn conversation in one hour.
create or replace function public.reserve_ai_request(p_feature text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_limit integer;
begin
  if v_user_id is null or not public.mfa_access_allowed() then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_feature is null or length(p_feature) < 1 or length(p_feature) > 50 then
    raise exception 'Invalid feature' using errcode = '22023';
  end if;
  v_limit := case when p_feature = 'conversation_transcription' then 40 else 20 end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  if (
    select count(*) from public.ai_requests
    where user_id = v_user_id
      and created_at >= pg_catalog.clock_timestamp() - interval '1 hour'
      and (feature = 'conversation_transcription') = (p_feature = 'conversation_transcription')
  ) >= v_limit then
    return null;
  end if;
  insert into public.ai_requests (user_id, feature, model)
  values (v_user_id, p_feature, 'pending') returning id into v_request_id;
  return v_request_id;
end;
$$;
