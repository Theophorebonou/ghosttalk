/**
 * Construit les métadonnées serveur + payload pour un message éphémère.
 * @param {{ kind: 'timer', seconds: number } | { kind: 'after_read' } | null} mode
 */
export function buildEphemeralSendOptions(mode) {
  if (!mode) return { server: {}, payload: null }

  if (mode.kind === 'after_read') {
    return {
      server: { ephemeralKind: 'after_read', expiresAt: null },
      payload: { kind: 'after_read' },
    }
  }

  if (mode.kind === 'timer' && mode.seconds > 0) {
    const expiresAt = new Date(Date.now() + mode.seconds * 1000).toISOString()
    return {
      server: { ephemeralKind: 'timer', expiresAt },
      payload: { kind: 'timer', seconds: mode.seconds },
    }
  }

  return { server: {}, payload: null }
}
