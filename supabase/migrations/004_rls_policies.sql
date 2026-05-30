-- GhostTalk: Row Level Security

create or replace function public.is_conversation_participant(
  conv_id uuid,
  uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conv_id
      and cp.user_id = uid
  );
$$;

-- profiles
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles
  for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- conversations
alter table public.conversations enable row level security;

create policy "Participants can view conversations"
  on public.conversations
  for select
  to authenticated
  using (public.is_conversation_participant(id));

-- conversation_participants
alter table public.conversation_participants enable row level security;

create policy "Participants can view conversation members"
  on public.conversation_participants
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

-- messages
alter table public.messages enable row level security;

create policy "Participants can view messages"
  on public.messages
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

create policy "Participants can send messages"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id)
  );

-- Droits API (RLS applique le filtrage)
grant select, insert, update on public.profiles to authenticated;
grant select on public.conversations to authenticated;
grant select on public.conversation_participants to authenticated;
grant select, insert on public.messages to authenticated;

grant select on public.profiles to anon;
