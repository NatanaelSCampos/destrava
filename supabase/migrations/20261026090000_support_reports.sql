-- Private, bounded report queue. Only the application service may submit/claim.
create table public.support_reports (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null, payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 release_ref text not null, status text not null default 'queued' check(status in ('queued','sending','posted','needs_review')),
 claim_token uuid, lease_until timestamptz, issue_url text, created_at timestamptz not null default now(),
 check(octet_length(payload::text) <= 2400000),
 constraint support_report_consent check ((payload->'consent'='true'::jsonb) is true and (payload->>'id'=id::text) is true)
);
alter table public.support_reports enable row level security;
revoke all on public.support_reports from anon, authenticated;
grant select(id,owner_id,status,issue_url,created_at) on public.support_reports to authenticated;
create policy support_report_owner on public.support_reports for select to authenticated using(owner_id=(select auth.uid()) and (select public.mfa_access_allowed()));
create or replace function public.submit_support_report(p_id uuid,p_owner uuid,p_payload jsonb,p_hash text,p_release text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare previous public.support_reports;
begin
 perform pg_advisory_xact_lock(79143301);
 select * into previous from public.support_reports where id=p_id;
 if found then
   if previous.owner_id<>p_owner or previous.payload_hash<>p_hash then raise exception 'REPORT_CONFLICT'; end if;
   return jsonb_build_object('id',previous.id,'status',previous.status,'issue_url',previous.issue_url);
 end if;
 if p_payload->'consent' is distinct from 'true'::jsonb or p_payload->>'id' is distinct from p_id::text or p_owner is null then raise exception 'REPORT_INVALID'; end if;
 delete from public.support_reports where created_at<now()-interval '90 days';
 update public.support_reports set payload=jsonb_set(payload,'{images}','[]') where created_at<now()-interval '7 days' and payload->'images'<>'[]'::jsonb;
 if (select count(*) from public.support_reports where owner_id=p_owner and created_at>now()-interval '24 hours')>=5
 or (select count(*) from public.support_reports where created_at>now()-interval '24 hours')>=50
 or (select count(*) from public.support_reports where status in ('queued','sending','needs_review'))>=100 then raise exception 'REPORT_LIMIT'; end if;
 insert into public.support_reports(id,owner_id,payload,payload_hash,release_ref) values(p_id,p_owner,p_payload,p_hash,left(p_release,500));
 return jsonb_build_object('id',p_id,'status','queued','issue_url',null);
end $$;
create or replace function public.claim_support_reports()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 -- Expired claims require reconciliation, never blind re-creation after an ambiguous timeout.
 update public.support_reports set status='needs_review' where status='sending' and lease_until<now();
 update public.support_reports set payload=jsonb_set(payload,'{images}','[]') where created_at<now()-interval '7 days' and payload->'images'<>'[]'::jsonb;
 with candidates as (
   select id from public.support_reports where status='queued' and payload->'consent'='true'::jsonb order by created_at for update skip locked limit 5
 ), claimed as (
   update public.support_reports r set status='sending',claim_token=gen_random_uuid(),lease_until=now()+interval '30 minutes'
   from candidates c where r.id=c.id returning r.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'claim',claim_token,'payload',payload,'release',release_ref,'createdAt',created_at)),'[]') into result from claimed;
 return result;
end $$;
create or replace function public.ack_support_report(p_id uuid,p_claim uuid,p_issue text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_issue !~ '^https://github[.]com/NatanaelSCampos/destrava/issues/[1-9][0-9]*$' then raise exception 'REPORT_INVALID_URL'; end if;
 update public.support_reports set status='posted',issue_url=p_issue,lease_until=null where id=p_id and claim_token=p_claim and status in ('sending','needs_review');
 return found;
end $$;
revoke all on function public.submit_support_report(uuid,uuid,jsonb,text,text),public.claim_support_reports(),public.ack_support_report(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_support_report(uuid,uuid,jsonb,text,text),public.claim_support_reports(),public.ack_support_report(uuid,uuid,text) to service_role;
