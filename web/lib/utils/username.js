const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/
const RESERVED = new Set([
  'admin',
  'ghost',
  'ghosttalk',
  'support',
  'system',
  'root',
])

export function normalizeUsername(value) {
  return value.trim().toLowerCase()
}

export function validateUsername(value) {
  const username = normalizeUsername(value)

  if (!USERNAME_REGEX.test(username)) {
    return '3–20 caractères : lettres minuscules, chiffres et _ uniquement.'
  }

  if (RESERVED.has(username)) {
    return 'Ce pseudo est réservé.'
  }

  return null
}

export function suggestUsername() {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `ghost_${suffix}`
}
