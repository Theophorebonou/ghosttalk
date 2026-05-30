-- Persist group names on conversations

alter table public.conversations
add column if not exists name text;

alter table public.conversations
drop constraint if exists conversations_group_name_length;

alter table public.conversations
add constraint conversations_group_name_length check (
  name is null or (char_length(trim(name)) >= 1 and char_length(name) <= 80)
);

create or replace function public.create_group(group_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  my_id uuid := auth.uid();
  trimmed_name text := nullif(trim(group_name), '');
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  if trimmed_name is null then
    raise exception 'Group name is required';
  end if;

  insert into public.conversations (type, name)
  values ('group', trimmed_name)
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (conv_id, my_id, 'admin');

  return conv_id;
end;
$$;

create or replace function public.update_group_name(
  conv_id uuid,
  new_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  my_id uuid := auth.uid();
  my_role public.participant_role;
  trimmed_name text := nullif(trim(new_name), '');
  conv_type public.conversation_type;
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  if trimmed_name is null then
    raise exception 'Group name is required';
  end if;

  select c.type into conv_type
  from public.conversations c
  where c.id = conv_id;

  if conv_type != 'group' then
    raise exception 'Not a group conversation';
  end if;

  select cp.role into my_role
  from public.conversation_participants cp
  where cp.conversation_id = conv_id and cp.user_id = my_id;

  if my_role is null or my_role != 'admin' then
    raise exception 'Only admins can rename the group';
  end if;

  update public.conversations
  set name = trimmed_name
  where id = conv_id;

  return true;
end;
$$;

grant execute on function public.update_group_name(uuid, text) to authenticated;
