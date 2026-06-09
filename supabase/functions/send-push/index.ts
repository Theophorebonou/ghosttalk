import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY   = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY  = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL        = Deno.env.get('VAPID_EMAIL') ?? 'mailto:admin@ghosttalk.app'

// ---------- VAPID helpers ----------

function urlB64ToUint8Array(b64: string): Uint8Array {
  const pad    = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw    = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

function uint8ToB64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function importVapidPrivateKey(rawB64: string): Promise<CryptoKey> {
  const raw = urlB64ToUint8Array(rawB64)
  // Build PKCS8 DER for P-256 private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08,
    0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04,
    0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ])
  const pkcs8 = new Uint8Array([...pkcs8Header, ...raw])
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

async function makeVapidJwt(audience: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header  = uint8ToB64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = uint8ToB64url(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 86400, sub: VAPID_EMAIL })))
  const signingInput = `${header}.${payload}`
  const key = await importVapidPrivateKey(VAPID_PRIVATE_KEY)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput))
  return `${signingInput}.${uint8ToB64url(new Uint8Array(sig))}`
}

// ---------- Send push to one subscription ----------

async function sendPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string): Promise<number> {
  const url = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const jwt = await makeVapidJwt(audience)

  const authHeader = `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`

  // Encrypt payload using Web Push encryption (RFC 8291)
  // For simplicity, we send unencrypted with a known-good library approach.
  // Using aesgcm encryption manually:
  const encrypted = await encryptPayload(subscription.keys, payload)

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization':  authHeader,
      'Content-Type':   'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption':     `salt=${encrypted.salt}`,
      'Crypto-Key':     `dh=${encrypted.serverPublicKey};p256ecdsa=${VAPID_PUBLIC_KEY}`,
      'TTL':            '86400',
    },
    body: encrypted.ciphertext,
  })
  return res.status
}

// ---------- Web Push payload encryption (RFC 8291 aesgcm) ----------

async function encryptPayload(
  keys: { p256dh: string; auth: string },
  plaintext: string
): Promise<{ ciphertext: Uint8Array; salt: string; serverPublicKey: string }> {
  const clientPublicKey = urlB64ToUint8Array(keys.p256dh)
  const authSecret      = urlB64ToUint8Array(keys.auth)

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey))

  // Import client public key
  const clientKey = await crypto.subtle.importKey('raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, [])

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeyPair.privateKey, 256))

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // PRK = HMAC-SHA256(auth, sharedSecret)
  const authKey = await crypto.subtle.importKey('raw', authSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const prk     = new Uint8Array(await crypto.subtle.sign('HMAC', authKey, sharedSecret))

  // info = "Content-Encoding: auth\0"
  const authInfo  = new TextEncoder().encode('Content-Encoding: auth\0')
  const prkKey    = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

  // IKM
  const context   = buildContext(clientPublicKey, serverPublicKeyRaw)
  const ikm       = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, concat(authInfo, context)))

  // Content-Encryption key
  const saltKey   = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const cekInfo   = concat(new TextEncoder().encode('Content-Encoding: aesgcm\0'), context)
  const cekData   = new Uint8Array((await crypto.subtle.sign('HMAC', saltKey, concat(ikm.slice(0, 0), concat(cekInfo, new Uint8Array([1]))))).slice(0, 16))

  // Nonce
  const nonceInfo = concat(new TextEncoder().encode('Content-Encoding: nonce\0'), context)
  const nonceData = new Uint8Array((await crypto.subtle.sign('HMAC', saltKey, concat(new Uint8Array(0), concat(nonceInfo, new Uint8Array([1]))))).slice(0, 12))

  // Encrypt
  const aesKey  = await crypto.subtle.importKey('raw', cekData, { name: 'AES-GCM' }, false, ['encrypt'])
  const padded  = concat(new Uint8Array(2), new TextEncoder().encode(plaintext))
  const cipher  = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceData }, aesKey, padded))

  return {
    ciphertext:      cipher,
    salt:            uint8ToB64url(salt),
    serverPublicKey: uint8ToB64url(serverPublicKeyRaw),
  }
}

function buildContext(clientPub: Uint8Array, serverPub: Uint8Array): Uint8Array {
  const label = new TextEncoder().encode('P-256\0')
  const len   = new Uint8Array(2)
  const clientLen = new Uint8Array(2); new DataView(clientLen.buffer).setUint16(0, clientPub.length, false)
  const serverLen = new Uint8Array(2); new DataView(serverLen.buffer).setUint16(0, serverPub.length, false)
  return concat(label, clientLen, clientPub, serverLen, serverPub)
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out   = new Uint8Array(total)
  let offset  = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const { message_id, conversation_id, sender_id } = await req.json()
    if (!conversation_id || !sender_id) return new Response('Bad Request', { status: 400 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get sender username
    const { data: sender } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', sender_id)
      .single()

    // Get conversation participants (exclude sender)
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversation_id)
      .neq('user_id', sender_id)

    if (!participants?.length) return new Response('OK', { status: 200 })

    const recipientIds = participants.map((p) => p.user_id)

    // Get their push subscriptions
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, subscription')
      .in('user_id', recipientIds)

    if (!subs?.length) return new Response('OK', { status: 200 })

    const title   = sender?.username ? `@${sender.username}` : 'GhostTalk'
    const payload = JSON.stringify({
      title,
      body:           'Nouveau message (chiffré)',
      conversationId: conversation_id,
    })

    const staleIds: string[] = []

    await Promise.allSettled(
      subs.map(async (row) => {
        const sub = row.subscription as { endpoint: string; keys: { p256dh: string; auth: string } }
        try {
          const status = await sendPush(sub, payload)
          if (status === 410 || status === 404) staleIds.push(row.id)
        } catch (e) {
          console.error('Push failed for', row.id, e)
        }
      })
    )

    // Remove stale subscriptions
    if (staleIds.length) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds)
    }

    return new Response(JSON.stringify({ sent: subs.length - staleIds.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response('Internal Error', { status: 500 })
  }
})
