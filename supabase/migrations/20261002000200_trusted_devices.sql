-- A remembered browser is a second possession factor for at most 30 days.
-- The random token stays in an HttpOnly cookie; only its SHA-256 digest is stored.
create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  factor_id uuid not null,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index trusted_devices_user_id_idx on public.trusted_devices(user_id);
alter table public.trusted_devices enable row level security;
revoke all on public.trusted_devices from public, anon, authenticated;

create table public.trusted_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.trusted_devices(id) on delete cascade,
  expires_at timestamptz not null
);

create index trusted_sessions_device_id_idx on public.trusted_sessions(device_id);
alter table public.trusted_sessions enable row level security;
revoke all on public.trusted_sessions from public, anon, authenticated;

create or replace function public.recent_mfa_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.jwt()->>'aal' = 'aal2' and exists (
    select 1 from pg_catalog.jsonb_array_elements(
      coalesce(auth.jwt()->'amr', '[]'::jsonb)
    ) as amr_entry(value)
    where amr_entry.value->>'method' in ('totp', 'phone', 'webauthn')
      and (amr_entry.value->>'timestamp')::bigint >=
        extract(epoch from now() - interval '30 days')::bigint
  );
$$;

create or replace function public.register_trusted_device(p_token text, p_factor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.recent_mfa_verified()
    or p_token is null or p_token !~ '^[0-9a-f]{64}$'
    or not exists (
      select 1 from auth.mfa_factors
      where id = p_factor_id and user_id = v_user_id and status = 'verified'
    ) then
    raise exception 'Verified MFA required' using errcode = '42501';
  end if;

  delete from public.trusted_devices
  where user_id = v_user_id and expires_at <= now();

  insert into public.trusted_devices(user_id, factor_id, token_hash)
  values (v_user_id, p_factor_id, pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')))
  returning id into v_id;

  -- Bound the number of active remembered browsers per account.
  delete from public.trusted_devices
  where user_id = v_user_id and id in (
    select id from public.trusted_devices
    where user_id = v_user_id
    order by created_at desc, id desc
    offset 10
  );
  return v_id;
end;
$$;

create or replace function public.resume_trusted_device(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_device public.trusted_devices%rowtype;
begin
  if v_user_id is null or auth.jwt()->>'session_id' is null
    or p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  v_session_id := (auth.jwt()->>'session_id')::uuid;

  select d.* into v_device from public.trusted_devices d
  where d.user_id = v_user_id
    and d.token_hash = pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'))
    and d.expires_at > now()
    and exists (
      select 1 from auth.mfa_factors f
      where f.id = d.factor_id and f.user_id = v_user_id and f.status = 'verified'
    )
  for update;
  if not found then return false; end if;

  insert into public.trusted_sessions(session_id, user_id, device_id, expires_at)
  values (v_session_id, v_user_id, v_device.id, v_device.expires_at)
  on conflict (session_id) do update
    set user_id = excluded.user_id,
        device_id = excluded.device_id,
        expires_at = excluded.expires_at;
  update public.trusted_devices set last_used_at = now() where id = v_device.id;
  return true;
end;
$$;

create or replace function public.mfa_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    public.recent_mfa_verified()
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    )
    or exists (
      select 1 from public.trusted_sessions s
      join public.trusted_devices d on d.id = s.device_id
      where s.session_id::text = auth.jwt()->>'session_id'
        and s.user_id = auth.uid() and d.user_id = auth.uid()
        and s.expires_at > now() and d.expires_at > now()
        and exists (
          select 1 from auth.mfa_factors f
          where f.id = d.factor_id and f.user_id = auth.uid() and f.status = 'verified'
        )
    )
  );
$$;

create or replace function public.list_trusted_devices()
returns table (id uuid, created_at timestamptz, last_used_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.created_at, d.last_used_at, d.expires_at
  from public.trusted_devices d
  where d.user_id = auth.uid() and d.expires_at > now()
    and public.mfa_access_allowed()
    and exists (
      select 1 from auth.mfa_factors f
      where f.id = d.factor_id and f.user_id = auth.uid() and f.status = 'verified'
    )
  order by d.created_at desc;
$$;

create or replace function public.revoke_trusted_device(p_device_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.mfa_access_allowed() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  delete from public.trusted_devices where id = p_device_id and user_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.register_trusted_device(text, uuid) from public, anon;
revoke all on function public.recent_mfa_verified() from public, anon;
revoke all on function public.resume_trusted_device(text) from public, anon;
revoke all on function public.list_trusted_devices() from public, anon;
revoke all on function public.revoke_trusted_device(uuid) from public, anon;
grant execute on function public.register_trusted_device(text, uuid) to authenticated;
grant execute on function public.recent_mfa_verified() to authenticated;
grant execute on function public.resume_trusted_device(text) to authenticated;
grant execute on function public.list_trusted_devices() to authenticated;
grant execute on function public.revoke_trusted_device(uuid) to authenticated;
