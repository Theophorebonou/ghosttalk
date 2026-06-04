import { deriveSharedKey, encryptMessage } from './e2e'
import { bufToBase64, importStoredKeyPair } from './keys'
import { encryptBytes } from './media'
import { buildImageStoryPayload } from './storyPayload'
import { buildStoryRecipients } from './storyCrypto'

export async function buildImageStoryCiphertext(buffer, file, contacts, author, caption = '') {
  const recipients = buildStoryRecipients(contacts, author)
  if (recipients.length === 0) {
    throw new Error('Clés de chiffrement introuvables.')
  }

  const localKeyPair = await importStoredKeyPair()
  if (!localKeyPair?.privateKey) throw new Error('Clés locales introuvables')

  const mime = file.type || 'image/jpeg'
  const map = {}

  await Promise.all(
    recipients.map(async (recipient) => {
      const shared = await deriveSharedKey(localKeyPair.privateKey, recipient.public_key)
      const enc = await encryptBytes(shared, buffer)
      const inner = buildImageStoryPayload({
        name: file.name,
        mime,
        inline: true,
        data: bufToBase64(enc),
        caption,
      })
      map[recipient.id] = await encryptMessage(shared, inner)
    })
  )

  if (Object.keys(map).length === 0) {
    throw new Error('Échec du chiffrement image.')
  }

  return JSON.stringify(map)
}
