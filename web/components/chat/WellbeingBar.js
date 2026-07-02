'use client'

import { useState } from 'react'
import {
  getHideReadReceipts,
  setHideReadReceipts,
} from '@/lib/constants/wellbeing'

/**
 * Barre discrète : l'utilisateur peut refuser d'envoyer ses accusés de lecture
 * (réduit la pression sociale pendant les échanges).
 */
export function WellbeingBar() {
  const [hideReceipts, setHideReceipts] = useState(() => getHideReadReceipts())

  function toggle() {
    const next = !hideReceipts
    setHideReceipts(next)
    setHideReadReceipts(next)
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-highlight px-3 py-1.5 text-[11px] text-text-muted">
      <span className="truncate">Bien-être · conversations apaisées</span>
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 hover:text-text-muted">
        <input
          type="checkbox"
          checked={hideReceipts}
          onChange={toggle}
          className="h-3 w-3 rounded border-border bg-surface text-primary focus:ring-primary"
        />
        <span>Masquer mes « lu »</span>
      </label>
    </div>
  )
}
