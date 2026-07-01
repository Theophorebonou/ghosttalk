// Cache mémoire des messages déchiffrés, par conversation (stale-while-revalidate).
// Volontairement en mémoire uniquement (E2E : rien ne persiste sur disque).

const cache = new Map()

export function getCachedMessages(conversationId) {
  return cache.get(conversationId) ?? null
}

export function setCachedMessages(conversationId, messages) {
  // On ne met jamais en cache les messages optimistes non confirmés
  cache.set(
    conversationId,
    messages.filter((m) => !m.pending && !m.failed)
  )
}

export function clearMessageCache(conversationId = null) {
  if (conversationId) {
    cache.delete(conversationId)
  } else {
    cache.clear()
  }
}
