import { base64ToBuf, bufToBase64 } from './keys'

/**
 * Dérive une clé secrète partagée AES-GCM (256 bits) à partir de la clé privée locale et de la clé publique distante.
 */
export async function deriveSharedKey(localPrivateKey, remotePublicKeyBase64) {
  // Convertir la clé publique distante (base64 -> spki -> CryptoKey)
  const remotePublicKey = await crypto.subtle.importKey(
    'spki',
    base64ToBuf(remotePublicKeyBase64),
    { name: 'X25519', namedCurve: 'X25519' },
    true,
    []
  )

  // Dériver la clé partagée
  return await crypto.subtle.deriveKey(
    {
      name: 'X25519',
      public: remotePublicKey,
    },
    localPrivateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Chiffre un texte avec AES-GCM. Retourne le texte chiffré en base64 sous le format iv:ciphertext.
 */
export async function encryptMessage(sharedKey, plaintext) {
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const ciphertextBuf = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    sharedKey,
    data
  )

  const ivBase64 = bufToBase64(iv.buffer)
  const ciphertextBase64 = bufToBase64(ciphertextBuf)

  return `${ivBase64}:${ciphertextBase64}`
}

/**
 * Déchiffre un message (iv:ciphertext en base64) avec AES-GCM.
 */
export async function decryptMessage(sharedKey, encryptedBase64) {
  const [ivBase64, ciphertextBase64] = encryptedBase64.split(':')
  const iv = new Uint8Array(base64ToBuf(ivBase64))
  const ciphertextBuf = base64ToBuf(ciphertextBase64)

  const decryptedBuf = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    sharedKey,
    ciphertextBuf
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuf)
}
