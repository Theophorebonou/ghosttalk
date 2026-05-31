-- Ajout des champs pour la gestion des non-lus
alter table public.conversation_participants
add column if not exists last_read_at timestamptz not null default now();

alter table public.conversations
add column if not exists last_message_at timestamptz not null default now();

-- Fonction RPC pour marquer une conversation comme lue
create or replace function public.mark_conversation_read(conv_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_id uuid := auth.uid();
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = conv_id and user_id = my_id;
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Trigger pour mettre à jour last_message_at sur la conversation
create or replace function public.trigger_set_last_message_at()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists set_last_message_at on public.messages;
create trigger set_last_message_at
after insert on public.messages
for each row
execute function public.trigger_set_last_message_at();
