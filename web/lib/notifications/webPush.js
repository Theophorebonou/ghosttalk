'use client'

import { supabase } from '@/lib/supabase/client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlB64ToUint8Array(b64) {
  const pad    = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw    = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

async function getRegistration() {
  if (!isPushSupported()) return null
  return navigator.serviceWorker.ready
}

export async function getPushSubscription() {
  const reg = await getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export async function subscribeToPush(userId) {
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID public key manquante')
  const reg = await getRegistration()
  if (!reg) throw new Error('Service Worker non disponible')

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, subscription: sub.toJSON() },
    { onConflict: 'user_id,endpoint' }
  )
  if (error) throw error
  return sub
}

export async function unsubscribeFromPush(userId) {
  const sub = await getPushSubscription()
  if (!sub) return

  const endpoint = sub.endpoint
  await sub.unsubscribe()

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.warn('SW registration failed:', err)
    return null
  }
}
