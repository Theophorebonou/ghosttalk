'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  areNotificationsEnabled,
  getNotificationPermission,
  requestNotificationPermission,
  setNotificationsEnabled,
} from '@/lib/notifications'
import {
  isPushSupported,
  getPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/notifications/webPush'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

export function NotificationSettings() {
  const { user } = useAuth()
  const [permission, setPermission]   = useState('default')
  const [enabled, setEnabled]         = useState(true)
  const [pushSub, setPushSub]         = useState(null)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushError, setPushError]     = useState(null)
  const pushSupported = isPushSupported()

  const refresh = useCallback(async () => {
    setPermission(getNotificationPermission())
    setEnabled(areNotificationsEnabled())
    if (pushSupported) {
      const sub = await getPushSubscription()
      setPushSub(sub)
    }
  }, [pushSupported])

  useEffect(() => { refresh() }, [refresh])

  async function handleEnable() {
    const result = await requestNotificationPermission()
    refresh()
    if (result === 'denied') {
      alert('Notifications bloquées. Autorisez GhostTalk dans les réglages du navigateur.')
    }
  }

  async function handlePushToggle(on) {
    if (!user?.id) return
    setPushLoading(true)
    setPushError(null)
    try {
      if (on) {
        // Make sure we have permission first
        if (permission !== 'granted') {
          const result = await requestNotificationPermission()
          setPermission(getNotificationPermission())
          if (result !== 'granted') { setPushLoading(false); return }
        }
        await subscribeToPush(user.id)
      } else {
        await unsubscribeFromPush(user.id)
      }
      await refresh()
    } catch (err) {
      setPushError(err.message ?? 'Erreur')
    } finally {
      setPushLoading(false)
    }
  }

  const unsupported = permission === 'unsupported'

  return (
    <div className="space-y-4">
      {/* In-app notifications */}
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-highlight/50 px-3 py-3">
        <div>
          <span className="text-sm text-text">Alertes dans l'app</span>
          <p className="text-[11px] text-text-muted">Quand GhostTalk est ouvert sur un autre onglet</p>
        </div>
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

      {/* Web Push notifications */}
      {pushSupported && (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-highlight/50 px-3 py-3">
          <div>
            <span className="text-sm text-text">Notifications push</span>
            <p className="text-[11px] text-text-muted">
              {pushSub
                ? 'Activées — vous recevez les alertes même app fermée'
                : 'Recevez les alertes même quand l\'app est fermée'}
            </p>
          </div>
          <input
            type="checkbox"
            checked={!!pushSub}
            disabled={pushLoading || permission === 'denied'}
            onChange={(e) => handlePushToggle(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>
      )}

      {pushError && <p className="text-xs text-error">{pushError}</p>}

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

      {permission === 'denied' && (
        <p className="text-xs text-warning">
          Refusées par le navigateur. Réactivez-les dans Réglages → Site → Notifications.
        </p>
      )}
    </div>
  )
}
