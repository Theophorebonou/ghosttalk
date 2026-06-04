import { supabase } from '@/lib/supabase/client'

export async function scheduleMessage(data) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: scheduled, error } = await supabase
    .from('scheduled_messages')
    .insert({
      user_id: user.id,
      conversation_id: data.conversationId,
      ciphertext: data.ciphertext,
      scheduled_for: data.scheduledFor,
      media_storage_path: data.mediaStoragePath,
      expires_at: data.expiresAt,
      ephemeral_kind: data.ephemeralKind,
    })
    .select()
    .single()

  if (error) throw error
  return scheduled
}

export async function getScheduledMessages() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('scheduled_messages')
    .select(`
      *,
      conversations (
        id,
        name,
        type,
        conversation_participants (
          profiles (username, display_name)
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function cancelScheduledMessage(messageId) {
  const { error } = await supabase
    .from('scheduled_messages')
    .delete()
    .eq('id', messageId)

  if (error) throw error
}

export async function updateScheduledMessage(messageId, updates) {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .update(updates)
    .eq('id', messageId)
    .select()
    .single()

  if (error) throw error
  return data
}
