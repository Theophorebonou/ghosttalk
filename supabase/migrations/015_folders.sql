-- GhostTalk: dossiers et filtres personnalisés

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  icon text default '📁',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint folders_name_length check (char_length(name) <= 50),
  unique(user_id, name)
);

create table public.folder_filters (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete cascade,
  filter_type text not null, -- 'include', 'exclude'
  filter_value text not null, -- conversation_id, user_id, 'unread', 'archived', 'muted'
  created_at timestamptz not null default now()
);

create index folders_user_idx on public.folders (user_id, position);
create index folder_filters_folder_idx on public.folder_filters (folder_id);

-- RLS
alter table public.folders enable row level security;
alter table public.folder_filters enable row level security;

create policy "Users can view own folders"
  on public.folders
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create own folders"
  on public.folders
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own folders"
  on public.folders
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own folders"
  on public.folders
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "Users can view folder filters"
  on public.folder_filters
  for select
  to authenticated
  using (
    exists (
      select 1 from public.folders f
      where f.id = folder_filters.folder_id
        and f.user_id = auth.uid()
    )
  );

create policy "Users can create folder filters"
  on public.folder_filters
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.folders f
      where f.id = folder_filters.folder_id
        and f.user_id = auth.uid()
    )
  );

create policy "Users can delete folder filters"
  on public.folder_filters
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.folders f
      where f.id = folder_filters.folder_id
        and f.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.folders to authenticated;
grant select, insert, delete on public.folder_filters to authenticated;

-- Fonction pour récupérer les conversations d'un dossier
create or replace function public.get_folder_conversations(folder_id uuid)
returns table (
  conversation_id uuid,
  conversation_name text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with folder_conv as (
    select distinct
      cp.conversation_id,
      c.name as conversation_name,
      c.last_message_at,
      c.created_at
    from conversation_participants cp
    join conversations c on c.id = cp.conversation_id
    join folders f on f.user_id = cp.user_id
    join folder_filters ff on ff.folder_id = f.id
    where f.id = folder_id
      and cp.user_id = f.user_id
      and (
        -- Include filters
        (ff.filter_type = 'include' and (
          ff.filter_value = 'unread' and exists (
            select 1 from messages m
            where m.conversation_id = cp.conversation_id
              and m.sender_id != cp.user_id
              and not exists (
                select 1 from message_reads mr
                where mr.message_id = m.id
                  and mr.user_id = cp.user_id
              )
          )
          or ff.filter_value = 'archived' and cp.archived_at is not null
          or ff.filter_value = 'muted' and cp.muted_until > now()
          or ff.filter_value like 'user:%' and exists (
            select 1 from conversation_participants cp2
            where cp2.conversation_id = cp.conversation_id
              and cp2.user_id::text = substring(ff.filter_value, 6)
          )
        ))
        -- Exclude filters (not implemented for simplicity)
      )
  )
  select
    fc.conversation_id,
    fc.conversation_name,
    fc.last_message_at,
    (
      select count(*)
      from messages m
      where m.conversation_id = fc.conversation_id
        and m.sender_id != (select user_id from folders where id = folder_id)
        and not exists (
          select 1 from message_reads mr
          where mr.message_id = m.id
            and mr.user_id = (select user_id from folders where id = folder_id)
        )
    ) as unread_count
  from folder_conv fc
  order by fc.last_message_at desc nulls last, fc.created_at desc;
$$;
