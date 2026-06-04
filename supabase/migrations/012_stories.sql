-- GhostTalk: stories éphémères (24h) visibles par les contacts

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  ciphertext text not null,
  media_storage_path text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint stories_ciphertext_not_empty check (char_length(trim(ciphertext)) > 0)
);

create index stories_author_created_idx on public.stories (author_id, created_at desc);
create index stories_expires_at_idx on public.stories (expires_at);

create table public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index story_views_story_idx on public.story_views (story_id);

-- Contact = participant d'une conversation directe ou d'un groupe commun
create or replace function public.is_contact_of(viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select viewer is not null
    and target is not null
    and viewer <> target
    and exists (
      select 1
      from public.conversation_participants cp1
      join public.conversation_participants cp2
        on cp1.conversation_id = cp2.conversation_id
      where cp1.user_id = viewer
        and cp2.user_id = target
    );
$$;

create or replace function public.purge_expired_stories()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, media_storage_path
    from public.stories
    where expires_at <= now()
  loop
    delete from public.stories where id = r.id;
    if r.media_storage_path is not null and length(trim(r.media_storage_path)) > 0 then
      delete from storage.objects
      where bucket_id = 'story-media'
        and name = r.media_storage_path;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function public.purge_expired_stories() to authenticated;

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

create policy "Authors and contacts can view active stories"
  on public.stories
  for select
  to authenticated
  using (
    expires_at > now()
    and (
      author_id = auth.uid()
      or public.is_contact_of(auth.uid(), author_id)
    )
  );

create policy "Users can publish their own stories"
  on public.stories
  for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Authors can delete their stories"
  on public.stories
  for delete
  to authenticated
  using (author_id = auth.uid());

create policy "Contacts can view story views on visible stories"
  on public.story_views
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.stories s
      where s.id = story_views.story_id
        and s.expires_at > now()
        and (
          s.author_id = auth.uid()
          or public.is_contact_of(auth.uid(), s.author_id)
        )
    )
  );

create policy "Contacts can mark story viewed"
  on public.story_views
  for insert
  to authenticated
  with check (
    auth.uid() = viewer_id
    and exists (
      select 1
      from public.stories s
      where s.id = story_views.story_id
        and s.expires_at > now()
        and s.author_id <> auth.uid()
        and public.is_contact_of(auth.uid(), s.author_id)
    )
  );

grant select, insert, delete on public.stories to authenticated;
grant select, insert on public.story_views to authenticated;

alter table public.stories replica identity full;
alter table public.story_views replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'stories'
  ) then
    alter publication supabase_realtime add table public.stories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'story_views'
  ) then
    alter publication supabase_realtime add table public.story_views;
  end if;
end;
$$;

-- Bucket médias story (chiffrés côté client)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-media',
  'story-media',
  false,
  10485760,
  array['application/octet-stream']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit;

create or replace function public.storage_story_author_id(object_name text)
returns uuid
language sql
stable
as $$
  select nullif((string_to_array(object_name, '/'))[1], '')::uuid;
$$;

create policy "Authors upload story media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'story-media'
  and public.storage_story_author_id(name) = auth.uid()
);

create policy "Contacts read story media"
on storage.objects for select to authenticated
using (
  bucket_id = 'story-media'
  and (
    public.storage_story_author_id(name) = auth.uid()
    or public.is_contact_of(auth.uid(), public.storage_story_author_id(name))
  )
);

create policy "Authors delete story media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'story-media'
  and public.storage_story_author_id(name) = auth.uid()
);
