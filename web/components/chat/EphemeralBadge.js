'use client'

import { useEffect, useState } from 'react'

export function EphemeralBadge({ message }) {
  const kind = message.ephemeral_kind
  const expiresAt = message.expires_at
  const payloadEphemeral = message.payload?.ephemeral
  const isEphemeral = !!(kind || expiresAt || payloadEphemeral)

  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!isEphemeral || kind !== 'timer' || !expiresAt) {
      setRemaining(null)
      return
    }

    function tick() {
      const ms = new Date(expiresAt).getTime() - Date.now()
      setRemaining(ms > 0 ? ms : 0)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isEphemeral, kind, expiresAt])

  if (!isEphemeral) return null

  const label =
    kind === 'after_read'
      ? 'Sans trace · après lecture'
      : remaining != null && remaining > 0
        ? `Sans trace · ${formatCountdown(remaining)}`
        : 'Sans trace'

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-medium text-current opacity-80"
      title="Ce message disparaîtra automatiquement"
    >
      <span aria-hidden>👁‍🗨</span>
      {label}
    </span>
  )
}

function formatCountdown(ms) {
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}
