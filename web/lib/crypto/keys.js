const STORAGE_KEY = 'ghosttalk_keypair'

export function bufToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function base64ToBuf(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function exportKeyPair(keyPair) {
  const [publicKey, privateKey] = await Promise.all([
    crypto.subtle.exportKey('spki', keyPair.publicKey),
    crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  ])

  return {
    publicKey: bufToBase64(publicKey),
    privateKey: bufToBase64(privateKey),
  }
}

async function importKeyPair(stored) {
  const publicKey = await crypto.subtle.importKey(
    'spki',
    base64ToBuf(stored.publicKey),
    { name: 'X25519', namedCurve: 'X25519' },
    true,
    []
  )

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    base64ToBuf(stored.privateKey),
    { name: 'X25519', namedCurve: 'X25519' },
    true,
    ['deriveKey', 'deriveBits']
  )

  return { publicKey, privateKey }
}

export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'X25519', namedCurve: 'X25519' },
    true,
    ['deriveKey', 'deriveBits']
  )

  return exportKeyPair(keyPair)
}

export function getStoredKeyPair() {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function storeKeyPair(keyPair) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keyPair))
}

export async function getOrCreateKeyPair() {
  const stored = getStoredKeyPair()
  if (stored?.publicKey && stored?.privateKey) {
    return stored
  }

  const keyPair = await generateKeyPair()
  storeKeyPair(keyPair)
  return keyPair
}

export async function importStoredKeyPair() {
  const stored = getStoredKeyPair()
  if (!stored) return null
  return importKeyPair(stored)
}

export function clearStoredKeyPair() {
  localStorage.removeItem(STORAGE_KEY)
}
