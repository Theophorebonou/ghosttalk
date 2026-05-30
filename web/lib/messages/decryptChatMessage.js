import { decryptMessage } from '@/lib/crypto/e2e'
import { parseMessagePayload } from '@/lib/crypto/messagePayload'

export async function decryptChatMessage(sharedKey, message) {
  try {
    const raw = await decryptMessage(sharedKey, message.ciphertext)
    return { ...message, payload: parseMessagePayload(raw) }
  } catch {
    return {
      ...message,
      payload: { t: 'error', message: 'Message indéchiffrable' },
    }
  }
}
