import { deriveSharedKey, encryptMessage } from './e2e'
import { bufToBase64, base64ToBuf, importStoredKeyPair } from './keys'
import { encryptBytes, decryptBytes } from './media'
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

  const mediaKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const rawKey = await crypto.subtle.exportKey('raw', mediaKey)

  const encImage = await encryptBytes(mediaKey, buffer)
  const imageBase64 = bufToBase64(encImage)

  const inner = buildImageStoryPayload({
    name: file.name,
    mime,
    inline: true,
    data: imageBase64,
    caption,
  })

  const map = {}

  await Promise.all(
    recipients.map(async (recipient) => {
      const shared = await deriveSharedKey(localKeyPair.privateKey, recipient.public_key)
      const encKey = await encryptBytes(shared, rawKey)
      const entry = JSON.stringify({ v: 2, p: inner, k: bufToBase64(encKey) })
      map[recipient.id] = await encryptMessage(shared, entry)
    })
  )

  if (Object.keys(map).length === 0) {
    throw new Error('Échec du chiffrement image.')
  }

  return JSON.stringify(map)
}

export async function unwrapV2ImagePayload(v2Payload, authorPublicKey) {
  const localKeyPair = await importStoredKeyPair()
  if (!localKeyPair?.privateKey) throw new Error('Clés locales introuvables')

  const shared = await deriveSharedKey(localKeyPair.privateKey, authorPublicKey)

  const encKeyBuf = base64ToBuf(v2Payload.k)
  const rawKey = await decryptBytes(shared, encKeyBuf)
  const mediaKey = await crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  )

  const inner = JSON.parse(v2Payload.p)
  const encData = base64ToBuf(inner.data)
  const decryptedImage = await decryptBytes(mediaKey, encData)

  return {
    blobUrl: URL.createObjectURL(
      new Blob([decryptedImage], { type: inner.mime || 'image/jpeg' })
    ),
    mime: inner.mime,
    caption: inner.caption,
    name: inner.name,
  }
}
