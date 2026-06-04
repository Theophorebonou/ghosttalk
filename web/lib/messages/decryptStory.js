import { decryptStoryForViewer } from '@/lib/crypto/storyCrypto'
import { parseStoryPayload } from '@/lib/crypto/storyPayload'

export async function decryptStoryItem(story, viewerId) {
  const author = story.profiles
  if (!author?.public_key) {
    return { ...story, payload: { t: 'error', message: 'Auteur introuvable' } }
  }

  try {
    const raw = await decryptStoryForViewer(story.ciphertext, viewerId, author.public_key)
    return { ...story, payload: parseStoryPayload(raw) }
  } catch (err) {
    return {
      ...story,
      payload: { t: 'error', message: err.message ?? 'Story indéchiffrable' },
    }
  }
}
