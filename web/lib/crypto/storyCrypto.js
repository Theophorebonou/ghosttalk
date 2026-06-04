import { deriveSharedKey, encryptMessage, decryptMessage } from './e2e'
import { getStoredKeyPair, importStoredKeyPair, bufToBase64 } from './keys'

function normalizePublicKey(contact) {
  return contact?.public_key?.trim?.() || null
}

/**
 * Destinataires du chiffrement : contacts + auteur (pour relire sa propre story).
 */
export function buildStoryRecipients(contacts, author) {
  const stored = getStoredKeyPair()
  const authorKey = normalizePublicKey(author) || stored?.publicKey
  const list = []
  const seen = new Set()

  function add(person) {
    const key = normalizePublicKey(person)
    if (!person?.id || !key || seen.has(person.id)) return
    seen.add(person.id)
    list.push({ id: person.id, public_key: key })
  }

  if (author?.id && authorKey) {
    add({ id: author.id, public_key: authorKey })
  }

  for (const c of contacts ?? []) {
    add(c)
  }

  return list
}

/**
 * Chiffre une story pour chaque destinataire.
 * Stocké en JSON : { "userId": "iv:cipher", ... }
 */
export async function encryptStoryForContacts(plaintext, contacts, author) {
  const recipients = buildStoryRecipients(contacts, author)
  if (recipients.length === 0) {
    throw new Error('Clés de chiffrement introuvables. Reconnectez-vous.')
  }

  const localKeyPair = await importStoredKeyPair()
  if (!localKeyPair?.privateKey) {
    throw new Error('Clés locales introuvables. Reconnectez-vous.')
  }

  const map = {}
  const failures = []

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        const shared = await deriveSharedKey(localKeyPair.privateKey, recipient.public_key)
        map[recipient.id] = await encryptMessage(shared, plaintext)
      } catch (err) {
        failures.push(recipient.id)
        console.error('Story encrypt failed for', recipient.id, err)
      }
    })
  )

  const keys = Object.keys(map)
  if (keys.length === 0) {
    throw new Error('Échec du chiffrement pour tous les destinataires.')
  }

  if (failures.length > 0) {
    console.warn('Story: destinataires ignorés', failures)
  }

  return JSON.stringify(map)
}

export async function decryptStoryForViewer(ciphertextJson, viewerId, authorPublicKey) {
  let map
  try {
    map = JSON.parse(ciphertextJson)
  } catch {
    throw new Error('Story invalide')
  }

  const localKeyPair = await importStoredKeyPair()
  if (!localKeyPair?.privateKey) {
    throw new Error('Clés locales introuvables')
  }

  let entry = map[viewerId]
  
  // Fallback: si l'auteur regarde sa propre story, essayer toutes les entrées
  // car l'ID stocké peut être différent de l'ID actuel (cas de reconnexion)
  if (!entry) {
    const localPublicKey = bufToBase64(await crypto.subtle.exportKey('spki', localKeyPair.publicKey))
    for (const [id, ciphertext] of Object.entries(map)) {
      try {
        const shared = await deriveSharedKey(localKeyPair.privateKey, authorPublicKey)
        const decrypted = await decryptMessage(shared, ciphertext)
        // Si on arrive à déchiffrer, c'est que c'est la bonne entrée
        entry = ciphertext
        break
      } catch {
        continue
      }
    }
  }

  if (!entry) {
    throw new Error('Story non destinée à ce compte')
  }

  const shared = await deriveSharedKey(localKeyPair.privateKey, authorPublicKey)
  return decryptMessage(shared, entry)
}
