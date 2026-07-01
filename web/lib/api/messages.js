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

export const MESSAGES_PAGE_SIZE = 50

async function fetchMessagesPage(conversationId, { before = null, limit = MESSAGES_PAGE_SIZE } = {}) {
  function buildQuery(select) {
    let query = supabase
      .from('messages')
      .select(select)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (before) query = query.lt('created_at', before)
    return query
  }

  let { data, error } = await buildQuery(MESSAGE_SELECT)

  if (error?.message?.includes('message_reactions')) {
    const fallback = await buildQuery(`*, message_reads (user_id, read_at)`)
    data = fallback.data
    error = fallback.error
  }

  if (error) throw error
  // Requête en desc pour paginer depuis les plus récents ; on remet en ordre chronologique
  return (data ?? []).reverse()
}

export async function getMessages(conversationId, { limit = MESSAGES_PAGE_SIZE } = {}) {
  // Purge en arrière-plan : ne bloque pas l'affichage (l'interval de ChatWindow purge aussi)
  purgeExpiredInConversation(conversationId)

  const [hidden, data] = await Promise.all([
    getHiddenMessageIds(),
    fetchMessagesPage(conversationId, { limit }),
  ])

  return data.filter((m) => !hidden.has(m.id))
}

export async function getOlderMessages(conversationId, beforeCreatedAt, limit = MESSAGES_PAGE_SIZE) {
  const [hidden, data] = await Promise.all([
    getHiddenMessageIds(),
    fetchMessagesPage(conversationId, { before: beforeCreatedAt, limit }),
  ])

  return data.filter((m) => !hidden.has(m.id))
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
