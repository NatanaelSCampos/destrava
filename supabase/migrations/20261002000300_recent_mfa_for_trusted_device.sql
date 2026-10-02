-- Creating a remembered browser is a sensitive action. Require a fresh code,
-- even though an existing AAL2 session can access study data for 30 days.
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
  if v_user_id is null or auth.jwt()->>'aal' <> 'aal2'
    or not exists (
      select 1 from pg_catalog.jsonb_array_elements(
        coalesce(auth.jwt()->'amr', '[]'::jsonb)
      ) as amr_entry(value)
      where amr_entry.value->>'method' in ('totp', 'phone', 'webauthn')
        and (amr_entry.value->>'timestamp')::bigint >=
          extract(epoch from now() - interval '5 minutes')::bigint
    )
    or p_token is null or p_token !~ '^[0-9a-f]{64}$'
    or not exists (
      select 1 from auth.mfa_factors
      where id = p_factor_id and user_id = v_user_id and status = 'verified'
    ) then
    raise exception 'Recent MFA required' using errcode = '42501';
  end if;

  delete from public.trusted_devices
  where user_id = v_user_id and expires_at <= now();

  insert into public.trusted_devices(user_id, factor_id, token_hash)
  values (v_user_id, p_factor_id, pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')))
  returning id into v_id;

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
