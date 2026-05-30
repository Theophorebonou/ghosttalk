-- GhostTalk: Ajout des rôles pour les conversations de groupe

-- Type enum pour les rôles
create type public.participant_role as enum ('admin', 'member');

-- Ajouter la colonne role à conversation_participants
alter table public.conversation_participants
add column if not exists role public.participant_role not null default 'member';

-- Index sur role pour les requêtes fréquentes
create index if not exists conversation_participants_role_idx
on public.conversation_participants (role);

-- Fonction pour créer un groupe
create or replace function public.create_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  my_id uuid := auth.uid();
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Créer la conversation de type groupe
  insert into public.conversations (type)
  values ('group')
  returning id into conv_id;

  -- Ajouter le créateur comme admin
  insert into public.conversation_participants (conversation_id, user_id, role)
  values (conv_id, my_id, 'admin');

  return conv_id;
end;
$$;

grant execute on function public.create_group(text) to authenticated;

-- Fonction pour ajouter un membre à un groupe (admin uniquement)
create or replace function public.add_group_member(
  conv_id uuid,
  user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  my_id uuid := auth.uid();
  my_role public.participant_role;
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Vérifier que l'utilisateur actuel est admin
  select role into my_role
  from public.conversation_participants
  where conversation_id = conv_id and user_id = my_id;

  if my_role is null or my_role != 'admin' then
    raise exception 'Only admins can add members';
  end if;

  -- Vérifier que l'utilisateur à ajouter existe
  if not exists (select 1 from public.profiles where id = user_id) then
    raise exception 'User not found';
  end if;

  -- Vérifier que l'utilisateur n'est pas déjà membre
  if exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = user_id
  ) then
    return false;
  end if;

  -- Ajouter le membre
  insert into public.conversation_participants (conversation_id, user_id, role)
  values (conv_id, user_id, 'member');

  return true;
end;
$$;

grant execute on function public.add_group_member(uuid, uuid) to authenticated;

-- Fonction pour supprimer un membre d'un groupe (admin uniquement)
create or replace function public.remove_group_member(
  conv_id uuid,
  user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  my_id uuid := auth.uid();
  my_role public.participant_role;
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Vérifier que l'utilisateur actuel est admin
  select role into my_role
  from public.conversation_participants
  where conversation_id = conv_id and user_id = my_id;

  if my_role is null or my_role != 'admin' then
    raise exception 'Only admins can remove members';
  end if;

  -- Empêcher de supprimer le dernier admin
  if (
    select count(*)
    from public.conversation_participants
    where conversation_id = conv_id and role = 'admin'
  ) = 1 and user_id = my_id then
    raise exception 'Cannot remove the last admin';
  end if;

  -- Supprimer le membre
  delete from public.conversation_participants
  where conversation_id = conv_id and user_id = user_id;

  return true;
end;
$$;

grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

-- Mettre à jour la fonction get_or_create_direct pour ne s'appliquer qu'aux conversations directes
drop function if exists public.get_or_create_direct(uuid);

create or replace function public.get_or_create_direct(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  my_id uuid := auth.uid();
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  if other_user_id = my_id then
    raise exception 'Cannot create a conversation with yourself';
  end if;

  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'User not found';
  end if;

  select c.id into conv_id
  from public.conversations c
  where c.type = 'direct'
    and (
      select count(*)
      from public.conversation_participants cp
      where cp.conversation_id = c.id
    ) = 2
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = my_id
    )
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id and cp.user_id = other_user_id
    )
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  insert into public.conversations (type) values ('direct')
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values
    (conv_id, my_id, 'admin'),
    (conv_id, other_user_id, 'admin');

  return conv_id;
end;
$$;

grant execute on function public.get_or_create_direct(uuid) to authenticated;
