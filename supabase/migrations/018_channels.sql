-- GhostTalk: canaux de diffusion (type Telegram)

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  username text unique not null,
  name text not null,
  description text,
  avatar_seed text,
  is_official boolean not null default false,
  subscriber_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint channels_username_format check (username ~ '^[a-z0-9_]{5,32}$'),
  constraint channels_name_length check (char_length(name) <= 100)
);

create table public.channel_subscriptions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  subscribed_at timestamptz not null default now(),
  unique(channel_id, user_id)
);

create table public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  ciphertext text not null,
  media_storage_path text,
  created_at timestamptz not null default now(),
  views_count integer not null default 0
);

create index channels_username_idx on public.channels (username);
create index channels_owner_idx on public.channels (owner_id);
create index channel_subscriptions_channel_idx on public.channel_subscriptions (channel_id);
create index channel_subscriptions_user_idx on public.channel_subscriptions (user_id);
create index channel_messages_channel_idx on public.channel_messages (channel_id, created_at desc);

-- RLS
alter table public.channels enable row level security;
alter table public.channel_subscriptions enable row level security;
alter table public.channel_messages enable row level security;

create policy "Tout le monde peut voir les canaux"
  on public.channels
  for select
  to authenticated
  using (true);

create policy "Utilisateurs peuvent créer des canaux"
  on public.channels
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Propriétaires peuvent modifier leurs canaux"
  on public.channels
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Propriétaires peuvent supprimer leurs canaux"
  on public.channels
  for delete
  to authenticated
  using (owner_id = auth.uid());

create policy "Utilisateurs peuvent voir leurs abonnements"
  on public.channel_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Utilisateurs peuvent s'abonner"
  on public.channel_subscriptions
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Utilisateurs peuvent se désabonner"
  on public.channel_subscriptions
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "Tout le monde peut voir les messages des canaux publics"
  on public.channel_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.channels c
      where c.id = channel_messages.channel_id
    )
  );

create policy "Propriétaires peuvent poster sur leurs canaux"
  on public.channel_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.channels c
      where c.id = channel_messages.channel_id
        and c.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, delete on public.channel_subscriptions to authenticated;
grant select, insert on public.channel_messages to authenticated;

-- Realtime pour les messages de canaux
alter table public.channel_messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'channel_messages'
  ) then
    alter publication supabase_realtime add table public.channel_messages;
  end if;
end;
$$;

-- Fonction pour incrémenter le compteur d'abonnés
create or replace function public.increment_subscriber_count(channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update channels
  set subscriber_count = subscriber_count + 1
  where id = channel_id;
end;
$$;

-- Fonction pour décrémenter le compteur d'abonnés
create or replace function public.decrement_subscriber_count(channel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update channels
  set subscriber_count = greatest(subscriber_count - 1, 0)
  where id = channel_id;
end;
$$;
