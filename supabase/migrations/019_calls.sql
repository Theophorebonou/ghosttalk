-- GhostTalk: appels vocaux/vidéo WebRTC

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles (id) on delete cascade,
  callee_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  call_type text not null default 'audio', -- 'audio', 'video'
  status text not null default 'ringing', -- 'ringing', 'connected', 'ended', 'rejected', 'missed'
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  constraint calls_valid_status check (status in ('ringing', 'connected', 'ended', 'rejected', 'missed'))
);

create table public.call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  signal_type text not null, -- 'offer', 'answer', 'ice_candidate'
  signal_data jsonb not null,
  created_at timestamptz not null default now()
);

create index calls_caller_idx on public.calls (caller_id, status);
create index calls_callee_idx on public.calls (callee_id, status);
create index call_signals_call_idx on public.call_signals (call_id, created_at);

-- RLS
alter table public.calls enable row level security;
alter table public.call_signals enable row level security;

create policy "Participants peuvent voir les appels"
  on public.calls
  for select
  to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid());

create policy "Utilisateurs peuvent créer des appels"
  on public.calls
  for insert
  to authenticated
  with check (caller_id = auth.uid());

create policy "Participants peuvent mettre à jour les appels"
  on public.calls
  for update
  to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid())
  with check (caller_id = auth.uid() or callee_id = auth.uid());

create policy "Participants peuvent voir les signaux"
  on public.call_signals
  for select
  to authenticated
  using (
    exists (
      select 1 from public.calls c
      where c.id = call_signals.call_id
        and (c.caller_id = auth.uid() or c.callee_id = auth.uid())
    )
  );

create policy "Participants peuvent envoyer des signaux"
  on public.call_signals
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.calls c
      where c.id = call_signals.call_id
        and (c.caller_id = auth.uid() or c.callee_id = auth.uid())
    )
    and sender_id = auth.uid()
  );

grant select, insert, update on public.calls to authenticated;
grant select, insert on public.call_signals to authenticated;

-- Realtime pour les signaux d'appel
alter table public.call_signals replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'call_signals'
  ) then
    alter publication supabase_realtime add table public.call_signals;
  end if;
end;
$$;

-- Fonction pour créer un appel
create or replace function public.create_call(
  p_callee_id uuid,
  p_call_type text default 'audio',
  p_conversation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call_id uuid;
begin
  insert into calls (caller_id, callee_id, call_type, conversation_id)
  values (auth.uid(), p_callee_id, p_call_type, p_conversation_id)
  returning id into v_call_id;
  
  return v_call_id;
end;
$$;

-- Fonction pour mettre à jour le statut d'appel
create or replace function public.update_call_status(
  p_call_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update calls
  set 
    status = p_status,
    ended_at = case when p_status in ('ended', 'rejected', 'missed') then now() else ended_at end,
    duration_seconds = case when p_status = 'ended' then 
      extract(epoch from (now() - started_at))::integer 
    else duration_seconds end
  where id = p_call_id
    and (caller_id = auth.uid() or callee_id = auth.uid());
end;
$$;
