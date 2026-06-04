import { supabase } from '@/lib/supabase/client'

const STORY_BUCKET = 'story-media'
const STORY_TTL_MS = 24 * 60 * 60 * 1000

export const STORY_DURATION_HOURS = 24

async function getAuthUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

export async function purgeExpiredStories() {
  try {
    const { error } = await supabase.rpc('purge_expired_stories')
    if (error) console.warn('purge_expired_stories:', error.message)
  } catch {
    /* migration 012 non appliquée */
  }
}

/**
 * Contacts = autres participants des conversations (direct + groupes).
 */
export async function getContactProfiles(currentUserId) {
  const uid = currentUserId ?? (await getAuthUserId())
  if (!uid) return []

  const { data, error } = await supabase
    .from('conversation_participants')
    .select(
      `
      user_id,
      profiles (
        id,
        username,
        avatar_seed,
        public_key
      )
    `
    )
    .neq('user_id', uid)

  if (error) throw error

  const seen = new Map()
  for (const row of data ?? []) {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    if (p?.id && p.public_key && !seen.has(p.id)) {
      seen.set(p.id, p)
    }
  }

  return Array.from(seen.values())
}

async function attachAuthors(stories) {
  if (!stories?.length) return []

  const authorIds = [...new Set(stories.map((s) => s.author_id))]
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_seed, public_key')
    .in('id', authorIds)

  if (error) throw error

  const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
  return stories.map((s) => ({
    ...s,
    profiles: byId[s.author_id] ?? null,
  }))
}

export async function getActiveStories() {
  await purgeExpiredStories()

  const { data, error } = await supabase
    .from('stories')
    .select(
      `
      id,
      author_id,
      ciphertext,
      media_storage_path,
      expires_at,
      created_at,
      story_views (
        viewer_id,
        viewed_at
      )
    `
    )
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    if (error.code === '42P01' || error.message?.includes('stories')) {
      throw new Error(
        'Table « stories » absente. Appliquez la migration 012_stories.sql sur Supabase.'
      )
    }
    throw error
  }

  return attachAuthors(data ?? [])
}

export async function getMyActiveStories() {
  const uid = await getAuthUserId()
  if (!uid) return []

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('author_id', uid)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function publishStory({ ciphertext, mediaStoragePath = null, authorId }) {
  const uid = authorId ?? (await getAuthUserId())
  if (!uid) throw new Error('Non connecté')

  const expiresAt = new Date(Date.now() + STORY_TTL_MS).toISOString()

  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_id: uid,
      ciphertext,
      media_storage_path: mediaStoragePath,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '42P01' || error.message?.includes('stories')) {
      throw new Error(
        'Impossible de publier : migration 012_stories.sql non appliquée sur Supabase.'
      )
    }
    throw new Error(error.message ?? 'Publication refusée')
  }

  return data
}

export async function markStoryViewed(storyId) {
  const uid = await getAuthUserId()
  if (!uid) return

  const { error } = await supabase.from('story_views').insert({
    story_id: storyId,
    viewer_id: uid,
  })

  if (error && error.code !== '23505') throw error
}

export async function uploadStoryMedia(authorId, encryptedBuffer) {
  const fileId = crypto.randomUUID()
  const path = `${authorId}/${fileId}.enc`

  const { error } = await supabase.storage.from(STORY_BUCKET).upload(path, encryptedBuffer, {
    contentType: 'application/octet-stream',
    upsert: false,
  })

  if (error) throw error
  return path
}

export async function downloadStoryMedia(path) {
  const { data, error } = await supabase.storage.from(STORY_BUCKET).download(path)
  if (error) throw error
  return data.arrayBuffer()
}

export function subscribeToStories(onChange) {
  return supabase
    .channel('stories-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
      onChange()
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'story_views' }, () => {
      onChange()
    })
    .subscribe()
}
