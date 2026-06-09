import { supabase } from '@/lib/supabase/client'

export async function getProfileByUserId(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function isUsernameAvailable(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (error) throw error
  return data === null
}

export async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', username)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function searchProfiles(query, limit = 5) {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_seed, avatar_url')
    .ilike('username', `%${trimmed}%`)
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function uploadAvatar(userId, file) {
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(userId, file, { contentType: file.type, upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(userId)
  const url = `${data.publicUrl}?t=${Date.now()}`

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', userId)
  if (updateError) throw updateError

  return url
}

export async function removeAvatar(userId) {
  await supabase.storage.from('avatars').remove([userId])
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId)
  if (error) throw error
}

export async function updateProfilePublicKey(userId, publicKey) {
  const { error } = await supabase
    .from('profiles')
    .update({ public_key: publicKey })
    .eq('id', userId)

  if (error) throw error
}

export async function createProfile({ userId, username, publicKey }) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username,
      public_key: publicKey,
      avatar_seed: username,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
