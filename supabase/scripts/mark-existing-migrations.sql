-- GhostTalk — tables déjà en base, historique CLI pas à jour
-- SQL Editor : exécuter une fois, puis en local : supabase db push
--
-- Les versions doivent être 001, 002… (pas 001_profiles). Vérifier :
-- select version from supabase_migrations.schema_migrations order by version;

insert into supabase_migrations.schema_migrations (version, name)
select v, v
from unnest(array[
  '001', '002', '003', '004', '005', '006', '007', '008', '009',
  '010', '011', '012', '013', '014', '015', '016', '017', '018'
]::text[]) as t(v)
on conflict (version) do nothing;

-- Si la table calls existe déjà :
-- insert into supabase_migrations.schema_migrations (version, name)
-- select v, v from unnest(array['019']::text[]) as t(v)
-- on conflict (version) do nothing;

select version, name
from supabase_migrations.schema_migrations
order by version;
