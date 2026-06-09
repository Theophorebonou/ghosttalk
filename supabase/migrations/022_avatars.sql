-- Colonne avatar_url dans les profils
alter table public.profiles add column if not exists avatar_url text;

-- Bucket public pour les photos de profil (2 Mo max, images seulement)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit  = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Seul l'utilisateur peut uploader/remplacer son propre avatar (chemin = son user_id)
create policy "Users can upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text
  );

create policy "Users can update own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and owner = auth.uid()
  );

create policy "Users can delete own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and owner = auth.uid()
  );

-- Lecture publique (bucket public = pas de policy SELECT nécessaire,
-- mais on l'ajoute explicitement pour les accès authentifiés via RLS)
create policy "Anyone can read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
