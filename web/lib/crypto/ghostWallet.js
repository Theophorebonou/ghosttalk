// Identité fantôme = phrase de récupération.
// La phrase dérive (PBKDF2 lent) une seed Ed25519 ; la clé publique en base58
// sert d'identifiant Supabase (provider Web3/Solana), la signature d'un message
// SIWS prouve la possession. Aucun email, aucun téléphone, rien de public.

import * as ed from '@noble/ed25519'
import { normalizeRecoveryPhrase } from './recoveryPhrase'

// KDF volontairement lent : même en cas de fuite de la base, tester des
// phrases coûte ~0,3 s chacune (mêmes paramètres que lib/crypto/keyBackup.js).
const KDF_ITERATIONS = 310000
const KDF_SALT = 'ghosttalk-ghost-auth-v1'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function toBase58(bytes) {
  let value = 0n
  for (const byte of bytes) value = (value << 8n) + BigInt(byte)

  let out = ''
  while (value > 0n) {
    out = BASE58_ALPHABET[Number(value % 58n)] + out
    value /= 58n
  }
  // Zéros de tête (convention base58)
  for (const byte of bytes) {
    if (byte !== 0) break
    out = '1' + out
  }
  return out
}

async function deriveSeed(phrase) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizeRecoveryPhrase(phrase)),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(KDF_SALT),
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  return new Uint8Array(bits)
}

/**
 * Message « Sign in with Solana » au format exact attendu par Supabase
 * (voir GoTrueClient.signInWithWeb3 — reproduit ici car on signe nous-mêmes,
 * sans extension wallet).
 */
function buildSiwsMessage(publicKeyB58, url) {
  return [
    `${url.host} wants you to sign in with your Solana account:`,
    publicKeyB58,
    '',
    'Version: 1',
    `URI: ${url.href}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n')
}

/**
 * Construit les credentials `signInWithWeb3` à partir de la phrase.
 * Même phrase ⇒ même clé ⇒ même compte : la phrase EST l'identité.
 *
 * Le message est signé avec l'ORIGINE racine (pas l'URL de la page) :
 * Supabase valide l'URI contre Site URL / Redirect URLs, et « /login »
 * n'y figure pas.
 */
export async function buildGhostCredentials(phrase, location = window.location) {
  const url = { host: location.host, href: `${location.origin}/` }

  const seed = await deriveSeed(phrase)
  const publicKey = await ed.getPublicKeyAsync(seed)
  const message = buildSiwsMessage(toBase58(publicKey), url)
  const signature = await ed.signAsync(new TextEncoder().encode(message), seed)

  return { chain: 'solana', message, signature }
}
