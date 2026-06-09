-- Remplace le trigger pour utiliser un webhook secret (pas besoin de ALTER DATABASE)
create or replace function public.notify_push_on_message()
returns trigger language plpgsql security definer as $$
begin
  perform net.http_post(
    url     := 'https://osxsxrsorzumlscwcdda.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-webhook-secret', 'a51b0074b08fa44b62877b8c66a7edac3f42bdd24b128c0f60f6c5ca49e16eb8'
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
