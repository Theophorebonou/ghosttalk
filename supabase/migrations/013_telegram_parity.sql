-- GhostTalk: parité Telegram (édition, suppression, réactions, épinglage, archive, mute, blocage, présence)

-- Profil enrichi
alter table public.profiles
  add column if not exists bio text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists is_online boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_bio_length;

alter table public.profiles
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 140);

-- Messages: édition
alter table public.messages
  add column if not exists edited_at timestamptz;

-- Messages masqués pour un utilisateur (« supprimer pour moi »)
create table if not exists public.message_hidden (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- Réactions (une par utilisateur et par message)
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id),
  constraint message_reactions_emoji_len check (char_length(emoji) between 1 and 8)
);

create index if not exists message_reactions_message_idx on public.message_reactions (message_id);

-- Paramètres conversation par participant
alter table public.conversation_participants
  add column if not exists muted_until timestamptz,
  add column if not exists archived_at timestamptz;

-- Message épinglé
alter table public.conversations
  add column if not exists pinned_message_id uuid references public.messages (id) on delete set null;

-- Blocage
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);

create or replace function public.is_blocked(blocker uuid, blocked uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where blocker_id = blocker and blocked_id = blocked
  );
$$;

-- Éditer un message (expéditeur uniquement)
create or replace function public.edit_message_ciphertext(msg_id uuid, new_ciphertext text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if new_ciphertext is null or char_length(trim(new_ciphertext)) = 0 then
    raise exception 'Empty ciphertext';
  end if;

  update public.messages
  set ciphertext = new_ciphertext, edited_at = now()
  where id = msg_id
    and sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id);

  if not found then raise exception 'Cannot edit message'; end if;
end;
$$;

-- Supprimer pour tout le monde (expéditeur ou admin de groupe)
create or replace function public.delete_message_for_all(msg_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg record;
  is_admin boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select m.*, c.type as conv_type into msg
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.id = msg_id;

  if not found then return; end if;

  if msg.sender_id = auth.uid() then
    perform public.delete_message_and_media(msg_id);
    return;
  end if;

  if msg.conv_type = 'group' then
    select exists (
      select 1 from public.conversation_participants
      where conversation_id = msg.conversation_id
        and user_id = auth.uid() and role = 'admin'
    ) into is_admin;
    if is_admin then
      perform public.delete_message_and_media(msg_id);
      return;
    end if;
  end if;

  raise exception 'Not allowed to delete this message';
end;
$$;

create or replace function public.hide_message_for_me(msg_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.messages m
    where m.id = msg_id and public.is_conversation_participant(m.conversation_id)
  ) then
    raise exception 'Message not found';
  end if;

  insert into public.message_hidden (message_id, user_id)
  values (msg_id, auth.uid())
  on conflict do nothing;
end;
$$;

create or replace function public.clear_conversation_history(conv_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_conversation_participant(conv_id) then
    raise exception 'Not a participant';
  end if;

  update public.conversations set pinned_message_id = null where id = conv_id;

  for r in select id from public.messages where conversation_id = conv_id loop
    perform public.delete_message_and_media(r.id);
  end loop;
end;
$$;

create or replace function public.pin_message(conv_id uuid, msg_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_conversation_participant(conv_id) then
    raise exception 'Not a participant';
  end if;
  if not exists (
    select 1 from public.messages where id = msg_id and conversation_id = conv_id
  ) then
    raise exception 'Message not in conversation';
  end if;

  update public.conversations set pinned_message_id = msg_id where id = conv_id;
end;
$$;

create or replace function public.unpin_message(conv_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.is_conversation_participant(conv_id) then
    raise exception 'Not a participant';
  end if;
  update public.conversations set pinned_message_id = null where id = conv_id;
end;
$$;

create or replace function public.set_conversation_muted(conv_id uuid, until_ts timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.conversation_participants
  set muted_until = until_ts
  where conversation_id = conv_id and user_id = auth.uid();
end;
$$;

create or replace function public.set_conversation_archived(conv_id uuid, archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.conversation_participants
  set archived_at = case when archived then now() else null end
  where conversation_id = conv_id and user_id = auth.uid();
end;
$$;

create or replace function public.block_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if target_id = auth.uid() then raise exception 'Cannot block yourself'; end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (auth.uid(), target_id)
  on conflict do nothing;
end;
$$;

create or replace function public.unblock_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_blocks
  where blocker_id = auth.uid() and blocked_id = target_id;
end;
$$;

create or replace function public.update_presence(online boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles
  set is_online = online,
      last_seen_at = case when online then last_seen_at else now() end
  where id = auth.uid();
end;
$$;

-- RLS
alter table public.message_hidden enable row level security;
alter table public.message_reactions enable row level security;
alter table public.user_blocks enable row level security;

drop policy if exists "Users manage own hidden messages" on public.message_hidden;
create policy "Users manage own hidden messages"
  on public.message_hidden for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Participants view reactions" on public.message_reactions;
create policy "Participants view reactions"
  on public.message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

drop policy if exists "Participants add reactions" on public.message_reactions;
create policy "Participants add reactions"
  on public.message_reactions for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

drop policy if exists "Users update own reactions" on public.message_reactions;
create policy "Users update own reactions"
  on public.message_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users delete own reactions" on public.message_reactions;
create policy "Users delete own reactions"
  on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users view own blocks" on public.user_blocks;
create policy "Users view own blocks"
  on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "Users manage own blocks" on public.user_blocks;
create policy "Users manage own blocks"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "Users delete own blocks" on public.user_blocks;
create policy "Users delete own blocks"
  on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "Participants can update conversations" on public.conversations;
create policy "Participants can update conversations"
  on public.conversations for update to authenticated
  using (public.is_conversation_participant(id))
  with check (public.is_conversation_participant(id));

drop policy if exists "Participants update own participant row" on public.conversation_participants;
create policy "Participants update own participant row"
  on public.conversation_participants for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Senders can edit own messages" on public.messages;
create policy "Senders can edit own messages"
  on public.messages for update to authenticated
  using (sender_id = auth.uid() and public.is_conversation_participant(conversation_id))
  with check (sender_id = auth.uid());

grant update on public.conversations to authenticated;
grant update on public.conversation_participants to authenticated;
grant update on public.messages to authenticated;
grant select, insert, delete on public.message_hidden to authenticated;
grant select, insert, update, delete on public.message_reactions to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

grant execute on function public.edit_message_ciphertext(uuid, text) to authenticated;
grant execute on function public.delete_message_for_all(uuid) to authenticated;
grant execute on function public.hide_message_for_me(uuid) to authenticated;
grant execute on function public.clear_conversation_history(uuid) to authenticated;
grant execute on function public.pin_message(uuid, uuid) to authenticated;
grant execute on function public.unpin_message(uuid) to authenticated;
grant execute on function public.set_conversation_muted(uuid, timestamptz) to authenticated;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.update_presence(boolean) to authenticated;

-- Realtime réactions + mises à jour messages
alter table public.message_reactions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end;
$$;
