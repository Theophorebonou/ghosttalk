export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function notifyNewMessage({ title, body, conversationId }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return

  const n = new Notification(title, {
    body,
    tag: `ghosttalk-${conversationId}`,
    icon: '/favicon.ico',
  })
  n.onclick = () => {
    window.focus()
    window.location.href = `/chat/${conversationId}`
    n.close()
  }
}
