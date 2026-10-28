-- Additive; does not change progress, exams or existing sessions.
create table public.conversation_session_analyses (
 session_id uuid primary key references public.live_conversation_sessions(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 language_code text not null check (language_code ~ '^[a-z]{2,3}$'),
 rubric_version text not null, transcript_hash text not null,
 status text not null default 'processing' check(status in ('processing','completed','failed')),
 analysis jsonb, model text, claim_token uuid, claimed_at timestamptz,
 attempts integer not null default 1 check(attempts between 1 and 3),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (analysis is null or octet_length(analysis::text) <= 60000),
 check (status <> 'completed' or analysis is not null)
);
create index conversation_memory_owner_language on public.conversation_session_analyses(owner_id,language_code,created_at);
alter table public.conversation_session_analyses enable row level security;
create policy conversation_memory_read_own on public.conversation_session_analyses for select to authenticated using(owner_id=auth.uid());
revoke all on public.conversation_session_analyses from anon,authenticated;
grant select on public.conversation_session_analyses to authenticated;
grant all on public.conversation_session_analyses to service_role;

create table public.conversation_credit_wallets (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 balance integer not null default 0 check(balance >= 0), updated_at timestamptz not null default now()
);
alter table public.conversation_credit_wallets enable row level security;
create policy conversation_wallet_read_own on public.conversation_credit_wallets for select to authenticated using(owner_id=auth.uid());
revoke all on public.conversation_credit_wallets from anon,authenticated;
grant select on public.conversation_credit_wallets to authenticated;
grant all on public.conversation_credit_wallets to service_role;

create table public.conversation_audio_assets (
 session_id uuid primary key references public.live_conversation_sessions(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 consent_at timestamptz not null, object_path text unique,
 status text not null default 'awaiting_upload' check(status in ('awaiting_upload','ready','deleted','expired')),
 sha256 text, seconds numeric check(seconds > 0 and seconds <= 490), bytes integer check(bytes > 0 and bytes <= 16000044),
 expires_at timestamptz not null default(now()+interval '30 days'),
 check(status <> 'ready' or (object_path is not null and sha256 is not null and seconds is not null and bytes is not null))
);
alter table public.conversation_audio_assets enable row level security;
create policy conversation_audio_read_own on public.conversation_audio_assets for select to authenticated using(owner_id=auth.uid());
revoke all on public.conversation_audio_assets from anon,authenticated;
grant select on public.conversation_audio_assets to authenticated;
grant all on public.conversation_audio_assets to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('conversation-audio','conversation-audio',false,16000044,array['audio/wav']) on conflict(id) do nothing;
-- Deliberately no storage policy for learners: server validates ownership, consent and PCM before upload.

create table public.conversation_oral_quotes (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 session_ids uuid[] not null check(cardinality(session_ids) between 1 and 10),
 fingerprint text not null, pricing_version text not null, credits integer not null check(credits > 0),
 estimated_provider_usd numeric not null check(estimated_provider_usd > 0),
 audio_ready boolean not null, expires_at timestamptz not null default(now()+interval '15 minutes'),
 created_at timestamptz not null default now()
);
alter table public.conversation_oral_quotes enable row level security;
revoke all on public.conversation_oral_quotes from anon,authenticated;
grant all on public.conversation_oral_quotes to service_role;

create table public.conversation_credit_operations (
 id uuid primary key default gen_random_uuid(), quote_id uuid not null unique references public.conversation_oral_quotes(id),
 owner_id uuid not null references auth.users(id) on delete cascade,
 credits integer not null check(credits>0), status text not null check(status in('reserved','completed','refunded')),
 actual_provider_usd numeric check(actual_provider_usd>=0), report jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.conversation_credit_operations enable row level security;
create policy conversation_credit_operations_read_own on public.conversation_credit_operations for select to authenticated using(owner_id=auth.uid());
revoke all on public.conversation_credit_operations from anon,authenticated;
grant select on public.conversation_credit_operations to authenticated;
grant all on public.conversation_credit_operations to service_role;

-- Infrastructure only. No endpoint grants credits and execution remains disabled pending payment/calibration.
create function public.reserve_conversation_oral_credits(p_owner uuid,p_quote uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare q conversation_oral_quotes; w conversation_credit_wallets; op conversation_credit_operations;
begin
 insert into conversation_credit_wallets(owner_id) values(p_owner) on conflict do nothing;
 select * into w from conversation_credit_wallets where owner_id=p_owner for update;
 select * into op from conversation_credit_operations where quote_id=p_quote;
 if found then
  if op.owner_id<>p_owner then raise exception 'QUOTE_NOT_FOUND'; end if;
  return jsonb_build_object('id',op.id,'status',op.status,'existing',true);
 end if;
 select * into q from conversation_oral_quotes where id=p_quote and owner_id=p_owner;
 if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
 if q.expires_at<=now() then raise exception 'QUOTE_EXPIRED'; end if;
 if w.balance<q.credits then raise exception 'INSUFFICIENT_CREDITS'; end if;
 if not q.audio_ready then raise exception 'AUDIO_UNAVAILABLE'; end if;
 update conversation_credit_wallets set balance=balance-q.credits,updated_at=now() where owner_id=p_owner;
 insert into conversation_credit_operations(quote_id,owner_id,credits,status) values(q.id,p_owner,q.credits,'reserved') returning * into op;
 return jsonb_build_object('id',op.id,'status',op.status,'existing',false);
end $$;
create function public.refund_conversation_oral_credits(p_owner uuid,p_operation uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare op conversation_credit_operations;
begin
 perform 1 from conversation_credit_wallets where owner_id=p_owner for update;
 select * into op from conversation_credit_operations where id=p_operation and owner_id=p_owner for update;
 if not found then raise exception 'OPERATION_NOT_FOUND'; end if;
 if op.status<>'reserved' then return false; end if;
 update conversation_credit_wallets set balance=balance+op.credits,updated_at=now() where owner_id=p_owner;
 update conversation_credit_operations set status='refunded',updated_at=now() where id=op.id;
 return true;
end $$;
revoke all on function public.reserve_conversation_oral_credits(uuid,uuid),public.refund_conversation_oral_credits(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_conversation_oral_credits(uuid,uuid),public.refund_conversation_oral_credits(uuid,uuid) to service_role;
alter table public.live_conversation_sessions add column memory_enabled boolean not null default false;
