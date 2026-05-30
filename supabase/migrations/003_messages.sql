-- GhostTalk: messages chiffrés côté client (ciphertext opaque pour le serveur)

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  constraint messages_ciphertext_not_empty check (char_length(trim(ciphertext)) > 0)
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

-- Requis pour Realtime (filtres sur conversation_id)
alter table public.messages replica identity full;

-- Publication Realtime
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
