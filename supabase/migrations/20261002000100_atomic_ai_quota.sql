-- Reserve a request before contacting a paid provider. A transaction lock makes
-- concurrent requests from the same account count against the same quota.
create or replace function public.mfa_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    auth.jwt()->>'aal' = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    )
  );
$$;

revoke all on function public.mfa_access_allowed() from public, anon;
grant execute on function public.mfa_access_allowed() to authenticated;

-- An account that opted into MFA must finish its challenge before its data is accessible.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','study_sessions','study_session_activities','user_activity_progress',
    'assessment_attempts','exercise_attempts','user_vocabulary','mistakes',
    'review_schedules','reviews','lesson_progress','unit_progress','skill_progress',
    'writing_submissions','speaking_submissions','ai_feedback','ai_requests',
    'study_events','user_study_state'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select public.mfa_access_allowed())) with check ((select public.mfa_access_allowed()))',
      table_name || '_mfa', table_name
    );
  end loop;
end;
$$;

create policy speaking_audio_mfa on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'speaking-audio' or (select public.mfa_access_allowed()))
  with check (bucket_id <> 'speaking-audio' or (select public.mfa_access_allowed()));

drop policy if exists ai_requests_own on public.ai_requests;
create policy ai_requests_read_own on public.ai_requests for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.reserve_ai_request(p_feature text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_user_id is null or not public.mfa_access_allowed() then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_feature is null or length(p_feature) < 1 or length(p_feature) > 50 then
    raise exception 'Invalid feature' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  if (
    select count(*) from public.ai_requests
    where user_id = v_user_id and created_at >= pg_catalog.clock_timestamp() - interval '1 hour'
  ) >= 20 then
    return null;
  end if;

  insert into public.ai_requests (user_id, feature, model)
  values (v_user_id, p_feature, 'pending') returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.complete_ai_request(
  p_request_id uuid,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_usd numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.mfa_access_allowed() then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_model is null or length(p_model) < 1 or length(p_model) > 100
    or p_input_tokens < 0 or p_output_tokens < 0
    or p_estimated_cost_usd < 0 then
    raise exception 'Invalid usage' using errcode = '22023';
  end if;

  update public.ai_requests
  set model = p_model,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      estimated_cost_usd = p_estimated_cost_usd
  where id = p_request_id and user_id = auth.uid() and model = 'pending';

  if not found then
    raise exception 'Reservation not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.reserve_ai_request(text) from public, anon;
revoke all on function public.complete_ai_request(uuid, text, integer, integer, numeric) from public, anon;
grant execute on function public.reserve_ai_request(text) to authenticated;
grant execute on function public.complete_ai_request(uuid, text, integer, integer, numeric) to authenticated;
