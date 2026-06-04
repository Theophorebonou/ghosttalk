const ENABLED_KEY = 'ghosttalk_notifications'
const BANNER_KEY = 'ghosttalk_notifications_banner_dismissed'

export function areNotificationsEnabled() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(ENABLED_KEY) !== 'false'
}

export function setNotificationsEnabled(enabled) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false')
}

export function dismissNotificationBanner() {
  if (typeof window === 'undefined') return
  localStorage.setItem(BANNER_KEY, '1')
}

export function wasNotificationBannerDismissed() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(BANNER_KEY) === '1'
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') {
    setNotificationsEnabled(true)
    return 'granted'
  }
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  if (result === 'granted') setNotificationsEnabled(true)
  return result
}

export function getConversationNotificationTitle(conv, currentUserId) {
  if (!conv) return 'GhostTalk'
  if (conv.type === 'group') return conv.name || 'Groupe'
  const other = conv.conversation_participants?.find(
    (p) => p.profiles?.id && p.profiles.id !== currentUserId
  )?.profiles
  return other?.username ? `@${other.username}` : 'Nouveau message'
}

export function isConversationMutedForUser(conv, userId) {
  const p = conv.conversation_participants?.find((x) => x.profiles?.id === userId)
  if (!p?.muted_until) return false
  return new Date(p.muted_until).getTime() > Date.now()
}

/**
 * Affiche une notif si :
 * - permission accordée + préférence activée
 * - message d'un autre utilisateur
 * - conversation non en sourdine
 * - onglet en arrière-plan OU autre conversation ouverte (liste / autre chat)
 */
export function shouldShowMessageNotification({
  conversationId,
  senderId,
  currentUserId,
  activeConversationId,
  conversation,
}) {
  if (!areNotificationsEnabled()) return false
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  if (!conversationId || !senderId || senderId === currentUserId) return false
  if (conversation && isConversationMutedForUser(conversation, currentUserId)) return false

  if (document.visibilityState === 'hidden') return true
  if (activeConversationId !== conversationId) return true
  return false
}

export function notifyNewMessage({ title, body, conversationId }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (!areNotificationsEnabled()) return

  try {
    const n = new Notification(title, {
      body: body ?? 'Nouveau message',
      tag: `ghosttalk-msg-${conversationId}`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
    n.onclick = () => {
      window.focus()
      if (typeof window !== 'undefined') {
        window.location.href = `/chat/${conversationId}`
      }
      n.close()
    }
  } catch (err) {
    console.warn('Notification failed', err)
  }
}

export function maybeNotifyIncomingMessage({
  message,
  conversation,
  currentUserId,
  activeConversationId,
}) {
  if (!message?.conversation_id || !message?.sender_id) return

  const conversationId = message.conversation_id
  const senderId = message.sender_id

  if (
    !shouldShowMessageNotification({
      conversationId,
      senderId,
      currentUserId,
      activeConversationId,
      conversation,
    })
  ) {
    return
  }

  const title = getConversationNotificationTitle(conversation, currentUserId)
  notifyNewMessage({
    title,
    body: 'Nouveau message (chiffré)',
    conversationId,
  })
}
