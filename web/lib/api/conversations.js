import { supabase } from '@/lib/supabase/client'

export async function getConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      type,
      name,
      created_at,
      last_message_at,
      pinned_message_id,
      conversation_participants!inner(
        joined_at,
        last_read_at,
        muted_until,
        archived_at,
        role,
        profiles(
          id,
          username,
          avatar_seed,
          avatar_url,
          public_key
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getOrCreateDirectConversation(otherUserId) {
  const { data, error } = await supabase.rpc('get_or_create_direct', {
    other_user_id: otherUserId,
  })

  if (error) throw error
  return data
}

export async function createGroup(groupName) {
  const { data, error } = await supabase.rpc('create_group', {
    group_name: groupName,
  })

  if (error) throw error
  return data
}

export async function addGroupMember(conversationId, userId) {
  const { data, error } = await supabase.rpc('add_group_member', {
    conv_id: conversationId,
    user_id: userId,
  })

  if (error) throw error
  return data
}

export async function removeGroupMember(conversationId, userId) {
  const { data, error } = await supabase.rpc('remove_group_member', {
    conv_id: conversationId,
    user_id: userId,
  })

  if (error) throw error
  return data
}

export async function updateGroupName(conversationId, name) {
  const { data, error } = await supabase.rpc('update_group_name', {
    conv_id: conversationId,
    new_name: name,
  })

  if (error) throw error
  return data
}

export async function leaveGroup(conversationId) {
  const { data, error } = await supabase.rpc('leave_group', {
    conv_id: conversationId,
  })

  if (error) throw error
  return data
}

export async function getConversationById(id) {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      type,
      name,
      created_at,
      last_message_at,
      pinned_message_id,
      conversation_participants!inner(
        joined_at,
        last_read_at,
        muted_until,
        archived_at,
        role,
        profiles(
          id,
          username,
          avatar_seed,
          avatar_url,
          public_key
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  if (error) throw error
  return data
}

export async function markAsRead(conversationId) {
  const { error } = await supabase.rpc('mark_conversation_read', {
    conv_id: conversationId,
  })

  if (error) throw error
}
