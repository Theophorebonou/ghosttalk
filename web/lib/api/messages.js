import { supabase } from '@/lib/supabase/client'
import { getHiddenMessageIds } from './messageActions'

const MESSAGE_SELECT = `
  *,
  message_reads (
    user_id,
    read_at
  ),
  message_reactions (
    user_id,
    emoji,
    created_at,
    profiles (
      username
    )
  )
`

export async function getMessages(conversationId) {
  try {
    const { error } = await supabase.rpc('purge_expired_messages', {
      conv_id: conversationId,
    })
    if (error) console.warn('purge_expired_messages:', error.message)
  } catch {
    /* migration 011 */
  }

  const hidden = await getHiddenMessageIds(conversationId)

  let data
  let error

  const result = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  data = result.data
  error = result.error

  if (error?.message?.includes('message_reactions')) {
    const fallback = await supabase
      .from('messages')
      .select(`*, message_reads (user_id, read_at)`)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    data = fallback.data
    error = fallback.error
  }

  if (error) throw error
  return (data ?? []).filter((m) => !hidden.has(m.id))
}

export async function sendMessage(conversationId, senderId, ciphertext, options = {}) {
  const row = {
    conversation_id: conversationId,
    sender_id: senderId,
    ciphertext,
  }

  if (options.expiresAt) row.expires_at = options.expiresAt
  if (options.ephemeralKind) row.ephemeral_kind = options.ephemeralKind
  if (options.mediaStoragePath) row.media_storage_path = options.mediaStoragePath

  const { data, error } = await supabase
    .from('messages')
    .insert(row)
    .select(MESSAGE_SELECT)
    .single()

  if (error) throw error
  return data
}

export function subscribeToMessages(conversationId, handlers) {
  const onInsert = typeof handlers === 'function' ? handlers : handlers.onInsert
  const onDelete = handlers.onDelete
  const onUpdate = handlers.onUpdate

  const channel = supabase.channel(`messages:${conversationId}`)

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => onInsert?.(payload.new)
  )

  if (onUpdate) {
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onUpdate?.(payload.new)
    )
  }

  if (onDelete) {
    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onDelete?.(payload.old)
    )
  }

  channel.subscribe()
  return channel
}

export async function purgeExpiredInConversation(conversationId) {
  try {
    const { error } = await supabase.rpc('purge_expired_messages', {
      conv_id: conversationId,
    })
    if (error) console.warn('purge_expired_messages:', error.message)
  } catch {
    /* ignore */
  }
}
