-- Fix ambiguous user_id: function parameter shadows column name in WHERE clauses

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
  target_user_id uuid := user_id;
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into my_role
  from public.conversation_participants cp
  where cp.conversation_id = conv_id and cp.user_id = my_id;

  if my_role is null or my_role != 'admin' then
    raise exception 'Only admins can add members';
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'User not found';
  end if;

  if exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conv_id and cp.user_id = target_user_id
  ) then
    return false;
  end if;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (conv_id, target_user_id, 'member');

  return true;
end;
$$;

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
  target_user_id uuid := user_id;
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into my_role
  from public.conversation_participants cp
  where cp.conversation_id = conv_id and cp.user_id = my_id;

  if my_role is null or my_role != 'admin' then
    raise exception 'Only admins can remove members';
  end if;

  if (
    select count(*)
    from public.conversation_participants cp
    where cp.conversation_id = conv_id and cp.role = 'admin'
  ) = 1 and target_user_id = my_id then
    raise exception 'Cannot remove the last admin';
  end if;

  delete from public.conversation_participants cp
  where cp.conversation_id = conv_id and cp.user_id = target_user_id;

  return true;
end;
$$;
