-- Supabase automatically re-links OAuth identities with a verified matching email.
-- Keep a separate account preference so removing Google prevents a new login.
create table public.google_login_blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default now()
);

alter table public.google_login_blocks enable row level security;
revoke all on public.google_login_blocks from public, anon, authenticated;
grant select on public.google_login_blocks to supabase_auth_admin;
create policy google_login_blocks_auth_hook_read on public.google_login_blocks
  for select to supabase_auth_admin using (true);

create or replace function public.google_login_is_blocked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.google_login_blocks where user_id = auth.uid()
  );
$$;

create or replace function public.set_google_login_blocked(p_blocked boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_blocked is null or not public.mfa_access_allowed() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_blocked then
    if not exists (
      select 1 from auth.identities
      where user_id = v_user_id and provider = 'email'
    ) then
      raise exception 'An email identity is required' using errcode = '42501';
    end if;
    insert into public.google_login_blocks(user_id) values (v_user_id)
    on conflict (user_id) do nothing;
  else
    -- A previous Google session cannot re-enable its own access.
    if not exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) as entry(value)
      where entry.value->>'method' = 'password'
    ) then
      raise exception 'Sign in with your password to re-enable Google' using errcode = '42501';
    end if;
    delete from public.google_login_blocks where user_id = v_user_id;
  end if;
  return true;
end;
$$;

-- Invoked by Supabase Auth before a token is issued. Google is the only
-- social provider enabled in this application, so OAuth means Google here.
create or replace function public.google_login_access_token_hook(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if (
    event->>'authentication_method' = 'oauth'
    or exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(event->'claims'->'amr', '[]'::jsonb)) as entry(value)
      where entry.value->>'method' = 'oauth'
    )
  ) and exists (
    select 1 from public.google_login_blocks
    where user_id::text = event->>'user_id'
  ) then
    return pg_catalog.jsonb_build_object(
      'error', pg_catalog.jsonb_build_object(
        'http_code', 403,
        'message', 'GOOGLE_LOGIN_DISABLED: Use email and password.'
      )
    );
  end if;
  return event;
end;
$$;

revoke all on function public.google_login_is_blocked() from public, anon;
revoke all on function public.set_google_login_blocked(boolean) from public, anon;
revoke all on function public.google_login_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.google_login_is_blocked() to authenticated;
grant execute on function public.set_google_login_blocked(boolean) to authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.google_login_access_token_hook(jsonb) to supabase_auth_admin;
