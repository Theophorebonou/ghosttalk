import { supabase } from '@/lib/supabase/client'

export async function editMessageCiphertext(messageId, ciphertext) {
  const { error } = await supabase.rpc('edit_message_ciphertext', {
    msg_id: messageId,
    new_ciphertext: ciphertext,
  })
  if (error) throw error
}

export async function deleteMessageForAll(messageId) {
  const { error } = await supabase.rpc('delete_message_for_all', { msg_id: messageId })
  if (error) throw error
}

export async function hideMessageForMe(messageId) {
  const { error } = await supabase.rpc('hide_message_for_me', { msg_id: messageId })
  if (error) throw error
}

export async function clearConversationHistory(conversationId) {
  const { error } = await supabase.rpc('clear_conversation_history', {
    conv_id: conversationId,
  })
  if (error) throw error
}

export async function pinMessage(conversationId, messageId) {
  const { error } = await supabase.rpc('pin_message', {
    conv_id: conversationId,
    msg_id: messageId,
  })
  if (error) throw error
}

export async function unpinMessage(conversationId) {
  const { error } = await supabase.rpc('unpin_message', { conv_id: conversationId })
  if (error) throw error
}

export async function getHiddenMessageIds(conversationId) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return new Set()

  const { data: msgs } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)

  if (!msgs?.length) return new Set()

  const ids = msgs.map((m) => m.id)
  const { data: hidden, error } = await supabase
    .from('message_hidden')
    .select('message_id')
    .eq('user_id', session.user.id)
    .in('message_id', ids)

  if (error) {
    if (error.code === '42P01') return new Set()
    throw error
  }

  return new Set((hidden ?? []).map((h) => h.message_id))
}
