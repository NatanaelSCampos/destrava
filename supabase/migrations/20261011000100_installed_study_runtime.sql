-- I8: per-user selection and per-immutable-installation learning snapshots.
-- Private RPCs only. I7's local test gate starts disabled and has no HTTP issuer.
create table destrava_private.runtime_course_selections (
  user_id uuid primary key references auth.users(id),
  source text not null check (source in ('compiled','installed')),
  course_id text not null check (length(course_id) between 1 and 128),
  version_session_id uuid,
  revision bigint not null check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null default now(),
  foreign key(version_session_id,user_id) references destrava_private.course_version_sessions(id,user_id),
  check ((source = 'installed') = (version_session_id is not null))
);
create table destrava_private.runtime_selection_operations (
  user_id uuid not null references auth.users(id),
  operation_id uuid not null,
  command jsonb not null check (jsonb_typeof(command) = 'object'),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  created_at timestamptz not null default now(),
  primary key(user_id,operation_id)
);
create table destrava_private.installed_study_progress (
  user_id uuid not null references auth.users(id),
  installation_id uuid not null references destrava_private.course_installations(id),
  reference jsonb not null check (destrava_private.i7_valid_identity(reference,true) is true),
  revision bigint not null check (revision between 1 and 9007199254740991),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now(),
  primary key(user_id,installation_id),
  check ((reference->>'installationId' = installation_id::text) is true)
);
create table destrava_private.installed_progress_operations (
  user_id uuid not null references auth.users(id),
  operation_id uuid not null,
  installation_id uuid not null references destrava_private.course_installations(id),
  command jsonb not null check (jsonb_typeof(command) = 'object'),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  created_at timestamptz not null default now(),
  primary key(user_id,operation_id)
);
create index course_version_evidence_installation_idx
  on destrava_private.course_version_evidence(user_id,installation_id,created_at,id);

alter table destrava_private.runtime_course_selections enable row level security;
alter table destrava_private.runtime_selection_operations enable row level security;
alter table destrava_private.installed_study_progress enable row level security;
alter table destrava_private.installed_progress_operations enable row level security;
revoke all on destrava_private.runtime_course_selections,
  destrava_private.runtime_selection_operations, destrava_private.installed_study_progress,
  destrava_private.installed_progress_operations from public,anon,authenticated,service_role;

create function destrava_private.i8_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform destrava_private.i7_service();
  if p_user_id is null then raise exception 'I8_INVALID_INPUT'; end if;
end $$;
create function destrava_private.i8_installed_allowed() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform destrava_private.i7_service();
  if not exists(select 1 from destrava_private.course_installation_local_gate where singleton and enabled)
    then raise exception 'I8_NOT_AUTHORIZED'; end if;
end $$;
create function destrava_private.i8_revision(p_value jsonb) returns bigint
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'number' or p_value::text !~ '^[0-9]+$'
    then raise exception 'I8_INVALID_INPUT'; end if;
  if p_value::numeric < 0 or p_value::numeric > 9007199254740991
    then raise exception 'I8_INVALID_INPUT'; end if;
  return p_value::text::bigint;
end $$;
create function destrava_private.i8_owned_version(p_user_id uuid,p_reference jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform destrava_private.i8_user(p_user_id);
  perform destrava_private.i8_installed_allowed();
  if destrava_private.i7_valid_identity(p_reference,true) is not true
    then raise exception 'I8_INVALID_INPUT'; end if;
  if not exists(
    select 1 from destrava_private.course_version_sessions s
    join destrava_private.course_installations i on i.id=s.installation_id
    where s.user_id=p_user_id and s.reference=p_reference and i.reference=p_reference
      and i.state='installed' and i.preparation='prepared' and i.approval='local_test_approved'
  ) then raise exception 'I8_SESSION_CONFLICT'; end if;
end $$;
create function destrava_private.i8_selection_view(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('schemaVersion',1,'userId',user_id,'revision',revision,
      'selection',case when source='installed' then
        jsonb_build_object('source',source,'courseId',course_id,'versionSessionId',version_session_id)
        else jsonb_build_object('source',source,'courseId',course_id) end,
      'updatedAt',updated_at)
      from destrava_private.runtime_course_selections where user_id=p_user_id),
    jsonb_build_object('schemaVersion',1,'userId',p_user_id,'revision',0,'selection',null,'updatedAt',null)
  );
$$;
create function destrava_private.i8_progress_view(p_user_id uuid,p_installation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('userId',user_id,'reference',reference,'revision',revision,
    'state',state,'updatedAt',updated_at)
  from destrava_private.installed_study_progress
  where user_id=p_user_id and installation_id=p_installation_id;
$$;
create function destrava_private.i8_state(p_state jsonb,p_reference jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare v_key text;
begin
  if jsonb_typeof(p_state) is distinct from 'object'
    or coalesce(octet_length(p_state::text),1048577)>1048576
    or jsonb_typeof(p_state->'courseId') is distinct from 'string'
    or p_state->>'courseId' is distinct from p_reference->>'courseId'
    or jsonb_typeof(p_state->'languageCode') is distinct from 'string'
    or jsonb_typeof(p_state->'profile') is distinct from 'object'
    then raise exception 'I8_INVALID_INPUT'; end if;
  foreach v_key in array array['completedActivityIds','attempts','sessions','events','reviews',
    'assessmentAttempts','writing','speaking','structureAttempts','numberAttempts','regionalAttempts',
    'microLessonAttempts','conversations','imageDescriptions','adaptiveAssessments'] loop
    if jsonb_typeof(p_state->v_key) is distinct from 'array' then raise exception 'I8_INVALID_INPUT'; end if;
  end loop;
  foreach v_key in array array['vocabulary','mistakes','structureReviews','pronunciationReviews'] loop
    if jsonb_typeof(p_state->v_key) is distinct from 'object' then raise exception 'I8_INVALID_INPUT'; end if;
  end loop;
  if not(p_state ? 'activeSessionId') or
    (jsonb_typeof(p_state->'activeSessionId') is distinct from 'null'
      and jsonb_typeof(p_state->'activeSessionId') is distinct from 'string')
    then raise exception 'I8_INVALID_INPUT'; end if;
end $$;
create function destrava_private.i8_progress_identity_immutable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.user_id is distinct from new.user_id or old.installation_id is distinct from new.installation_id
    or old.reference is distinct from new.reference then raise exception 'I8_SESSION_CONFLICT'; end if;
  return new;
end $$;
create trigger installed_progress_identity_immutable before update
  on destrava_private.installed_study_progress for each row
  execute function destrava_private.i8_progress_identity_immutable();
create trigger runtime_selection_receipt_immutable before update or delete
  on destrava_private.runtime_selection_operations for each row execute function destrava_private.i7_immutable();
create trigger installed_progress_receipt_immutable before update or delete
  on destrava_private.installed_progress_operations for each row execute function destrava_private.i7_immutable();

create function public.i8_selection_get(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform destrava_private.i8_user(p_user_id);
  return destrava_private.i8_selection_view(p_user_id);
end $$;
create function public.i8_selection_receipt(p_user_id uuid,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform destrava_private.i8_user(p_user_id);
  if p_operation_id is null then raise exception 'I8_INVALID_INPUT'; end if;
  select jsonb_build_object('command',command,'result',receipt) into v_result
    from destrava_private.runtime_selection_operations
    where user_id=p_user_id and operation_id=p_operation_id;
  return v_result;
end $$;
create function public.i8_active_list() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform destrava_private.i7_service();
  if not exists(select 1 from destrava_private.course_installation_local_gate where singleton and enabled)
    then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('courseId',a.course_id,
    'installationId',a.installation_id,'revision',a.revision) order by a.course_id),'[]'::jsonb)
    into v_result from destrava_private.course_active_versions a
    join destrava_private.course_installations i on i.id=a.installation_id and i.course_id=a.course_id
    where i.state='installed' and i.preparation='prepared' and i.approval='local_test_approved';
  return v_result;
end $$;
create function public.i8_selection_select(
  p_user_id uuid,p_command jsonb,p_active_selection jsonb default null,p_reference jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_expected bigint; v_operation uuid; v_course text; v_source text; v_old jsonb;
  v_receipt jsonb; v_revision bigint; v_pointer destrava_private.course_active_versions;
  v_installation destrava_private.course_installations; v_session uuid;
begin
  perform destrava_private.i8_user(p_user_id);
  if jsonb_typeof(p_command) is distinct from 'object'
    or (p_command-array['source','courseId','expectedRevision','operationId']) is distinct from '{}'::jsonb
    or jsonb_typeof(p_command->'source') is distinct from 'string'
    or coalesce(p_command->>'source','') not in ('compiled','installed')
    or jsonb_typeof(p_command->'courseId') is distinct from 'string'
    or length(p_command->>'courseId') not between 1 and 128 or btrim(p_command->>'courseId')=''
    or jsonb_typeof(p_command->'operationId') is distinct from 'string'
    or coalesce(p_command->>'operationId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then raise exception 'I8_INVALID_INPUT'; end if;
  v_expected:=destrava_private.i8_revision(p_command->'expectedRevision');
  v_operation:=(p_command->>'operationId')::uuid;
  v_source:=p_command->>'source'; v_course:=p_command->>'courseId';
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,8));
  select command,receipt into v_old,v_receipt from destrava_private.runtime_selection_operations
    where user_id=p_user_id and operation_id=v_operation;
  if found then
    if v_old is distinct from p_command then raise exception 'I8_OPERATION_CONFLICT'; end if;
    return v_receipt;
  end if;
  select revision into v_revision from destrava_private.runtime_course_selections
    where user_id=p_user_id for update;
  v_revision:=coalesce(v_revision,0);
  if v_revision is distinct from v_expected or v_revision>=9007199254740991
    then raise exception 'I8_SELECTION_CONFLICT'; end if;
  if v_source='installed' then
    perform destrava_private.i8_installed_allowed();
    if jsonb_typeof(p_active_selection) is distinct from 'object'
      or (p_active_selection-array['courseId','installationId','revision']) is distinct from '{}'::jsonb
      or p_active_selection->>'courseId' is distinct from v_course
      or destrava_private.i7_valid_identity(p_reference,true) is not true
      or p_reference->>'courseId' is distinct from v_course
      or p_active_selection->>'installationId' is distinct from p_reference->>'installationId'
      then raise exception 'I8_INVALID_INPUT'; end if;
    perform destrava_private.i8_revision(p_active_selection->'revision');
    select * into v_pointer from destrava_private.course_active_versions where course_id=v_course for share;
    if not found or v_pointer.installation_id is null then raise exception 'I8_NO_ACTIVE_VERSION'; end if;
    if v_pointer.installation_id::text is distinct from p_reference->>'installationId'
      or v_pointer.revision is distinct from destrava_private.i8_revision(p_active_selection->'revision')
      then raise exception 'I8_SELECTION_CONFLICT'; end if;
    select * into v_installation from destrava_private.course_installations
      where id=v_pointer.installation_id and course_id=v_course;
    if not found or v_installation.reference is distinct from p_reference
      or v_installation.state<>'installed' or v_installation.preparation<>'prepared'
      or v_installation.approval<>'local_test_approved' then raise exception 'I8_INTEGRATION_UNAVAILABLE'; end if;
    v_session:=gen_random_uuid();
    perform public.i7_session_open(p_user_id,v_course,v_session);
  elsif p_active_selection is not null or p_reference is not null then
    raise exception 'I8_INVALID_INPUT';
  end if;
  insert into destrava_private.runtime_course_selections(user_id,source,course_id,version_session_id,revision)
    values(p_user_id,v_source,v_course,v_session,v_revision+1)
    on conflict(user_id) do update set source=excluded.source,course_id=excluded.course_id,
      version_session_id=excluded.version_session_id,revision=excluded.revision,updated_at=now();
  v_receipt:=destrava_private.i8_selection_view(p_user_id);
  insert into destrava_private.runtime_selection_operations(user_id,operation_id,command,receipt)
    values(p_user_id,v_operation,p_command,v_receipt);
  return v_receipt;
end $$;

create function public.i8_progress_read(p_user_id uuid,p_reference jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform destrava_private.i8_owned_version(p_user_id,p_reference);
  v_result:=destrava_private.i8_progress_view(p_user_id,(p_reference->>'installationId')::uuid);
  if v_result is not null and v_result->'reference' is distinct from p_reference
    then raise exception 'I8_READ_FAILED'; end if;
  return v_result;
end $$;
create function public.i8_progress_write(
  p_user_id uuid,p_session_id uuid,p_reference jsonb,p_command jsonb,p_state jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_expected bigint; v_operation uuid; v_installation uuid; v_revision bigint; v_old jsonb;
  v_receipt jsonb; v_stored_ref jsonb; v_old_installation uuid;
begin
  perform destrava_private.i8_owned_version(p_user_id,p_reference);
  if p_session_id is null or not exists(
    select 1 from destrava_private.course_version_sessions
    where id=p_session_id and user_id=p_user_id and reference=p_reference
  ) then raise exception 'I8_SESSION_CONFLICT'; end if;
  if jsonb_typeof(p_command) is distinct from 'object'
    or (p_command-array['versionSessionId','expectedRevision','operationId','state']) is distinct from '{}'::jsonb
    or jsonb_typeof(p_command->'versionSessionId') is distinct from 'string'
    or p_command->>'versionSessionId' is distinct from p_session_id::text
    or jsonb_typeof(p_command->'operationId') is distinct from 'string'
    or coalesce(p_command->>'operationId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then raise exception 'I8_INVALID_INPUT'; end if;
  perform destrava_private.i8_state(p_command->'state',p_reference);
  perform destrava_private.i8_state(p_state,p_reference);
  v_expected:=destrava_private.i8_revision(p_command->'expectedRevision');
  v_operation:=(p_command->>'operationId')::uuid;
  v_installation:=(p_reference->>'installationId')::uuid;
  -- Lock operation namespace, then version row. A command cannot cross versions on retry.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||v_operation::text,9));
  select command,receipt,installation_id into v_old,v_receipt,v_old_installation
    from destrava_private.installed_progress_operations
    where user_id=p_user_id and operation_id=v_operation;
  if found then
    if v_old is distinct from p_command or v_old_installation is distinct from v_installation
      then raise exception 'I8_OPERATION_CONFLICT'; end if;
    return v_receipt;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||v_installation::text,10));
  select revision,reference into v_revision,v_stored_ref from destrava_private.installed_study_progress
    where user_id=p_user_id and installation_id=v_installation for update;
  v_revision:=coalesce(v_revision,0);
  if v_revision is distinct from v_expected or v_revision>=9007199254740991
    then raise exception 'I8_PROGRESS_CONFLICT'; end if;
  if v_stored_ref is not null and v_stored_ref is distinct from p_reference
    then raise exception 'I8_SESSION_CONFLICT'; end if;
  insert into destrava_private.installed_study_progress(user_id,installation_id,reference,revision,state)
    values(p_user_id,v_installation,p_reference,v_revision+1,p_state)
    on conflict(user_id,installation_id) do update
      set revision=excluded.revision,state=excluded.state,updated_at=now();
  v_receipt:=destrava_private.i8_progress_view(p_user_id,v_installation);
  insert into destrava_private.installed_progress_operations(user_id,operation_id,installation_id,command,receipt)
    values(p_user_id,v_operation,v_installation,p_command,v_receipt);
  return v_receipt;
end $$;
create function public.i8_version_evidence_list(p_user_id uuid,p_reference jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_installation uuid;
begin
  perform destrava_private.i8_owned_version(p_user_id,p_reference);
  v_installation:=(p_reference->>'installationId')::uuid;
  if exists(select 1 from destrava_private.course_version_evidence e
    join destrava_private.course_version_sessions s on s.id=e.session_id and s.user_id=e.user_id
    where e.user_id=p_user_id and e.installation_id=v_installation
      and (s.reference is distinct from p_reference or e.evidence->'reference' is distinct from p_reference))
    then raise exception 'I8_READ_FAILED'; end if;
  select coalesce(jsonb_agg(e.evidence order by e.created_at,e.id),'[]'::jsonb) into v_result
    from destrava_private.course_version_evidence e
    join destrava_private.course_version_sessions s on s.id=e.session_id and s.user_id=e.user_id
    where e.user_id=p_user_id and e.installation_id=v_installation and s.reference=p_reference;
  return v_result;
end $$;

revoke all on function destrava_private.i8_user(uuid),destrava_private.i8_installed_allowed(),
  destrava_private.i8_revision(jsonb),destrava_private.i8_owned_version(uuid,jsonb),
  destrava_private.i8_selection_view(uuid),destrava_private.i8_progress_view(uuid,uuid),
  destrava_private.i8_state(jsonb,jsonb),destrava_private.i8_progress_identity_immutable()
  from public,anon,authenticated,service_role;
revoke all on function public.i8_selection_get(uuid),public.i8_selection_receipt(uuid,uuid),
  public.i8_active_list(),public.i8_selection_select(uuid,jsonb,jsonb,jsonb),
  public.i8_progress_read(uuid,jsonb),public.i8_progress_write(uuid,uuid,jsonb,jsonb,jsonb),
  public.i8_version_evidence_list(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.i8_selection_get(uuid),public.i8_selection_receipt(uuid,uuid),
  public.i8_active_list(),public.i8_selection_select(uuid,jsonb,jsonb,jsonb),
  public.i8_progress_read(uuid,jsonb),public.i8_progress_write(uuid,uuid,jsonb,jsonb,jsonb),
  public.i8_version_evidence_list(uuid,jsonb) to service_role;
