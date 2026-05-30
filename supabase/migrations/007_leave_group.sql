-- Allow any group member to leave; auto-promote a member if the last admin leaves

create or replace function public.leave_group(conv_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  my_id uuid := auth.uid();
  my_role public.participant_role;
  conv_type public.conversation_type;
  admin_count int;
  member_count int;
  new_admin_id uuid;
begin
  if my_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.type into conv_type
  from public.conversations c
  where c.id = conv_id;

  if conv_type is null then
    raise exception 'Conversation not found';
  end if;

  if conv_type != 'group' then
    raise exception 'Can only leave group conversations';
  end if;

  select cp.role into my_role
  from public.conversation_participants cp
  where cp.conversation_id = conv_id and cp.user_id = my_id;

  if my_role is null then
    raise exception 'Not a member of this group';
  end if;

  select count(*) into admin_count
  from public.conversation_participants cp
  where cp.conversation_id = conv_id and cp.role = 'admin';

  select count(*) into member_count
  from public.conversation_participants cp
  where cp.conversation_id = conv_id;

  if my_role = 'admin' and admin_count = 1 and member_count > 1 then
    select cp.user_id into new_admin_id
    from public.conversation_participants cp
    where cp.conversation_id = conv_id and cp.user_id != my_id
    order by cp.joined_at
    limit 1;

    update public.conversation_participants cp
    set role = 'admin'
    where cp.conversation_id = conv_id and cp.user_id = new_admin_id;
  end if;

  delete from public.conversation_participants cp
  where cp.conversation_id = conv_id and cp.user_id = my_id;

  if not exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conv_id
  ) then
    delete from public.conversations where id = conv_id;
  end if;

  return true;
end;
$$;

grant execute on function public.leave_group(uuid) to authenticated;
