-- B1: server-authored receipts; client learning projections are never approval authority.
alter table public.interactive_lesson_sessions add column definition_hash text;
alter table public.interactive_lesson_sessions add constraint interactive_definition_hash_format
  check (definition_hash is null or definition_hash ~ '^[a-f0-9]{64}$');
drop policy interactive_lesson_sessions_own on public.interactive_lesson_sessions;
create policy interactive_lesson_sessions_read_own on public.interactive_lesson_sessions
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.interactive_lesson_sessions from public, anon, authenticated;

create table public.interactive_lesson_receipts (
  session_id uuid not null references public.interactive_lesson_sessions(id) on delete cascade,
  attempt_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  result jsonb not null,
  audio_bytes bytea check (audio_bytes is null or octet_length(audio_bytes) between 16044 and 700000),
  created_at timestamptz not null default now(),
  primary key (session_id, attempt_id)
);
alter table public.interactive_lesson_receipts enable row level security;
revoke all on public.interactive_lesson_receipts from public, anon, authenticated, service_role;
grant select on public.interactive_lesson_receipts to service_role;

create function public.save_interactive_lesson_session(
  p_user_id uuid, p_session_id uuid, p_course_id text, p_lesson_id text,
  p_content_version text, p_definition_hash text, p_expected_revision integer,
  p_runtime jsonb, p_attempt jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  saved public.interactive_lesson_sessions%rowtype;
  prior public.interactive_lesson_receipts%rowtype;
  proof jsonb;
  receipt_result jsonb;
  audio bytea;
  v_attempt_id uuid;
  total integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_user_id is null or p_session_id is null then
    raise exception 'LESSON_NOT_AUTHORIZED';
  end if;
  if p_definition_hash !~ '^[a-f0-9]{64}$' or p_runtime->>'schemaVersion' <> '2' or
    p_runtime->'evidenceScope'->>'userId' is distinct from p_user_id::text or
    p_runtime->'evidenceScope'->>'sessionId' is distinct from p_session_id::text or
    p_runtime->'evidenceScope'->>'courseId' is distinct from p_course_id or
    p_runtime->'evidenceScope'->>'lessonId' is distinct from p_lesson_id or
    p_runtime->'evidenceScope'->>'contentVersion' is distinct from p_content_version or
    p_runtime->'evidenceScope'->>'definitionHash' is distinct from p_definition_hash then
    raise exception 'LESSON_INVALID_SCOPE';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_course_id || ':' || p_lesson_id, 0));
  select * into saved from public.interactive_lesson_sessions
    where user_id=p_user_id and course_id=p_course_id and lesson_id=p_lesson_id for update;
  if found then
    if saved.id <> p_session_id or saved.content_version <> p_content_version or
      (saved.definition_hash is not null and saved.definition_hash <> p_definition_hash) then
      raise exception 'LESSON_VERSION_CONFLICT';
    end if;
    if p_attempt is not null then
      v_attempt_id := (p_attempt->>'attemptId')::uuid;
      select * into prior from public.interactive_lesson_receipts
        where session_id=p_session_id and interactive_lesson_receipts.attempt_id=v_attempt_id;
      if found then
        if prior.user_id <> p_user_id or prior.input_hash <> p_attempt->>'inputHash' then
          raise exception 'LESSON_ATTEMPT_CONFLICT';
        end if;
        return jsonb_build_object('id',saved.id,'revision',saved.revision,'runtime_state',saved.runtime_state,'receipt',prior.result);
      end if;
    end if;
    if p_expected_revision is null or saved.revision <> p_expected_revision or saved.revision >= 2147483646 then
      raise exception 'LESSON_REVISION_CONFLICT';
    end if;
  elsif p_expected_revision is not null or p_attempt is not null then
    raise exception 'LESSON_REVISION_CONFLICT';
  end if;

  if p_attempt is not null then
    select count(*) into total from public.interactive_lesson_receipts where session_id=p_session_id;
    if total >= 200 then raise exception 'LESSON_ATTEMPT_LIMIT'; end if;
    proof := p_attempt->'evidence';
    if proof->>'sessionId' is distinct from p_session_id::text or proof->>'userId' is distinct from p_user_id::text or
      proof->>'definitionHash' is distinct from p_definition_hash or proof->>'contentVersion' is distinct from p_content_version or
      proof->>'courseId' is distinct from p_course_id or proof->>'lessonId' is distinct from p_lesson_id or
      proof->>'attemptId' is distinct from v_attempt_id::text or (proof->>'sequence')::integer <> p_expected_revision+1 then
      raise exception 'LESSON_INVALID_SCOPE';
    end if;
    receipt_result := jsonb_build_object('evidence',proof,'answer',p_attempt->>'answer','createdAt',now());
    if proof->>'kind' = 'objective_correct' then
      receipt_result := receipt_result || jsonb_build_object('grade', p_attempt->'grade');
      insert into public.exercise_attempts(id,user_id,activity_id,answer,is_correct,feedback)
        values(v_attempt_id,p_user_id,proof->>'activityId',jsonb_build_object('text',p_attempt->>'answer'),(proof->>'accepted')::boolean,p_attempt->'grade');
    elsif proof->>'kind' = 'writing_submitted' and proof->>'accepted' = 'true' then
      insert into public.writing_submissions(id,user_id,activity_id,text)
        values(v_attempt_id,p_user_id,proof->>'activityId',p_attempt->>'answer');
    elsif proof->>'kind' = 'speaking_submitted' and proof->>'accepted' = 'true' then
      audio := pg_catalog.decode(p_attempt->>'audioBase64','base64');
      if audio is null or octet_length(audio) < 16044 or octet_length(audio) > 700000 then raise exception 'LESSON_INVALID_AUDIO'; end if;
      insert into public.speaking_submissions(id,user_id,activity_id,audio_path,transcription)
        values(v_attempt_id,p_user_id,proof->>'activityId','interactive-receipt:' || p_session_id::text || '/' || v_attempt_id::text,p_attempt->>'answer');
    else raise exception 'LESSON_INVALID_EVIDENCE'; end if;
  end if;

  insert into public.interactive_lesson_sessions(id,user_id,course_id,lesson_id,content_version,definition_hash,
    status,runtime_phase,current_segment_id,playback_position_ms,completed_segment_ids,runtime_path,board_snapshot,resume_anchor_ms,runtime_state,revision,completed_at)
  values(p_session_id,p_user_id,p_course_id,p_lesson_id,p_content_version,p_definition_hash,
    case when p_runtime->>'phase'='completed' then 'completed' when p_runtime->>'phase' in ('paused','intervening') then 'paused' else 'in_progress' end,
    p_runtime->>'phase',(select node->>'segmentId' from jsonb_array_elements(p_runtime->'runtimePath') node where node->>'kind'='canonical' offset (p_runtime->>'segmentIndex')::integer limit 1),
    (p_runtime->>'positionMs')::integer,array(select jsonb_array_elements_text(p_runtime->'completedSegmentIds')),
    p_runtime->'runtimePath',p_runtime->'board',(p_runtime->'resumePoint'->>'anchorMs')::integer,p_runtime,
    coalesce(p_expected_revision,0)+1,case when p_runtime->>'phase'='completed' then now() else null end)
  on conflict (user_id,course_id,lesson_id) do update set
    definition_hash=excluded.definition_hash,status=excluded.status,runtime_phase=excluded.runtime_phase,
    current_segment_id=excluded.current_segment_id,playback_position_ms=excluded.playback_position_ms,
    completed_segment_ids=excluded.completed_segment_ids,runtime_path=excluded.runtime_path,board_snapshot=excluded.board_snapshot,
    resume_anchor_ms=excluded.resume_anchor_ms,runtime_state=excluded.runtime_state,revision=excluded.revision,
    completed_at=excluded.completed_at,updated_at=now()
  returning * into saved;
  if p_attempt is not null then
    insert into public.interactive_lesson_receipts(session_id,attempt_id,user_id,input_hash,result,audio_bytes)
      values(p_session_id,v_attempt_id,p_user_id,p_attempt->>'inputHash',receipt_result,audio);
    insert into public.study_events(user_id,course_id,activity_id,event_type,metadata)
      values(p_user_id,p_course_id,proof->>'activityId',
        case when proof->>'kind'='speaking_submitted' then 'lesson.speaking.attempted'
          when proof->>'kind'='writing_submitted' then 'lesson.checkpoint.submitted'
          when proof->>'accepted'='true' then 'lesson.checkpoint.passed' else 'lesson.checkpoint.failed' end,
        jsonb_build_object('lessonSessionId',p_session_id,'contentVersion',p_content_version,
          'definitionHash',p_definition_hash,'segmentId',proof->>'segmentId','attemptId',v_attempt_id,'kind',proof->>'kind'));

  end if;
  return jsonb_build_object('id',saved.id,'revision',saved.revision,'runtime_state',saved.runtime_state,'receipt',receipt_result);
end $$;
revoke all on function public.save_interactive_lesson_session(uuid,uuid,text,text,text,text,integer,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_interactive_lesson_session(uuid,uuid,text,text,text,text,integer,jsonb,jsonb) to service_role;
