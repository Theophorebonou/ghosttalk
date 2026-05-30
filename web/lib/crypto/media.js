import { base64ToBuf, bufToBase64 } from './keys'

export async function encryptBytes(sharedKey, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    data
  )

  const combined = new Uint8Array(iv.length + ciphertextBuf.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertextBuf), iv.length)
  return combined.buffer
}

export async function decryptBytes(sharedKey, encryptedBuffer) {
  const bytes = new Uint8Array(encryptedBuffer)
  if (bytes.length < 13) {
    throw new Error('Fichier chiffré invalide')
  }

  const iv = bytes.slice(0, 12)
  const ciphertext = bytes.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    ciphertext
  )

  return decrypted
}

/** Petit fichier (< 256 Ko) : base64 inline dans le message (pas de storage). */
export const INLINE_MEDIA_MAX = 256 * 1024

export function encryptBytesToPayload(sharedKey, buffer) {
  return encryptBytes(sharedKey, buffer).then((encrypted) => ({
    inline: true,
    data: bufToBase64(encrypted),
  }))
}

export async function decryptInlineMedia(sharedKey, base64Data) {
  return decryptBytes(sharedKey, base64ToBuf(base64Data))
}
