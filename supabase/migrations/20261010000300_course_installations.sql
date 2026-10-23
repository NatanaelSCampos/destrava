-- I7: private immutable snapshots, local approval, transactional selection and pinned evidence.
-- Production publication is disabled. Only a verified local owner may enable the nonce gate.
create schema if not exists destrava_private;
revoke all on schema destrava_private from public, anon, authenticated, service_role;

create table destrava_private.course_installation_local_gate (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  nonce_hash text check (nonce_hash ~ '^[a-f0-9]{64}$'),
  check (not enabled or nonce_hash is not null)
);
insert into destrava_private.course_installation_local_gate(singleton) values (true);

create table destrava_private.course_installations (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check (length(course_id) between 1 and 128),
  content_version text not null check (content_version ~ '^\d+\.\d+(\.\d+)?$'),
  artifact_hash text not null check (artifact_hash ~ '^[a-f0-9]{64}$'),
  reference jsonb not null check (jsonb_typeof(reference) = 'object'),
  inventory jsonb not null check (jsonb_typeof(inventory) = 'array' and jsonb_array_length(inventory) between 1 and 256),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  capability_requirements jsonb not null check (jsonb_typeof(capability_requirements) = 'array'),
  validation jsonb not null check (jsonb_typeof(validation) = 'object'),
  state text not null default 'preparing' check (state in ('preparing','installed','abandoned')),
  preparation text not null default 'not_prepared' check (preparation in ('not_prepared','prepared')),
  approval text not null default 'not_reviewed' check (approval in ('not_reviewed','local_test_approved')),
  created_at timestamptz not null default now(),
  installed_at timestamptz,
  prepared_at timestamptz,
  approved_at timestamptz,
  unique(course_id, content_version), unique(id, course_id),
  check ((reference->>'installationId' = id::text and reference->>'courseId' = course_id and reference->>'contentVersion' = content_version and reference->>'artifactHash' = artifact_hash) is true),
  check ((state = 'installed') = (installed_at is not null)),
  check ((preparation = 'prepared') = (prepared_at is not null)),
  check ((approval = 'local_test_approved') = (approved_at is not null)),
  check (preparation = 'not_prepared' or state = 'installed'),
  check (approval = 'not_reviewed' or preparation = 'prepared')
);
create table destrava_private.course_active_versions (
  course_id text primary key,
  installation_id uuid,
  revision bigint not null default 0 check (revision between 0 and 9007199254740991),
  foreign key(installation_id, course_id) references destrava_private.course_installations(id, course_id)
);
create table destrava_private.course_installation_transitions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  installation_id uuid not null,
  action text not null check (action in ('reserve','confirm','prepare','approve','activate','rollback')),
  actor_id text not null check (length(actor_id) between 1 and 160),
  operation_id uuid,
  revision bigint,
  previous_installation_id uuid references destrava_private.course_installations(id),
  next_installation_id uuid references destrava_private.course_installations(id),
  created_at timestamptz not null default now(),
  foreign key(installation_id,course_id) references destrava_private.course_installations(id,course_id)
);
create table destrava_private.course_activation_operations (
  operation_id uuid primary key,
  request jsonb not null,
  receipt jsonb not null,
  created_at timestamptz not null default now()
);
create table destrava_private.course_version_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  course_id text not null,
  installation_id uuid not null,
  reference jsonb not null check (jsonb_typeof(reference) = 'object'),
  active_revision bigint not null check (active_revision > 0),
  created_at timestamptz not null default now(),
  foreign key(installation_id,course_id) references destrava_private.course_installations(id,course_id),
  unique(id,user_id)
);
create table destrava_private.course_version_evidence (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  session_id uuid not null,
  installation_id uuid not null references destrava_private.course_installations(id),
  payload jsonb not null,
  evidence jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(session_id,user_id) references destrava_private.course_version_sessions(id,user_id)
);
create index course_version_evidence_session_idx on destrava_private.course_version_evidence(user_id,session_id,created_at,id);
create index course_installation_transitions_course_idx on destrava_private.course_installation_transitions(course_id,created_at,id);

-- No direct Data API access, including service-role writes. All writes use checked definer RPCs.
revoke all on all tables in schema destrava_private from public, anon, authenticated, service_role;
alter table destrava_private.course_installations enable row level security;
alter table destrava_private.course_active_versions enable row level security;
alter table destrava_private.course_installation_transitions enable row level security;
alter table destrava_private.course_activation_operations enable row level security;
alter table destrava_private.course_version_sessions enable row level security;
alter table destrava_private.course_version_evidence enable row level security;
alter table destrava_private.course_installation_local_gate enable row level security;

create function destrava_private.i7_service() returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'I7_NOT_AUTHORIZED'; end if;
end $$;
create function destrava_private.i7_local(p_token text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform destrava_private.i7_service();
  if p_token is null or length(p_token) < 16 or length(p_token) > 512 or not exists (
    select 1 from destrava_private.course_installation_local_gate
    where singleton and enabled and nonce_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex')
  ) then raise exception 'I7_NOT_AUTHORIZED'; end if;
end $$;

-- Boundary guards return an explicit boolean or raise; SQL NULL never grants admission.
create function destrava_private.i7_valid_identity(p_value jsonb,p_installed boolean) returns boolean language plpgsql immutable set search_path = '' as $$
declare v_field text;
begin
  if p_installed is null or jsonb_typeof(p_value) is distinct from 'object' then return false; end if;
  if (p_value - array['courseId','contentVersion','contractVersion','envelopeVersion','languageContractVersion','artifactHash','installationId']) is distinct from '{}'::jsonb then return false; end if;
  foreach v_field in array array['courseId','contentVersion','contractVersion','envelopeVersion','languageContractVersion','artifactHash'] loop
    if jsonb_typeof(p_value->v_field) is distinct from 'string' then return false; end if;
  end loop;
  if length(p_value->>'courseId') not between 1 and 128
    or (p_value->>'contentVersion') !~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$'
    or (p_value->>'contractVersion') !~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$'
    or (p_value->>'envelopeVersion') !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
    or (p_value->>'languageContractVersion') !~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$'
    or (p_value->>'artifactHash') !~ '^[a-f0-9]{64}$' then return false; end if;
  if p_installed then
    if jsonb_typeof(p_value->'installationId') is distinct from 'string'
      or coalesce(p_value->>'installationId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return false; end if;
  elsif p_value ? 'installationId' then return false;
  end if;
  return true;
end $$;
create function destrava_private.i7_actor(p_actor text) returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_actor is null or length(p_actor) not between 1 and 160 or btrim(p_actor) = '' then raise exception 'I7_INVALID_INPUT'; end if;
end $$;
create function destrava_private.i7_reservation_input(p_input jsonb) returns void language plpgsql immutable set search_path = '' as $$
declare v_field text; v_item jsonb; v_requirement jsonb; v_alternative jsonb; v_provenance jsonb; v_review jsonb; v_report jsonb; v_editorial jsonb;
begin
  if jsonb_typeof(p_input) is distinct from 'object'
    or (p_input - array['identity','inventory','provenance','capabilityRequirements','validation']) is distinct from '{}'::jsonb
    or destrava_private.i7_valid_identity(p_input->'identity',false) is not true
    or jsonb_typeof(p_input->'inventory') is distinct from 'array'
    or jsonb_typeof(p_input->'provenance') is distinct from 'object'
    or jsonb_typeof(p_input->'capabilityRequirements') is distinct from 'array'
    or jsonb_typeof(p_input->'validation') is distinct from 'object' then raise exception 'I7_INVALID_PACKAGE'; end if;
  if jsonb_array_length(p_input->'inventory') not between 1 and 256 then raise exception 'I7_INVALID_PACKAGE'; end if;
  v_provenance := p_input->'provenance';
  if (v_provenance - array['producer','material']) is distinct from '{}'::jsonb
    or jsonb_typeof(v_provenance->'producer') is distinct from 'object'
    or jsonb_typeof(v_provenance->'material') is distinct from 'object' then raise exception 'I7_INVALID_PACKAGE'; end if;
  if ((v_provenance->'producer') - array['id','name']) is distinct from '{}'::jsonb
    or jsonb_typeof(v_provenance#>'{producer,id}') is distinct from 'string'
    or jsonb_typeof(v_provenance#>'{producer,name}') is distinct from 'string' then raise exception 'I7_INVALID_PACKAGE'; end if;
  if length(v_provenance#>>'{producer,id}') not between 1 and 128 or length(v_provenance#>>'{producer,name}') not between 1 and 160 then raise exception 'I7_INVALID_PACKAGE'; end if;
  if ((v_provenance->'material') - array['material','origin','sources','review']) is distinct from '{}'::jsonb
    or coalesce(v_provenance#>>'{material,material}','') not in ('test','production')
    or coalesce(v_provenance#>>'{material,origin}','') not in ('human','ai_generated','adapted','imported')
    or jsonb_typeof(v_provenance#>'{material,sources}') is distinct from 'array'
    or jsonb_typeof(v_provenance#>'{material,review}') is distinct from 'object' then raise exception 'I7_INVALID_PACKAGE'; end if;
  if jsonb_array_length(v_provenance#>'{material,sources}') > 100 then raise exception 'I7_INVALID_PACKAGE'; end if;
  for v_item in select value from jsonb_array_elements(v_provenance#>'{material,sources}') loop
    if jsonb_typeof(v_item) is distinct from 'object' or (v_item - array['label','reference']) is distinct from '{}'::jsonb
      or jsonb_typeof(v_item->'label') is distinct from 'string' or jsonb_typeof(v_item->'reference') is distinct from 'string' then raise exception 'I7_INVALID_PACKAGE'; end if;
    if length(v_item->>'label') not between 1 and 160 or length(v_item->>'reference') not between 1 and 500 then raise exception 'I7_INVALID_PACKAGE'; end if;
  end loop;
  v_review := v_provenance#>'{material,review}';
  if (v_review - array['status','reviewedBy','reference']) is distinct from '{}'::jsonb
    or coalesce(v_review->>'status','') not in ('draft','review_pending','approved') then raise exception 'I7_INVALID_PACKAGE'; end if;
  foreach v_field in array array['reviewedBy','reference'] loop
    if v_review ? v_field then
      if jsonb_typeof(v_review->v_field) is distinct from 'string' or coalesce(length(v_review->>v_field),0) < 1 then raise exception 'I7_INVALID_PACKAGE'; end if;
    end if;
  end loop;
  if (v_review ? 'reviewedBy' and length(v_review->>'reviewedBy') > 160)
    or (v_review ? 'reference' and length(v_review->>'reference') > 500)
    or (v_review->>'status' = 'approved' and not (v_review ? 'reviewedBy' and v_review ? 'reference')) then raise exception 'I7_INVALID_PACKAGE'; end if;
  for v_requirement in select value from jsonb_array_elements(p_input->'capabilityRequirements') loop
    if jsonb_typeof(v_requirement) is distinct from 'object'
      or (v_requirement - array['id','version','required','data','fallback']) is distinct from '{}'::jsonb
      or jsonb_typeof(v_requirement->'id') is distinct from 'string'
      or jsonb_typeof(v_requirement->'version') is distinct from 'string'
      or jsonb_typeof(v_requirement->'required') is distinct from 'boolean' then raise exception 'I7_INVALID_PACKAGE'; end if;
    if length(btrim(v_requirement->>'id')) < 1 or (v_requirement->>'version') !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
      or (v_requirement ? 'data' and jsonb_typeof(v_requirement->'data') is distinct from 'object') then raise exception 'I7_INVALID_PACKAGE'; end if;
    if v_requirement ? 'fallback' then
      v_alternative := v_requirement->'fallback';
      if v_requirement->'required' is distinct from 'false'::jsonb or jsonb_typeof(v_alternative) is distinct from 'object'
        or (v_alternative - array['id','version','data']) is distinct from '{}'::jsonb
        or jsonb_typeof(v_alternative->'id') is distinct from 'string' or jsonb_typeof(v_alternative->'version') is distinct from 'string' then raise exception 'I7_INVALID_PACKAGE'; end if;
      if length(btrim(v_alternative->>'id')) < 1 or (v_alternative->>'version') !~ '^[0-9]+\.[0-9]+\.[0-9]+$'
        or (v_alternative ? 'data' and jsonb_typeof(v_alternative->'data') is distinct from 'object') then raise exception 'I7_INVALID_PACKAGE'; end if;
    end if;
  end loop;
  v_report := p_input->'validation';
  if (v_report - array['reportVersion','technicallyValid','compatible','preparation','readiness','activation','identity','editorial','diagnostics']) is distinct from '{}'::jsonb
    or v_report->'reportVersion' is distinct from '"1.0.0"'::jsonb
    or v_report->'technicallyValid' is distinct from 'true'::jsonb or v_report->'compatible' is distinct from 'true'::jsonb
    or v_report->'preparation' is distinct from '"prepared"'::jsonb or v_report->'activation' is distinct from '"not_performed"'::jsonb
    or coalesce(v_report->>'readiness','') not in ('ready','unknown','unavailable')
    or jsonb_typeof(v_report->'identity') is distinct from 'object'
    or jsonb_typeof(v_report->'editorial') is distinct from 'object'
    or jsonb_typeof(v_report->'diagnostics') is distinct from 'array' then raise exception 'I7_INVALID_PACKAGE'; end if;
  if ((v_report->'identity') - array['id','contentVersion','envelopeVersion','languageSchema','courseSchema']) is distinct from '{}'::jsonb
    or v_report#>'{identity,id}' is distinct from p_input#>'{identity,courseId}'
    or v_report#>'{identity,contentVersion}' is distinct from p_input#>'{identity,contentVersion}'
    or v_report#>'{identity,envelopeVersion}' is distinct from p_input#>'{identity,envelopeVersion}'
    or v_report#>'{identity,languageSchema}' is distinct from p_input#>'{identity,languageContractVersion}'
    or v_report#>'{identity,courseSchema}' is distinct from p_input#>'{identity,contractVersion}' then raise exception 'I7_INVALID_PACKAGE'; end if;
  v_editorial := v_report->'editorial';
  if (v_editorial - array['declaredApproval','material','producerTrust','administrativeApproval','published','eligibleForPublication']) is distinct from '{}'::jsonb
    or v_editorial->'declaredApproval' is distinct from v_review->'status'
    or v_editorial->'material' is distinct from v_provenance#>'{material,material}'
    or v_editorial->'producerTrust' is distinct from '"unverified"'::jsonb
    or v_editorial->'administrativeApproval' is distinct from '"not_reviewed"'::jsonb
    or v_editorial->'published' is distinct from 'false'::jsonb or v_editorial->'eligibleForPublication' is distinct from 'false'::jsonb then raise exception 'I7_INVALID_PACKAGE'; end if;
  for v_item in select value from jsonb_array_elements(v_report->'diagnostics') loop
    if jsonb_typeof(v_item) is distinct from 'object' or (v_item - array['code','severity','category','document','field','message','resolution','expected','received']) is distinct from '{}'::jsonb then raise exception 'I7_INVALID_PACKAGE'; end if;
    foreach v_field in array array['code','severity','category','document','field','message','resolution'] loop
      if jsonb_typeof(v_item->v_field) is distinct from 'string' then raise exception 'I7_INVALID_PACKAGE'; end if;
    end loop;
    if (v_item->>'code') !~ '^[A-Z][A-Z0-9_]*$' or (v_item->>'severity') not in ('error','warning','info')
      or (v_item->>'category') not in ('security','integrity','structure','semantic','compatibility','editorial') then raise exception 'I7_INVALID_PACKAGE'; end if;
    foreach v_field in array array['expected','received'] loop
      if v_item ? v_field and jsonb_typeof(v_item->v_field) is distinct from 'string' then raise exception 'I7_INVALID_PACKAGE'; end if;
    end loop;
  end loop;
end $$;
create function destrava_private.i7_installation_view(p_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('reference',reference,'inventory',inventory,'provenance',provenance,
    'capabilityRequirements',capability_requirements,'validation',validation,'state',state,
    'preparation',preparation,'approval',approval,'createdAt',created_at,'installedAt',installed_at,
    'preparedAt',prepared_at,'approvedAt',approved_at)
  from destrava_private.course_installations where id = p_id;
$$;
create function destrava_private.i7_session_view(p_id uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',id,'userId',user_id,'reference',reference,'activeRevision',active_revision,'createdAt',created_at)
  from destrava_private.course_version_sessions where id = p_id;
$$;
create function destrava_private.i7_append_transition(p_id uuid,p_action text,p_actor text,p_operation uuid default null,p_revision bigint default null,p_previous uuid default null,p_next uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into destrava_private.course_installation_transitions(course_id,installation_id,action,actor_id,operation_id,revision,previous_installation_id,next_installation_id)
  select course_id,id,p_action,p_actor,p_operation,p_revision,p_previous,p_next from destrava_private.course_installations where id = p_id;
$$;
create function destrava_private.i7_immutable() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'I7_ARTIFACT_INTEGRITY';
end $$;
create function destrava_private.i7_installation_immutable() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  if row(new.id,new.course_id,new.content_version,new.artifact_hash,new.reference,new.inventory,new.provenance,new.capability_requirements,new.validation,new.created_at)
    is distinct from row(old.id,old.course_id,old.content_version,old.artifact_hash,old.reference,old.inventory,old.provenance,old.capability_requirements,old.validation,old.created_at)
    then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  if (old.state <> new.state and (old.state <> 'preparing' or new.state not in ('installed','abandoned')))
    or (old.preparation = 'prepared' and new.preparation <> old.preparation)
    or (old.approval = 'local_test_approved' and new.approval <> old.approval)
    or (old.installed_at is not null and new.installed_at is distinct from old.installed_at)
    or (old.prepared_at is not null and new.prepared_at is distinct from old.prepared_at)
    or (old.approved_at is not null and new.approved_at is distinct from old.approved_at)
    then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  return new;
end $$;
create trigger course_installations_immutable before update or delete on destrava_private.course_installations for each row execute function destrava_private.i7_installation_immutable();
create trigger course_transitions_immutable before update or delete on destrava_private.course_installation_transitions for each row execute function destrava_private.i7_immutable();
create trigger course_operations_immutable before update or delete on destrava_private.course_activation_operations for each row execute function destrava_private.i7_immutable();
create trigger course_sessions_immutable before update or delete on destrava_private.course_version_sessions for each row execute function destrava_private.i7_immutable();
create trigger course_evidence_immutable before update or delete on destrava_private.course_version_evidence for each row execute function destrava_private.i7_immutable();
revoke all on all functions in schema destrava_private from public,anon,authenticated,service_role;

create function public.i7_installation_reserve(p_input jsonb,p_actor_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_row destrava_private.course_installations; v_file jsonb; v_total bigint := 0; v_paths text[] := '{}'; v_has_manifest boolean := false;
begin
  perform destrava_private.i7_service();
  perform destrava_private.i7_actor(p_actor_id);
  perform destrava_private.i7_reservation_input(p_input);
  for v_file in select value from jsonb_array_elements(p_input->'inventory') loop
    if jsonb_typeof(v_file) is distinct from 'object' or (v_file - array['path','bytes','sha256']) is distinct from '{}'::jsonb
      or jsonb_typeof(v_file->'path') is distinct from 'string' or jsonb_typeof(v_file->'sha256') is distinct from 'string'
      or jsonb_typeof(v_file->'bytes') is distinct from 'number' then raise exception 'I7_INVALID_PACKAGE'; end if;
    if (v_file->>'bytes')::numeric <> trunc((v_file->>'bytes')::numeric)
      or (v_file->>'bytes')::numeric not between 1 and 16777216
      or (v_file->>'path' like '%.json' and (v_file->>'bytes')::numeric > 1048576) then raise exception 'I7_INVALID_PACKAGE'; end if;
    -- Match packagePathSchema segment rules; ASCII paths make NFC normalization an identity.
    if coalesce(v_file->>'path','') !~ '^[A-Za-z0-9._/-]+$' or length(v_file->>'path') not between 1 and 240
      or left(v_file->>'path',1) = '/'
      or exists (
        select 1 from unnest(string_to_array(v_file->>'path','/')) as segments(part)
        where part = '' or part in ('.','..') or right(part,1) = '.'
          or part collate pg_catalog."C" ~* '^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)'
      )
      or coalesce(v_file->>'sha256','') !~ '^[a-f0-9]{64}$' or (v_file->>'bytes')::bigint not between 1 and 16777216
      or lower((v_file->>'path') collate pg_catalog."C") = any(v_paths) then raise exception 'I7_INVALID_PACKAGE'; end if;
    v_paths := array_append(v_paths,lower((v_file->>'path') collate pg_catalog."C"));
    v_has_manifest := v_has_manifest or (v_file->>'path') collate pg_catalog."C" = 'manifest.json';
    v_total := v_total + (v_file->>'bytes')::bigint;
  end loop;
  if v_total is null or v_total > 33554432 or v_has_manifest is not true then raise exception 'I7_INVALID_PACKAGE'; end if;
  insert into destrava_private.course_installations(id,course_id,content_version,artifact_hash,reference,inventory,provenance,capability_requirements,validation)
    values(v_id,p_input#>>'{identity,courseId}',p_input#>>'{identity,contentVersion}',p_input#>>'{identity,artifactHash}',
      (p_input->'identity') || jsonb_build_object('installationId',v_id),p_input->'inventory',p_input->'provenance',p_input->'capabilityRequirements',p_input->'validation')
    on conflict(course_id,content_version) do nothing;
  select * into v_row from destrava_private.course_installations where course_id = p_input#>>'{identity,courseId}' and content_version = p_input#>>'{identity,contentVersion}' for update;
  if v_row.artifact_hash is distinct from p_input#>>'{identity,artifactHash}' or (v_row.reference - 'installationId') is distinct from p_input->'identity'
    or v_row.inventory is distinct from p_input->'inventory' or v_row.provenance is distinct from p_input->'provenance' then raise exception 'I7_VERSION_CONFLICT'; end if;
  if v_row.state = 'abandoned' then raise exception 'I7_INSTALLATION_ABANDONED'; end if;
  if v_row.id = v_id then
    insert into destrava_private.course_active_versions(course_id) values(v_row.course_id) on conflict do nothing;
    perform destrava_private.i7_append_transition(v_row.id,'reserve',p_actor_id);
  end if;
  return destrava_private.i7_installation_view(v_row.id);
end $$;
create function public.i7_installation_get(p_installation_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin perform destrava_private.i7_service(); return destrava_private.i7_installation_view(p_installation_id); end $$;
create function public.i7_installation_list(p_course_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform destrava_private.i7_service();
  select coalesce(jsonb_agg(destrava_private.i7_installation_view(id) order by created_at,id),'[]'::jsonb) into v_result from destrava_private.course_installations where course_id = p_course_id;
  return v_result;
end $$;
create function public.i7_installation_confirm(p_installation_id uuid,p_artifact_hash text,p_actor_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row destrava_private.course_installations;
begin
  perform destrava_private.i7_service();
  perform destrava_private.i7_actor(p_actor_id);
  if p_installation_id is null or p_artifact_hash is null or p_artifact_hash !~ '^[a-f0-9]{64}$' then raise exception 'I7_INVALID_INPUT'; end if;
  select * into v_row from destrava_private.course_installations where id = p_installation_id for update;
  if not found then raise exception 'I7_INSTALLATION_NOT_FOUND'; end if;
  if v_row.artifact_hash is distinct from p_artifact_hash then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  if v_row.state = 'abandoned' then raise exception 'I7_INSTALLATION_ABANDONED'; end if;
  if v_row.state = 'preparing' then
    update destrava_private.course_installations set state = 'installed', installed_at = now() where id = p_installation_id;
    perform destrava_private.i7_append_transition(p_installation_id,'confirm',p_actor_id);
  end if;
  return destrava_private.i7_installation_view(p_installation_id);
end $$;
create function public.i7_installation_prepare(p_installation_id uuid,p_artifact_hash text,p_actor_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row destrava_private.course_installations;
begin
  perform destrava_private.i7_service();
  perform destrava_private.i7_actor(p_actor_id);
  if p_installation_id is null or p_artifact_hash is null or p_artifact_hash !~ '^[a-f0-9]{64}$' then raise exception 'I7_INVALID_INPUT'; end if;
  select * into v_row from destrava_private.course_installations where id = p_installation_id for update;
  if not found then raise exception 'I7_INSTALLATION_NOT_FOUND'; end if;
  if v_row.artifact_hash is distinct from p_artifact_hash then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  if v_row.state <> 'installed' then raise exception 'I7_INSTALLATION_INCOMPLETE'; end if;
  if v_row.preparation = 'not_prepared' then
    update destrava_private.course_installations set preparation = 'prepared', prepared_at = now() where id = p_installation_id;
    perform destrava_private.i7_append_transition(p_installation_id,'prepare',p_actor_id);
  end if;
  return destrava_private.i7_installation_view(p_installation_id);
end $$;
create function public.i7_installation_approve(p_installation_id uuid,p_artifact_hash text,p_actor_id text,p_local_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row destrava_private.course_installations;
begin
  perform destrava_private.i7_local(p_local_token);
  perform destrava_private.i7_actor(p_actor_id);
  if p_installation_id is null or p_artifact_hash is null or p_artifact_hash !~ '^[a-f0-9]{64}$' then raise exception 'I7_INVALID_INPUT'; end if;
  select * into v_row from destrava_private.course_installations where id = p_installation_id for update;
  if not found then raise exception 'I7_INSTALLATION_NOT_FOUND'; end if;
  if v_row.artifact_hash is distinct from p_artifact_hash then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  if v_row.state <> 'installed' then raise exception 'I7_INSTALLATION_INCOMPLETE'; end if;
  if v_row.preparation <> 'prepared' then raise exception 'I7_INSTALLATION_NOT_PREPARED'; end if;
  if v_row.approval = 'not_reviewed' then
    update destrava_private.course_installations set approval = 'local_test_approved', approved_at = now() where id = p_installation_id;
    perform destrava_private.i7_append_transition(p_installation_id,'approve',p_actor_id);
  end if;
  return destrava_private.i7_installation_view(p_installation_id);
end $$;
create function public.i7_installation_active(p_course_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform destrava_private.i7_service();
  select jsonb_build_object('courseId',course_id,'installationId',installation_id,'revision',revision) into v_result from destrava_private.course_active_versions where course_id = p_course_id;
  return coalesce(v_result,jsonb_build_object('courseId',p_course_id,'installationId',null,'revision',0));
end $$;
create function public.i7_installation_activate(p_command jsonb,p_action text,p_reference jsonb,p_actor_id text,p_local_token text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_operation uuid; v_target uuid; v_expected_numeric numeric; v_expected_revision bigint;
  v_request jsonb; v_receipt jsonb; v_previous uuid; v_pointer destrava_private.course_active_versions;
  v_row destrava_private.course_installations; v_old destrava_private.course_activation_operations;
begin
  perform destrava_private.i7_local(p_local_token);
  perform destrava_private.i7_actor(p_actor_id);
  if p_action is null or p_action not in ('activate','rollback')
    or jsonb_typeof(p_command) is distinct from 'object'
    or destrava_private.i7_valid_identity(p_reference,true) is not true then raise exception 'I7_INVALID_INPUT'; end if;
  if (p_command - array['courseId','installationId','expectedRevision','operationId']) is distinct from '{}'::jsonb
    or jsonb_typeof(p_command->'courseId') is distinct from 'string'
    or jsonb_typeof(p_command->'installationId') is distinct from 'string'
    or jsonb_typeof(p_command->'operationId') is distinct from 'string'
    or jsonb_typeof(p_command->'expectedRevision') is distinct from 'number' then raise exception 'I7_INVALID_INPUT'; end if;
  if length(p_command->>'courseId') not between 1 and 128
    or (p_command->>'installationId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or (p_command->>'operationId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'I7_INVALID_INPUT'; end if;
  v_expected_numeric := (p_command->>'expectedRevision')::numeric;
  if v_expected_numeric is null or v_expected_numeric <> trunc(v_expected_numeric)
    or v_expected_numeric not between 0 and 9007199254740991 then raise exception 'I7_INVALID_INPUT'; end if;
  v_expected_revision := v_expected_numeric::bigint;
  v_operation := (p_command->>'operationId')::uuid;
  v_target := (p_command->>'installationId')::uuid;
  if p_reference->>'courseId' is distinct from p_command->>'courseId'
    or (p_reference->>'installationId')::uuid is distinct from v_target then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  v_request := p_command || jsonb_build_object('action',p_action,'reference',p_reference,'actorId',p_actor_id);
  perform pg_advisory_xact_lock(hashtextextended(v_operation::text,0));
  select * into v_old from destrava_private.course_activation_operations where operation_id = v_operation;
  if found then
    if v_old.request is distinct from v_request then raise exception 'I7_OPERATION_CONFLICT'; end if;
    return v_old.receipt;
  end if;
  select * into v_pointer from destrava_private.course_active_versions where course_id = p_command->>'courseId' for update;
  if not found then raise exception 'I7_INSTALLATION_NOT_FOUND'; end if;
  if v_pointer.revision is distinct from v_expected_revision then raise exception 'I7_REVISION_CONFLICT'; end if;
  select * into v_row from destrava_private.course_installations where id = v_target and course_id = v_pointer.course_id;
  if not found then raise exception 'I7_INSTALLATION_NOT_FOUND'; end if;
  if v_row.reference is distinct from p_reference then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  if v_row.state <> 'installed' then raise exception 'I7_INSTALLATION_INCOMPLETE'; end if;
  if v_row.preparation <> 'prepared' then raise exception 'I7_INSTALLATION_NOT_PREPARED'; end if;
  if v_row.approval <> 'local_test_approved' then raise exception 'I7_INSTALLATION_NOT_APPROVED'; end if;
  v_previous := v_pointer.installation_id;
  update destrava_private.course_active_versions set installation_id = v_target, revision = revision + 1 where course_id = v_pointer.course_id returning * into v_pointer;
  v_receipt := jsonb_build_object('operationId',v_operation,'action',p_action,'actorId',p_actor_id,
    'previousInstallationId',v_previous,'selection',jsonb_build_object('courseId',v_pointer.course_id,'installationId',v_target,'revision',v_pointer.revision),
    'reference',v_row.reference,'createdAt',now());
  insert into destrava_private.course_activation_operations(operation_id,request,receipt) values(v_operation,v_request,v_receipt);
  perform destrava_private.i7_append_transition(v_target,p_action,p_actor_id,v_operation,v_pointer.revision,v_previous,v_target);
  return v_receipt;
end $$;
create function public.i7_installation_transitions(p_course_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform destrava_private.i7_service();
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'courseId',course_id,'installationId',installation_id,'action',action,'actorId',actor_id,
    'operationId',operation_id,'revision',revision,'previousInstallationId',previous_installation_id,'nextInstallationId',next_installation_id,'createdAt',created_at)
    order by created_at,id),'[]'::jsonb) into v_result from destrava_private.course_installation_transitions where course_id = p_course_id;
  return v_result;
end $$;
create function public.i7_session_open(p_user_id uuid,p_course_id text,p_session_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session destrava_private.course_version_sessions; v_pointer destrava_private.course_active_versions; v_reference jsonb;
begin
  perform destrava_private.i7_service();
  if p_user_id is null or p_session_id is null or p_course_id is null or length(p_course_id) not between 1 and 128 then raise exception 'I7_INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text,1));
  select * into v_session from destrava_private.course_version_sessions where id = p_session_id;
  if found then
    if v_session.user_id is distinct from p_user_id or v_session.course_id is distinct from p_course_id then raise exception 'I7_SESSION_CONFLICT'; end if;
    return destrava_private.i7_session_view(p_session_id);
  end if;
  select * into v_pointer from destrava_private.course_active_versions where course_id = p_course_id for share;
  if not found or v_pointer.installation_id is null then raise exception 'I7_NO_ACTIVE_VERSION'; end if;
  select reference into v_reference from destrava_private.course_installations where id = v_pointer.installation_id and state = 'installed';
  if not found then raise exception 'I7_INSTALLATION_INCOMPLETE'; end if;
  insert into destrava_private.course_version_sessions(id,user_id,course_id,installation_id,reference,active_revision)
    values(p_session_id,p_user_id,p_course_id,v_pointer.installation_id,v_reference,v_pointer.revision);
  return destrava_private.i7_session_view(p_session_id);
end $$;
create function public.i7_session_get(p_user_id uuid,p_session_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform destrava_private.i7_service();
  if not exists(select 1 from destrava_private.course_version_sessions where id = p_session_id and user_id = p_user_id) then return null; end if;
  return destrava_private.i7_session_view(p_session_id);
end $$;
create function public.i7_evidence_append(p_user_id uuid,p_session_id uuid,p_reference jsonb,p_evidence jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_session destrava_private.course_version_sessions; v_old destrava_private.course_version_evidence;
  v_id uuid; v_result jsonb; v_payload jsonb;
begin
  perform destrava_private.i7_service();
  if p_user_id is null or p_session_id is null or jsonb_typeof(p_evidence) is distinct from 'object'
    or destrava_private.i7_valid_identity(p_reference,true) is not true then raise exception 'I7_INVALID_INPUT'; end if;
  if (p_evidence - array['id','kind','definitionId','input','result']) is distinct from '{}'::jsonb
    or jsonb_typeof(p_evidence->'id') is distinct from 'string'
    or jsonb_typeof(p_evidence->'kind') is distinct from 'string'
    or jsonb_typeof(p_evidence->'definitionId') is distinct from 'string'
    or not (p_evidence ? 'input' and p_evidence ? 'result') then raise exception 'I7_INVALID_INPUT'; end if;
  if (p_evidence->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or (p_evidence->>'kind') not in ('activity','assessment','learning_policy')
    or length(p_evidence->>'definitionId') not between 1 and 1024
    or coalesce(octet_length((p_evidence->'input')::text),1048577) > 1048576
    or coalesce(octet_length((p_evidence->'result')::text),1048577) > 1048576 then raise exception 'I7_INVALID_INPUT'; end if;
  v_id := (p_evidence->>'id')::uuid;
  select * into v_session from destrava_private.course_version_sessions where id = p_session_id and user_id = p_user_id;
  if not found then raise exception 'I7_SESSION_NOT_FOUND'; end if;
  if v_session.reference is distinct from p_reference then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  v_payload := p_evidence || jsonb_build_object('userId',p_user_id,'sessionId',p_session_id,'reference',v_session.reference);
  perform pg_advisory_xact_lock(hashtextextended(v_id::text,2));
  select * into v_old from destrava_private.course_version_evidence where id = v_id;
  if found then
    if v_old.payload is distinct from v_payload then raise exception 'I7_EVIDENCE_CONFLICT'; end if;
    return v_old.evidence;
  end if;
  v_result := v_payload || jsonb_build_object('createdAt',now());
  insert into destrava_private.course_version_evidence(id,user_id,session_id,installation_id,payload,evidence)
    values(v_id,p_user_id,p_session_id,v_session.installation_id,v_payload,v_result);
  return v_result;
end $$;
create function public.i7_evidence_list(p_user_id uuid,p_session_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform destrava_private.i7_service();
  if not exists(select 1 from destrava_private.course_version_sessions where id = p_session_id and user_id = p_user_id) then raise exception 'I7_SESSION_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(evidence order by created_at,id),'[]'::jsonb) into v_result from destrava_private.course_version_evidence where user_id = p_user_id and session_id = p_session_id;
  return v_result;
end $$;

-- Every exposed function is server-service only; no authenticated/anonymous activation bypass.
revoke all on function public.i7_installation_reserve(jsonb,text), public.i7_installation_get(uuid), public.i7_installation_list(text),
  public.i7_installation_confirm(uuid,text,text), public.i7_installation_prepare(uuid,text,text), public.i7_installation_approve(uuid,text,text,text),
  public.i7_installation_active(text), public.i7_installation_activate(jsonb,text,jsonb,text,text), public.i7_installation_transitions(text),
  public.i7_session_open(uuid,text,uuid), public.i7_session_get(uuid,uuid), public.i7_evidence_append(uuid,uuid,jsonb,jsonb), public.i7_evidence_list(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.i7_installation_reserve(jsonb,text), public.i7_installation_get(uuid), public.i7_installation_list(text),
  public.i7_installation_confirm(uuid,text,text), public.i7_installation_prepare(uuid,text,text), public.i7_installation_approve(uuid,text,text,text),
  public.i7_installation_active(text), public.i7_installation_activate(jsonb,text,jsonb,text,text), public.i7_installation_transitions(text),
  public.i7_session_open(uuid,text,uuid), public.i7_session_get(uuid,uuid), public.i7_evidence_append(uuid,uuid,jsonb,jsonb), public.i7_evidence_list(uuid,uuid)
  to service_role;

insert into storage.buckets(id,name,public,file_size_limit) values('course-artifacts','course-artifacts',false,16777216);
-- No storage.objects policy grants learners access to this bucket. The server serves only manifest.assets.

-- These triggers protect installed Storage metadata, not physical WORM storage or owner/root access.
-- A provider may change physical bytes before its SQL mutation fails; consumers must fail closed.
-- The application uses upsert:false and uncached complete hash verification on every resolution.
-- This increment retains incomplete objects for retry; it exposes no garbage-collection bypass.
create function destrava_private.i7_storage_immutable() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.bucket_id = 'course-artifacts' and exists (
    select 1 from destrava_private.course_installations
    where id::text = split_part(old.name,'/',1) and state = 'installed'
  ) then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  if tg_op = 'UPDATE' and new.bucket_id = 'course-artifacts' and exists (
    select 1 from destrava_private.course_installations
    where id::text = split_part(new.name,'/',1) and state = 'installed'
  ) then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger course_artifact_objects_immutable before update or delete on storage.objects
  for each row execute function destrava_private.i7_storage_immutable();
create function destrava_private.i7_bucket_private() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.id = 'course-artifacts' then
    if tg_op = 'DELETE' then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
    if new.id <> old.id or new.name <> old.name or new.public then raise exception 'I7_ARTIFACT_INTEGRITY'; end if;
  elsif tg_op = 'UPDATE' and new.id = 'course-artifacts' then
    raise exception 'I7_ARTIFACT_INTEGRITY';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger course_artifact_bucket_private before update or delete on storage.buckets
  for each row execute function destrava_private.i7_bucket_private();
revoke all on function destrava_private.i7_storage_immutable(),destrava_private.i7_bucket_private() from public,anon,authenticated,service_role;
