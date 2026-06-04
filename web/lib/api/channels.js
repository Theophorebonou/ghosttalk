import { supabase } from '@/lib/supabase/client'

export async function createChannel(data) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: channel, error } = await supabase
    .from('channels')
    .insert({
      owner_id: user.id,
      username: data.username,
      name: data.name,
      description: data.description,
      avatar_seed: data.avatarSeed,
      is_official: false,
    })
    .select()
    .single()

  if (error) throw error
  return channel
}

export async function getChannels() {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('subscriber_count', { ascending: false })
    .limit(50)

  if (error) throw error
  return data ?? []
}

export async function getChannelByUsername(username) {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .eq('username', username)
    .single()

  if (error) throw error
  return data
}

export async function subscribeToChannel(channelId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data, error } = await supabase
    .from('channel_subscriptions')
    .insert({
      channel_id: channelId,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error

  // Incrémenter le compteur d'abonnés
  await supabase.rpc('increment_subscriber_count', { channel_id: channelId })

  return data
}

export async function unsubscribeFromChannel(channelId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { error } = await supabase
    .from('channel_subscriptions')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', user.id)

  if (error) throw error

  // Décrémenter le compteur d'abonnés
  await supabase.rpc('decrement_subscriber_count', { channel_id: channelId })
}

export async function getChannelMessages(channelId, limit = 50) {
  const { data, error } = await supabase
    .from('channel_messages')
    .select(`
      *,
      profiles (username, display_name, avatar_seed)
    `)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function sendChannelMessage(channelId, ciphertext, mediaStoragePath = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data, error } = await supabase
    .from('channel_messages')
    .insert({
      channel_id: channelId,
      sender_id: user.id,
      ciphertext,
      media_storage_path: mediaStoragePath,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export function subscribeToChannelMessages(channelId, callback) {
  const channel = supabase.channel(`channel_messages:${channelId}`)

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'channel_messages',
      filter: `channel_id=eq.${channelId}`,
    },
    (payload) => {
      callback(payload.new)
    }
  )

  channel.subscribe()
  return channel
}

export async function getUserSubscribedChannels() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('channel_subscriptions')
    .select(`
      channels (*)
    `)
    .eq('user_id', user.id)

  if (error) throw error
  return data?.map((sub) => sub.channels) ?? []
}
