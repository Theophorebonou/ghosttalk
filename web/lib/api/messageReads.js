import { supabase } from '@/lib/supabase/client'

export async function markMessageRead(messageId) {
  const { error } = await supabase.rpc('mark_message_read', { msg_id: messageId })
  if (error) throw error
}

export async function markMessagesRead(messageIds) {
  await Promise.all(messageIds.map((id) => markMessageRead(id).catch(console.error)))
}

export function subscribeToMessageReads(conversationId, onRead) {
  return supabase
    .channel(`reads:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reads',
      },
      async (payload) => {
        const row = payload.new
        const { data: msg } = await supabase
          .from('messages')
          .select('id, conversation_id, sender_id')
          .eq('id', row.message_id)
          .single()

        if (msg?.conversation_id === conversationId) {
          onRead({ ...row, message: msg })
        }
      }
    )
    .subscribe()
}
