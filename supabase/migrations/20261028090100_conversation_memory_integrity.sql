-- Preserve the live-conversation MFA boundary and bind evidence/assets to the session owner.
create unique index live_conversation_id_owner on public.live_conversation_sessions(id,owner_id);
alter table public.conversation_session_analyses add constraint conversation_analysis_session_owner_fk foreign key(session_id,owner_id) references public.live_conversation_sessions(id,owner_id) on delete cascade;
alter table public.conversation_audio_assets add constraint conversation_audio_session_owner_fk foreign key(session_id,owner_id) references public.live_conversation_sessions(id,owner_id) on delete cascade;
create unique index conversation_quote_id_owner on public.conversation_oral_quotes(id,owner_id);
alter table public.conversation_credit_operations add constraint conversation_credit_quote_owner_fk foreign key(quote_id,owner_id) references public.conversation_oral_quotes(id,owner_id);
alter policy conversation_memory_read_own on public.conversation_session_analyses using(owner_id=(select auth.uid()) and (select public.mfa_access_allowed()));
alter policy conversation_audio_read_own on public.conversation_audio_assets using(owner_id=(select auth.uid()) and (select public.mfa_access_allowed()));
alter policy conversation_wallet_read_own on public.conversation_credit_wallets using(owner_id=(select auth.uid()) and (select public.mfa_access_allowed()));
alter policy conversation_credit_operations_read_own on public.conversation_credit_operations using(owner_id=(select auth.uid()) and (select public.mfa_access_allowed()));
