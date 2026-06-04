'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  areNotificationsEnabled,
  getNotificationPermission,
  requestNotificationPermission,
  setNotificationsEnabled,
} from '@/lib/notifications'
import { Button } from '@/components/ui/Button'

export function NotificationSettings() {
  const [permission, setPermission] = useState('default')
  const [enabled, setEnabled] = useState(true)

  const refresh = useCallback(() => {
    setPermission(getNotificationPermission())
    setEnabled(areNotificationsEnabled())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleEnable() {
    const result = await requestNotificationPermission()
    refresh()
    if (result === 'denied') {
      alert(
        'Notifications bloquées. Autorisez GhostTalk dans les réglages du navigateur (ou de l’appareil).'
      )
    }
  }

  const unsupported = permission === 'unsupported'

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-highlight/50 px-3 py-3">
        <span className="text-sm text-text">Alertes de nouveaux messages</span>
        <input
          type="checkbox"
          checked={enabled && permission === 'granted'}
          disabled={unsupported || permission === 'denied'}
          onChange={(e) => {
            const on = e.target.checked
            setNotificationsEnabled(on)
            setEnabled(on)
            if (on && permission === 'default') handleEnable()
          }}
          className="h-4 w-4 accent-primary"
        />
      </label>

      {unsupported && (
        <p className="text-xs text-text-muted">
          Ce navigateur ne prend pas en charge les notifications.
        </p>
      )}

      {permission === 'default' && !unsupported && (
        <Button type="button" className="w-full" onClick={handleEnable}>
          Autoriser les notifications
        </Button>
      )}

      {permission === 'granted' && (
        <p className="text-xs text-text-muted">
          Vous serez alerté même si GhostTalk est ouvert sur une autre conversation ou la liste
          des chats. Sur mobile, gardez l’onglet ouvert en arrière-plan.
        </p>
      )}

      {permission === 'denied' && (
        <p className="text-xs text-warning">
          Refusées par le navigateur. Réactivez-les dans Réglages → Site → Notifications.
        </p>
      )}
    </div>
  )
}
