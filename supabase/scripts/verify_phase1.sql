-- GhostTalk — Vérification Phase 1 (UNE seule requête)
-- Supabase → SQL Editor : sélectionner TOUT le fichier, puis Run (pas Explain)

select * from (
  select
    case
      when count(*) = 4 then 'OK'
      else 'FAIL'
    end as status,
    'tables' as kind,
    coalesce(string_agg(tablename, ', ' order by tablename), '(none)') as detail
  from pg_tables
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'conversations',
      'conversation_participants',
      'messages'
    )

  union all

  select
    case when exists (
      select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = 'conversation_type'
    ) then 'OK' else 'FAIL' end,
    'type',
    'conversation_type'

  union all

  select
    case when count(*) = 3 then 'OK' else 'FAIL' end,
    'functions',
    coalesce(string_agg(proname, ', ' order by proname), '(none)')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and proname in (
      'get_or_create_direct',
      'is_conversation_participant',
      'handle_updated_at'
    )

  union all

  select
    case when count(*) = 4 then 'OK' else 'FAIL' end,
    'rls_enabled',
    coalesce(string_agg(relname, ', ' order by relname), '(none)')
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'profiles',
      'conversations',
      'conversation_participants',
      'messages'
    )
    and c.relrowsecurity = true

  union all

  select
    case when count(distinct tablename) >= 4 then 'OK' else 'FAIL' end,
    'rls_policies',
    count(*)::text || ' policies on ' ||
      count(distinct tablename)::text || ' tables'
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'profiles',
      'conversations',
      'conversation_participants',
      'messages'
    )

  union all

  select
    case when exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then 'OK' else 'FAIL' end,
    'realtime',
    'messages in supabase_realtime'

  union all

  select
    case when count(*) = 4 then 'OK' else 'FAIL' end,
    'migrations',
    coalesce(string_agg(version, ', ' order by version), '(none)')
  from supabase_migrations.schema_migrations
  where version in ('001', '002', '003', '004')

  union all

  select
    case when count(*) >= 3 then 'OK' else 'FAIL' end,
    'indexes',
    coalesce(string_agg(indexname, ', ' order by indexname), '(none)')
  from pg_indexes
  where schemaname = 'public'
    and indexname in (
      'profiles_username_idx',
      'conversation_participants_user_idx',
      'messages_conversation_created_idx'
    )
) checks
order by kind;
