-- GhostTalk: accusés de lecture par message + messages éphémères (sans trace)

-- Accusés de lecture (qui a lu quel message)
create table public.message_reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_reads_message_idx on public.message_reads (message_id);
create index message_reads_user_idx on public.message_reads (user_id);

alter table public.message_reads enable row level security;

create policy "Participants can view message reads in their conversations"
  on public.message_reads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_reads.message_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "Users can insert their own read receipts"
  on public.message_reads
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages m
      where m.id = message_reads.message_id
        and m.sender_id <> auth.uid()
        and public.is_conversation_participant(m.conversation_id)
    )
  );

-- Métadonnées éphémères (côté serveur pour purge — le contenu reste chiffré)
alter table public.messages
  add column if not exists expires_at timestamptz,
  add column if not exists ephemeral_kind text,
  add column if not exists media_storage_path text;

alter table public.messages
  drop constraint if exists messages_ephemeral_kind_check;

alter table public.messages
  add constraint messages_ephemeral_kind_check
  check (ephemeral_kind is null or ephemeral_kind in ('timer', 'after_read'));

create index messages_expires_at_idx
  on public.messages (expires_at)
  where expires_at is not null;

-- Realtime: accusés de lecture
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reads'
  ) then
    alter publication supabase_realtime add table public.message_reads;
  end if;
end;
$$;

alter table public.message_reads replica identity full;

-- Marquer un message comme lu + purge « après lecture » si tous les destinataires ont lu
create or replace function public.mark_message_read(msg_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_id uuid := auth.uid();
  msg record;
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  select m.id, m.conversation_id, m.sender_id, m.ephemeral_kind, m.media_storage_path
  into msg
  from public.messages m
  where m.id = msg_id;

  if not found then
    return;
  end if;

  if msg.sender_id = my_id then
    return;
  end if;

  if not public.is_conversation_participant(msg.conversation_id, my_id) then
    raise exception 'Not a participant';
  end if;

  insert into public.message_reads (message_id, user_id)
  values (msg_id, my_id)
  on conflict (message_id, user_id) do nothing;

  perform public.maybe_purge_after_read_message(msg_id);
end;
$$;

grant execute on function public.mark_message_read(uuid) to authenticated;

-- Tous les participants sauf l'expéditeur ont-ils lu ?
create or replace function public.all_recipients_read_message(msg_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  msg record;
  pending int;
begin
  select sender_id, conversation_id into msg from public.messages where id = msg_id;
  if not found then
    return false;
  end if;

  select count(*)::int into pending
  from public.conversation_participants cp
  where cp.conversation_id = msg.conversation_id
    and cp.user_id <> msg.sender_id
    and not exists (
      select 1
      from public.message_reads mr
      where mr.message_id = msg_id and mr.user_id = cp.user_id
    );

  return pending = 0;
end;
$$;

create or replace function public.delete_message_and_media(msg_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  path text;
begin
  select media_storage_path into path from public.messages where id = msg_id;

  delete from public.messages where id = msg_id;

  if path is not null and length(trim(path)) > 0 then
    delete from storage.objects
    where bucket_id = 'conversation-media'
      and name = path;
  end if;
end;
$$;

create or replace function public.maybe_purge_after_read_message(msg_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
begin
  select ephemeral_kind into kind from public.messages where id = msg_id;
  if kind is distinct from 'after_read' then
    return;
  end if;

  if public.all_recipients_read_message(msg_id) then
    perform public.delete_message_and_media(msg_id);
  end if;
end;
$$;

-- Purge des messages dont le timer est expiré
create or replace function public.purge_expired_messages(conv_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id
    from public.messages
    where expires_at is not null
      and expires_at <= now()
      and (conv_id is null or conversation_id = conv_id)
  loop
    perform public.delete_message_and_media(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function public.purge_expired_messages(uuid) to authenticated;

-- Politique DELETE messages éphémères (participants)
drop policy if exists "Participants can delete ephemeral messages" on public.messages;

create policy "Participants can delete ephemeral messages"
  on public.messages
  for delete
  to authenticated
  using (
    public.is_conversation_participant(conversation_id)
    and (ephemeral_kind is not null or expires_at is not null)
  );

grant delete on public.messages to authenticated;
grant select, insert on public.message_reads to authenticated;
