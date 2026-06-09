import { supabase } from '@/lib/supabase/client'

export async function setMessageReaction(messageId, emoji) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Non connecté')

  const { error } = await supabase.from('message_reactions').upsert(
    {
      message_id: messageId,
      user_id: session.user.id,
      emoji,
    },
    { onConflict: 'message_id,user_id' }
  )

  if (error) throw error
}

export async function removeMessageReaction(messageId) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return

  await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', session.user.id)
}

export function subscribeToReactions(conversationId, onChange) {
  return supabase
    .channel(`reactions:${conversationId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'message_reactions' },
      (payload) => onChange(payload)
    )
    .subscribe()
}
