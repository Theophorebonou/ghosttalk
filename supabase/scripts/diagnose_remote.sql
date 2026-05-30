-- Colle ce script dans Supabase → SQL Editor pour voir l'état actuel

select 'tables' as kind, tablename as name
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'conversations', 'conversation_participants', 'messages')
union all
select 'types', typname
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and typname = 'conversation_type'
union all
select 'functions', proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('get_or_create_direct', 'is_conversation_participant', 'handle_updated_at')
order by kind, name;

select version, name
from supabase_migrations.schema_migrations
order by version;
