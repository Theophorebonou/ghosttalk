import { WORDLIST } from './wordlist'
import { normalizeUsername } from '@/lib/utils/username'

const PHRASE_WORD_COUNT = 8

// Domaine synthétique : jamais affiché, jamais utilisé pour envoyer un email.
// Il sert uniquement d'identifiant Supabase dérivé du pseudo.
const GHOST_EMAIL_DOMAIN = 'ghost.ghosttalk.app'

/**
 * Génère une phrase de récupération de 8 mots (64 bits d'entropie).
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
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .join(' ')
}

export function ghostEmailForUsername(username) {
  return `${normalizeUsername(username)}@${GHOST_EMAIL_DOMAIN}`
}
