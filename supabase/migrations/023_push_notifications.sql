-- Push notification subscriptions
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null,
  subscription jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "users manage own push subscriptions"
  on public.push_subscriptions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger: call send-push edge function on new message
-- Requires pg_net extension and the following settings to be configured:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';
create extension if not exists pg_net;

create or replace function public.notify_push_on_message()
returns trigger language plpgsql security definer as $$
declare
  _supabase_url text := current_setting('app.supabase_url', true);
  _service_key  text := current_setting('app.service_role_key', true);
begin
  if _supabase_url is null or _service_key is null then
    return new;
  end if;

  perform net.http_post(
    url     := _supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body    := jsonb_build_object(
      'message_id',      new.id,
      'conversation_id', new.conversation_id,
      'sender_id',       new.sender_id
    )
  );
  return new;
end;
$$;

create trigger on_message_insert
  after insert on public.messages
  for each row execute function public.notify_push_on_message();
