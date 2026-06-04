-- GhostTalk: sondages et quiz interactifs

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  question text not null,
  is_anonymous boolean not null default false,
  is_quiz boolean not null default false,
  correct_option_id uuid,
  allow_multiple_choice boolean not null default false,
  created_at timestamptz not null default now(),
  constraint polls_question_length check (char_length(question) <= 300)
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_text text not null,
  position integer not null,
  constraint poll_options_text_length check (char_length(option_text) <= 100)
);

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  voted_at timestamptz not null default now(),
  unique(poll_option_id, user_id)
);

create index polls_message_idx on public.polls (message_id);
create index poll_options_poll_idx on public.poll_options (poll_id);
create index poll_votes_option_idx on public.poll_votes (poll_option_id);
create index poll_votes_user_idx on public.poll_votes (user_id);

-- RLS
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy "Participants can view polls"
  on public.polls
  for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = polls.message_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "Senders can create polls"
  on public.polls
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = polls.message_id
        and m.sender_id = auth.uid()
    )
  );

create policy "Participants can view poll options"
  on public.poll_options
  for select
  to authenticated
  using (
    exists (
      select 1 from public.polls p
      join public.messages m on m.id = p.message_id
      where p.id = poll_options.poll_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "Poll creators can add options"
  on public.poll_options
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.polls p
      join public.messages m on m.id = p.message_id
      where p.id = poll_options.poll_id
        and m.sender_id = auth.uid()
    )
  );

create policy "Participants can view votes"
  on public.poll_votes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.poll_options po
      join public.polls p on p.id = po.poll_id
      join public.messages m on m.id = p.message_id
      where po.id = poll_votes.poll_option_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "Users can vote"
  on public.poll_votes
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.poll_options po
      join public.polls p on p.id = po.poll_id
      join public.messages m on m.id = p.message_id
      where po.id = poll_votes.poll_option_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "Users can delete own votes"
  on public.poll_votes
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert on public.polls to authenticated;
grant select, insert on public.poll_options to authenticated;
grant select, insert, delete on public.poll_votes to authenticated;

-- Realtime pour les votes
alter table public.poll_votes replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'poll_votes'
  ) then
    alter publication supabase_realtime add table public.poll_votes;
  end if;
end;
$$;
