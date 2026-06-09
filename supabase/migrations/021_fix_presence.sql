-- Fix presence: update last_seen_at on every heartbeat, not only on logout.
-- This lets clients detect stale is_online flags by comparing last_seen_at
-- to now() with a small tolerance window (e.g. 3 minutes).

create or replace function public.update_presence(online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles
  set is_online    = online,
      last_seen_at = now()
  where id = auth.uid();
end;
$$;

-- Enable Realtime on profiles so clients can subscribe to presence changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
