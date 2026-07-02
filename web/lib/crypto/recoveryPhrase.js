import { WORDLIST } from './wordlist'

// 10 mots parmi 256 = 80 bits d'entropie. Combiné au rate-limiting Supabase
// (en ligne) et au KDF lent de ghostWallet.js (hors ligne), la force brute
// est hors de portée.
const PHRASE_WORD_COUNT = 10

/**
 * Génère une phrase de récupération de 10 mots.
 * La wordlist fait exactement 256 mots : 1 octet aléatoire = 1 mot, sans biais.
 */
export function generateRecoveryPhrase() {
  const bytes = new Uint8Array(PHRASE_WORD_COUNT)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => WORDLIST[b]).join(' ')
}

/**
 * Normalise une phrase saisie : minuscules, accents retirés,
 * espaces/retours multiples réduits à un espace.
 */
export function normalizeRecoveryPhrase(input) {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .join(' ')
}
