-- Bucket pour médias chiffrés côté client (participants uniquement)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'conversation-media',
  'conversation-media',
  false,
  52428800,
  array['application/octet-stream']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_conversation_id(object_name text)
returns uuid
language sql
stable
as $$
  select nullif((string_to_array(object_name, '/'))[1], '')::uuid;
$$;

create policy "Participants can upload conversation media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'conversation-media'
  and public.is_conversation_participant(public.storage_conversation_id(name))
);

create policy "Participants can read conversation media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'conversation-media'
  and public.is_conversation_participant(public.storage_conversation_id(name))
);

create policy "Participants can delete own uploads"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'conversation-media'
  and owner = auth.uid()
  and public.is_conversation_participant(public.storage_conversation_id(name))
);
