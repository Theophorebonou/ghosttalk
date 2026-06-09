// GhostTalk Service Worker — Web Push + Offline cache

const CACHE_NAME = 'ghosttalk-v1'
const OFFLINE_URL = '/chat'

// Cache shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/chat', '/login', '/icon-192.png', '/icon-512.png', '/manifest.json'])
    ).then(() => self.skipWaiting())
  )
})

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Network-first for navigation, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== location.origin) return

  // Skip Supabase API calls — always network
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/realtime/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // Static assets: cache-first
  if (request.destination === 'image' || request.destination === 'font' || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((res) => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then((c) => c.put(request, clone))
        return res
      }))
    )
    return
  }
})

// ---- Web Push ----

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'GhostTalk', body: event.data.text() } }

  const title          = data.title  ?? 'GhostTalk'
  const body           = data.body   ?? 'Nouveau message'
  const conversationId = data.conversationId ?? null

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     '/icon-192.png',
      badge:    '/icon-192.png',
      tag:      conversationId ? `ghosttalk-conv-${conversationId}` : 'ghosttalk',
      renotify: true,
      data:     { conversationId },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const convId = event.notification.data?.conversationId
  const url    = convId ? `/chat/${convId}` : '/chat'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      for (const client of all) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
