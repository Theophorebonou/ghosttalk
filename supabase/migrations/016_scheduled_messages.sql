-- GhostTalk: messages programmés

create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  ciphertext text not null,
  scheduled_for timestamptz not null,
  media_storage_path text,
  expires_at timestamptz,
  ephemeral_kind text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'pending', -- 'pending', 'sent', 'failed'
  error_message text,
  constraint scheduled_messages_future check (scheduled_for > created_at)
);

create index scheduled_messages_user_idx on public.scheduled_messages (user_id, status);
create index scheduled_messages_scheduled_idx on public.scheduled_messages (scheduled_for, status);

-- RLS
alter table public.scheduled_messages enable row level security;

create policy "Users can view own scheduled messages"
  on public.scheduled_messages
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create own scheduled messages"
  on public.scheduled_messages
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete own scheduled messages"
  on public.scheduled_messages
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.scheduled_messages to authenticated;

-- Fonction pour envoyer les messages programmés
create or replace function public.send_scheduled_messages()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg record;
  new_message record;
begin
  for msg in
    select id, user_id, conversation_id, ciphertext, media_storage_path, expires_at, ephemeral_kind
    from scheduled_messages
    where status = 'pending'
      and scheduled_for <= now()
  loop
    begin
      -- Insérer le message
      insert into messages (conversation_id, sender_id, ciphertext, media_storage_path, expires_at, ephemeral_kind)
      values (msg.conversation_id, msg.user_id, msg.ciphertext, msg.media_storage_path, msg.expires_at, msg.ephemeral_kind)
      returning * into new_message;

      -- Marquer comme envoyé
      update scheduled_messages
      set status = 'sent',
          sent_at = now()
      where id = msg.id;
    exception when others then
      -- Marquer comme échoué
      update scheduled_messages
      set status = 'failed',
          error_message = SQLERRM
      where id = msg.id;
    end;
  end loop;
end;
$$;

-- Cron job pour envoyer les messages programmés toutes les minutes
-- Note: Supabase pg_cron doit être activé
-- select cron.schedule('send-scheduled-messages', '* * * * *', 'select public.send_scheduled_messages();');
