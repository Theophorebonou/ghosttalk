-- GhostTalk: profils liés aux comptes auth (y compris anonymes)

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_seed text,
  public_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_username_reserved check (
    username not in ('admin', 'ghost', 'ghosttalk', 'support', 'system', 'root')
  )
);

create index profiles_username_idx on public.profiles (username);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();
