-- Keep-alive: harmless function that returns the server time only. No data access.
-- Called every 2 days by .github/workflows/keepalive.yml so the free Supabase project never pauses.
create or replace function public.keepalive_ping()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, authenticated;
