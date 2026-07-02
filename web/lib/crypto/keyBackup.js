import { bufToBase64, base64ToBuf, storeKeyPair } from './keys'

const BACKUP_VERSION = 2
const SUPPORTED_VERSIONS = new Set([1, 2])

function parseBackupJson(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw

  if (!data || !SUPPORTED_VERSIONS.has(data.v)) {
    throw new Error('Format de sauvegarde non reconnu.')
  }

  if (!data.publicKey || !data.privateKey) {
    throw new Error('Sauvegarde invalide : clés manquantes.')
  }

  return { publicKey: data.publicKey, privateKey: data.privateKey }
}

/**
 * v2 : `account` ({ username, recoveryPhrase }) est optionnel — présent pour
 * les comptes fantômes, il permet de restaurer compte ET clés d'un seul fichier.
 */
export function buildBackupPayload(keyPair, account = null) {
  const payload = {
    v: BACKUP_VERSION,
    app: 'ghosttalk',
    createdAt: new Date().toISOString(),
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  }
  if (account?.username && account?.recoveryPhrase) {
    payload.username = account.username
    payload.recoveryPhrase = account.recoveryPhrase
  }
  return payload
}

export function exportKeyBackupPlaintext(keyPair, account = null) {
  return JSON.stringify(buildBackupPayload(keyPair, account), null, 2)
}

export async function deriveBackupKey(passphrase, saltBuf) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: 310000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function exportKeyBackupEncrypted(keyPair, passphrase, account = null) {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('La phrase secrète doit contenir au moins 8 caractères.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const aesKey = await deriveBackupKey(passphrase, salt)
  const plaintext = new TextEncoder().encode(exportKeyBackupPlaintext(keyPair, account))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext
  )

  return JSON.stringify(
    {
      v: BACKUP_VERSION,
      app: 'ghosttalk',
      encrypted: true,
      salt: bufToBase64(salt),
      iv: bufToBase64(iv),
      data: bufToBase64(ciphertext),
    },
    null,
    2
  )
}

export async function importKeyBackup(raw, passphrase) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw

  if (parsed?.encrypted) {
    if (!passphrase) {
      throw new Error('Phrase secrète requise pour cette sauvegarde.')
    }

    const salt = new Uint8Array(base64ToBuf(parsed.salt))
    const iv = new Uint8Array(base64ToBuf(parsed.iv))
    const aesKey = await deriveBackupKey(passphrase, salt)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      base64ToBuf(parsed.data)
    )

    const inner = new TextDecoder().decode(decrypted)
    const keyPair = parseBackupJson(inner)
    storeKeyPair(keyPair)
    return keyPair
  }

  const keyPair = parseBackupJson(parsed)
  storeKeyPair(keyPair)
  return keyPair
}

export function downloadBackupFile(content, filename = 'ghosttalk-keys.json') {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
