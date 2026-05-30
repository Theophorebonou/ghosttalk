const AUTH_ERROR_MESSAGES = {
  'Invalid login credentials': 'Email ou mot de passe incorrect.',
  'Email not confirmed': 'Confirmez votre email via le lien reçu avant de vous connecter.',
  'User already registered': 'Un compte existe déjà avec cet email.',
  'Signup requires a valid password': 'Le mot de passe doit contenir au moins 6 caractères.',
  'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
  'Token has expired or is invalid': 'Code expiré ou invalide. Demandez un nouveau code.',
  'OTP expired': 'Code expiré. Demandez-en un nouveau.',
  'Invalid OTP': 'Code incorrect.',
  'Phone number is invalid': 'Numéro de téléphone invalide (format international, ex. +33612345678).',
  'Signups not allowed for otp': 'Connexion par SMS non activée sur ce projet.',
  'Email rate limit exceeded': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'For security purposes, you can only request this after': 'Attendez quelques secondes avant de redemander un code.',
}

export function formatAuthError(error) {
  if (!error) return 'Une erreur est survenue.'

  const message = error.message ?? String(error)

  for (const [key, value] of Object.entries(AUTH_ERROR_MESSAGES)) {
    if (message.includes(key)) return value
  }

  return message
}

export function normalizePhoneNumber(value) {
  const trimmed = value.trim().replace(/\s/g, '')
  if (!trimmed) return ''
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('00')) return `+${trimmed.slice(2)}`
  return `+${trimmed}`
}
