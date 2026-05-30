import { supabase } from '@/lib/supabase/client'
import { decryptBytes, encryptBytes } from '@/lib/crypto/media'

const BUCKET = 'conversation-media'

export async function uploadEncryptedMedia(conversationId, encryptedBuffer) {
  const fileId = crypto.randomUUID()
  const path = `${conversationId}/${fileId}.enc`

  const { error } = await supabase.storage.from(BUCKET).upload(path, encryptedBuffer, {
    contentType: 'application/octet-stream',
    upsert: false,
  })

  if (error) throw error
  return path
}

export async function downloadEncryptedMedia(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) throw error
  return data.arrayBuffer()
}

export async function downloadAndDecryptMedia(sharedKey, storagePath, mime) {
  const encrypted = await downloadEncryptedMedia(storagePath)
  const decrypted = await decryptBytes(sharedKey, encrypted)
  return new Blob([decrypted], { type: mime || 'application/octet-stream' })
}

export async function prepareEncryptedMedia(sharedKey, fileBuffer) {
  return encryptBytes(sharedKey, fileBuffer)
}
