-- Google login follows Supabase identity linking again. The custom access
-- token hook must be disabled in Auth configuration before this migration.
drop function if exists public.google_login_is_blocked();
drop function if exists public.set_google_login_blocked(boolean);
drop table if exists public.google_login_blocks;
drop function if exists public.google_login_access_token_hook(jsonb);
