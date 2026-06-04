import { supabase } from '@/lib/supabase/client'

export async function muteConversation(conversationId, until) {
  const { error } = await supabase.rpc('set_conversation_muted', {
    conv_id: conversationId,
    until_ts: until,
  })
  if (error) throw error
}

export async function unmuteConversation(conversationId) {
  const { error } = await supabase.rpc('set_conversation_muted', {
    conv_id: conversationId,
    until_ts: null,
  })
  if (error) throw error
}

export async function archiveConversation(conversationId, archived = true) {
  const { error } = await supabase.rpc('set_conversation_archived', {
    conv_id: conversationId,
    archived,
  })
  if (error) throw error
}

export async function blockUser(userId) {
  const { error } = await supabase.rpc('block_user', { target_id: userId })
  if (error) throw error
}

export async function unblockUser(userId) {
  const { error } = await supabase.rpc('unblock_user', { target_id: userId })
  if (error) throw error
}

export async function updatePresence(online) {
  try {
    const { error } = await supabase.rpc('update_presence', { online })
    if (error) console.warn('update_presence:', error.message)
  } catch {
    /* migration 013 */
  }
}

export async function getUserPresence(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_online, last_seen_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) return null
  return data
}

export async function isUserBlocked(userId) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    
    const { data, error } = await supabase.rpc('is_blocked', {
      blocker: user.id,
      blocked: userId,
    })
    if (error) throw error
    return data
  } catch {
    /* migration 013 */
    return false
  }
}

export async function getBlockedUsers() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    
    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id, profiles!user_blocks_blocked_id_fkey (username, display_name)')
      .eq('blocker_id', user.id)
    
    if (error) throw error
    return data ?? []
  } catch {
    /* migration 013 */
    return []
  }
}
