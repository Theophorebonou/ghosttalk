-- Correctifs appels (si 019 déjà appliqué sans grants / realtime)

grant execute on function public.create_call(uuid, text, uuid) to authenticated;
grant execute on function public.update_call_status(uuid, text) to authenticated;

alter table public.calls replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'calls'
  ) then
    alter publication supabase_realtime add table public.calls;
  end if;
end;
$$;
