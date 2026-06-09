// GhostTalk Service Worker — Web Push

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
      icon:     '/favicon.ico',
      badge:    '/favicon.ico',
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
      // Focus existing window if already open
      for (const client of all) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      // Otherwise open new window
      return clients.openWindow(url)
    })
  )
})
