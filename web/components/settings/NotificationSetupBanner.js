'use client'

import { useEffect, useState } from 'react'
import {
  dismissNotificationBanner,
  getNotificationPermission,
  requestNotificationPermission,
  wasNotificationBannerDismissed,
} from '@/lib/notifications'
import { Button } from '@/components/ui/Button'

export function NotificationSetupBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (wasNotificationBannerDismissed()) return
    if (getNotificationPermission() !== 'default') return
    setVisible(true)
  }, [])

  if (!visible) return null

  async function enable() {
    await requestNotificationPermission()
    setVisible(false)
    dismissNotificationBanner()
  }

  function dismiss() {
    dismissNotificationBanner()
    setVisible(false)
  }

  return (
    <div className="relative z-20 shrink-0 border-b border-border bg-primary/15 px-4 py-3">
      <p className="text-sm font-medium text-text">Activer les notifications ?</p>
      <p className="mt-1 text-xs text-text-muted">
        Recevez une alerte quand quelqu&apos;un vous écrit, même si l&apos;app reste ouverte sur
        votre téléphone.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" className="!py-2 !px-4 text-xs" onClick={enable}>
          Autoriser
        </Button>
        <Button type="button" variant="ghost" className="!py-2 !px-4 text-xs" onClick={dismiss}>
          Plus tard
        </Button>
      </div>
    </div>
  )
}
