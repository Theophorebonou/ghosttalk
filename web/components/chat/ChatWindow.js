'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { getConversationById, markAsRead } from '@/lib/api/conversations'
import {
  getMessages,
  getOlderMessages,
  sendMessage,
  subscribeToMessages,
  purgeExpiredInConversation,
  MESSAGES_PAGE_SIZE,
} from '@/lib/api/messages'
import { getCachedMessages, setCachedMessages } from '@/lib/cache/messageCache'
import { markMessagesRead, subscribeToMessageReads } from '@/lib/api/messageReads'
import {
  editMessageCiphertext,
  deleteMessageForAll,
  hideMessageForMe,
  pinMessage,
  unpinMessage,
} from '@/lib/api/messageActions'
import { setMessageReaction, removeMessageReaction, subscribeToReactions } from '@/lib/api/reactions'
import { getUserPresence, updatePresence, isUserBlocked, getBlockedUsers, subscribeToPresence } from '@/lib/api/conversationSettings'
import { uploadEncryptedMedia, prepareEncryptedMedia } from '@/lib/api/media'
import { initiateCall, getIncomingCalls, subscribeToIncomingCalls, getActiveCall, updateCallStatus } from '@/lib/api/calls'
import { CallManager, isWebRTCSupported } from '@/lib/webrtc/callManager'
import { deriveSharedKey, encryptMessage } from '@/lib/crypto/e2e'
import { bufToBase64, importStoredKeyPair } from '@/lib/crypto/keys'
import { INLINE_MEDIA_MAX } from '@/lib/crypto/media'
import {
  buildMediaPayload,
  buildStickerPayload,
  buildTextPayload,
  parseMessagePayload,
} from '@/lib/crypto/messagePayload'
import { MAX_MEDIA_BYTES } from '@/lib/constants/media'
import { getHideReadReceipts } from '@/lib/constants/wellbeing'
import { decryptChatMessage } from '@/lib/messages/decryptChatMessage'
import { buildEphemeralSendOptions } from '@/lib/messages/ephemeral'
import { useAuth } from '@/hooks/useAuth'
import { useTypingIndicator } from '@/hooks/useTypingIndicator'
import dynamic from 'next/dynamic'
import { Spinner } from '@/components/ui/Spinner'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { MessageDateSeparator } from './MessageDateSeparator'
import { isSameCalendarDay, formatLastSeen } from '@/lib/utils/messageDates'
import { WellbeingBar } from './WellbeingBar'
import { GroupIcon } from '@/components/ui/GroupIcon'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ChatHeaderMenu } from './ChatHeaderMenu'
import { PinnedMessageBar } from './PinnedMessageBar'

// Chargés à la demande : hors du bundle initial de la conversation
const ManageGroupMembersModal = dynamic(
  () => import('./ManageGroupMembersModal').then((m) => m.ManageGroupMembersModal),
  { ssr: false }
)
const ForwardMessageModal = dynamic(
  () => import('./ForwardMessageModal').then((m) => m.ForwardMessageModal),
  { ssr: false }
)
const CallModal = dynamic(() => import('./CallModal').then((m) => m.CallModal), {
  ssr: false,
})
const ChatSearchPanel = dynamic(
  () => import('./ChatSearchPanel').then((m) => m.ChatSearchPanel),
  { ssr: false }
)
import {
  consumePendingStoryReply,
  setPendingStoryReply,
} from '@/components/stories/StoryViewer'

export function ChatWindow({ conversationId }) {
  const { user, profile } = useAuth()
  const [conversation, setConversation] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sharedKey, setSharedKey] = useState(null)
  const [error, setError] = useState(null)
  const [isGroup, setIsGroup] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [replyToMessage, setReplyToMessage] = useState(null)
  const [storyReplyContext, setStoryReplyContext] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [forwardMessage, setForwardMessage] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [highlightId, setHighlightId] = useState(null)
  const [presenceLabel, setPresenceLabel] = useState(null)
  const [blockedUserIds, setBlockedUserIds] = useState(new Set())
  const [isOtherUserBlocked, setIsOtherUserBlocked] = useState(false)
  
  // Appels
  const [showCallModal, setShowCallModal] = useState(false)
  const [activeCall, setActiveCall] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [callManager] = useState(() => new CallManager())

  const [loadingOlder, setLoadingOlder] = useState(false)

  const messagesEndRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const topSentinelRef = useRef(null)
  const messageRefs = useRef({})
  const markedReadRef = useRef(new Set())
  const afterReadTimersRef = useRef({})
  const refreshMessagesRef = useRef(null)
  const loadOlderRef = useRef(null)
  const loadingOlderRef = useRef(false)
  const hasMoreRef = useRef(true)
  const scrollAdjustRef = useRef(null)

  // Miroirs lus par les callbacks realtime sans résouscription
  const messagesRef = useRef([])
  messagesRef.current = messages
  const blockedUserIdsRef = useRef(blockedUserIds)
  blockedUserIdsRef.current = blockedUserIds

  const { typingLabel, broadcastTyping } = useTypingIndicator(
    conversationId,
    user?.id,
    profile?.username
  )

  useEffect(() => {
    if (!otherUser?.id || isGroup) return
    const pending = consumePendingStoryReply()
    if (!pending) return
    if (pending.authorId === otherUser.id) {
      setStoryReplyContext(pending)
    } else {
      setPendingStoryReply(pending)
    }
  }, [otherUser?.id, isGroup])

  useEffect(() => {
    updatePresence(true)
    const id = setInterval(() => updatePresence(true), 60000)
    
    // Charger les utilisateurs bloqués
    getBlockedUsers().then((blocked) => {
      const ids = new Set(blocked.map((b) => b.blocked_id))
      setBlockedUserIds(ids)
    }).catch(console.error)
    
    // Vérifier si l'autre utilisateur est bloqué (sera mis à jour quand otherUser est chargé)
    if (otherUser?.id) {
      isUserBlocked(otherUser.id).then(setIsOtherUserBlocked).catch(console.error)
    }
    
    // Écouter les appels entrants
    if (isWebRTCSupported() && user?.id) {
      const channel = subscribeToIncomingCalls(user.id, (call) => {
        setIncomingCall(call)
        setShowCallModal(true)
      })
      return () => {
        clearInterval(id)
        updatePresence(false)
        channel?.unsubscribe()
      }
    }
    
    return () => {
      clearInterval(id)
      updatePresence(false)
    }
  }, [])

  useEffect(() => {
    if (!otherUser?.id || isGroup) return

    isUserBlocked(otherUser.id).then(setIsOtherUserBlocked).catch(console.error)

    function applyPresence(p) {
      if (!p) return
      const STALE_MS = 3 * 60 * 1000
      const isReallyOnline =
        p.is_online &&
        p.last_seen_at &&
        Date.now() - new Date(p.last_seen_at).getTime() < STALE_MS

      if (isReallyOnline) {
        setPresenceLabel('en ligne')
      } else if (p.last_seen_at) {
        setPresenceLabel(formatLastSeen(new Date(p.last_seen_at)))
      }
    }

    getUserPresence(otherUser.id).then(applyPresence)

    const channel = subscribeToPresence(otherUser.id, applyPresence)
    return () => channel?.unsubscribe()
  }, [otherUser?.id, isGroup])

  async function reloadConversation() {
    const conv = await getConversationById(conversationId)
    setConversation(conv)
    const userParticipant = conv.conversation_participants.find(
      (cp) => cp.profiles.id === user?.id
    )
    setUserRole(userParticipant?.role || 'member')
    return conv
  }

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  function isNearBottom() {
    const el = scrollContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }

  async function handleStartCall(callType = 'audio') {
    if (isGroup) {
      alert('Les appels sont disponibles en conversation directe uniquement.')
      return
    }
    if (!otherUser?.id) {
      alert('Impossible d\'appeler : contact introuvable.')
      return
    }

    setIncomingCall(null)
    setShowCallModal(true)

    try {
      const call = await initiateCall(otherUser.id, callType, conversationId)
      setActiveCall(call)

      await callManager.startCall(
        otherUser.id,
        callType,
        conversationId,
        call.id
      )
      setActiveCall({ ...call, status: 'ringing' })
    } catch (err) {
      console.error('Failed to start call:', err)
      setShowCallModal(false)
      setActiveCall(null)
      alert(
        err.message?.includes('Permission') || err.name === 'NotAllowedError'
          ? 'Autorisez le micro (et la caméra pour la vidéo) dans le navigateur.'
          : `Échec de l'appel : ${err.message ?? 'erreur inconnue'}`
      )
    }
  }

  async function handleEndCall() {
    try {
      await callManager.endCall()
    } catch (err) {
      console.error(err)
    }
    setActiveCall(null)
    setShowCallModal(false)
    setIncomingCall(null)
  }

  function handleRejectIncomingCall() {
    if (incomingCall) {
      updateCallStatus(incomingCall.id, 'rejected').catch(console.error)
    }
    setIncomingCall(null)
    setShowCallModal(false)
  }

  const scrollToMessage = useCallback((id) => {
    messageRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
    setTimeout(() => setHighlightId(null), 2000)
  }, [])

  const refreshMessages = useCallback(async () => {
    if (!sharedKey) return
    const history = await getMessages(conversationId)
    const decrypted = await Promise.all(history.map((m) => decryptChatMessage(sharedKey, m)))
    const filtered = decrypted.filter((m) => !blockedUserIdsRef.current.has(m.sender_id))
    setMessages(filtered)
    hasMoreRef.current = history.length >= MESSAGES_PAGE_SIZE
  }, [sharedKey, conversationId])

  refreshMessagesRef.current = refreshMessages

  useEffect(() => {
    if (!user) return
    let isMounted = true

    async function init() {
      try {
        setLoading(true)
        // Invalide la clé de l'ancienne conversation : l'effect historique
        // ne doit jamais déchiffrer la nouvelle conversation avec l'ancienne clé
        setSharedKey(null)
        setMessages([])
        const conv = await getConversationById(conversationId)
        if (!isMounted) return

        markAsRead(conversationId).catch(console.error)
        setConversation(conv)
        setIsGroup(conv.type === 'group')

        const userParticipant = conv.conversation_participants.find(
          (cp) => cp.profiles.id === user.id
        )
        setUserRole(userParticipant?.role || 'member')

        if (conv.type === 'direct') {
          const recipient = conv.conversation_participants.find(
            (cp) => cp.profiles.id !== user.id
          )?.profiles
          setOtherUser(recipient)
          if (!recipient) throw new Error('Participant introuvable')

          const localKeyPair = await importStoredKeyPair()
          if (!localKeyPair?.privateKey) {
            throw new Error('Clé privée locale introuvable. Reconnectez-vous.')
          }
          const derived = await deriveSharedKey(localKeyPair.privateKey, recipient.public_key)
          if (!isMounted) return
          setSharedKey(derived)
        } else {
          const encoder = new TextEncoder()
          const convKeyData = encoder.encode(conversationId + 'group-key')
          const convKey = await crypto.subtle.importKey(
            'raw',
            await crypto.subtle.digest('SHA-256', convKeyData),
            'AES-GCM',
            true,
            ['encrypt', 'decrypt']
          )
          if (!isMounted) return
          setSharedKey(convKey)
        }
      } catch (err) {
        if (isMounted) setError(err.message)
      }
    }

    init()
    return () => {
      isMounted = false
    }
  }, [conversationId, user])

  const participantIds =
    conversation?.conversation_participants?.map((cp) => cp.profiles.id) ?? []

  const myParticipant = conversation?.conversation_participants?.find(
    (cp) => cp.profiles?.id === user?.id
  )
  const isArchived = !!myParticipant?.archived_at
  const isMuted = myParticipant?.muted_until && new Date(myParticipant.muted_until).getTime() > Date.now()

  const pinnedMessage = conversation?.pinned_message_id
    ? messages.find((m) => m.id === conversation.pinned_message_id)
    : null

  useEffect(() => {
    if (!user?.id || !sharedKey || loading) return
    if (getHideReadReceipts()) return

    const normalToMark = []
    const afterReadToSchedule = []

    messages
      .filter((m) => m.sender_id !== user.id && !markedReadRef.current.has(m.id))
      .forEach((m) => {
        markedReadRef.current.add(m.id)
        if (m.ephemeral_kind === 'after_read') {
          afterReadToSchedule.push(m)
        } else {
          normalToMark.push(m.id)
        }
      })

    if (normalToMark.length > 0) {
      markMessagesRead(normalToMark)
      markAsRead(conversationId).catch(console.error)
    }

    afterReadToSchedule.forEach((m) => {
      if (afterReadTimersRef.current[m.id]) return
      afterReadTimersRef.current[m.id] = setTimeout(() => {
        markMessagesRead([m.id])
        delete afterReadTimersRef.current[m.id]
      }, 10000)
    })
  }, [messages, user?.id, sharedKey, loading, conversationId])

  useEffect(() => {
    return () => {
      Object.values(afterReadTimersRef.current).forEach(clearTimeout)
      afterReadTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (!conversationId || !sharedKey) return
    const tick = async () => {
      setMessages((prev) => {
        const hasEphemeral = prev.some((m) => m.expires_at)
        if (!hasEphemeral) return prev
        return prev.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now())
      })
      await purgeExpiredInConversation(conversationId).catch(() => { })
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [conversationId, sharedKey])

  // Historique : cache mémoire rendu immédiatement, données fraîches en arrière-plan (SWR)
  useEffect(() => {
    if (!sharedKey || !conversationId || !user) return

    let cancelled = false
    hasMoreRef.current = true

    const cached = getCachedMessages(conversationId)
    if (cached) {
      setMessages(cached)
      setLoading(false)
      requestAnimationFrame(() => scrollToBottom('auto'))
    }

    async function fetchHistory() {
      try {
        const history = await getMessages(conversationId)
        if (cancelled) return

        const decryptedHistory = await Promise.all(
          history.map((msg) => decryptChatMessage(sharedKey, msg))
        )
        if (cancelled) return

        const filtered = decryptedHistory.filter(
          (m) => !blockedUserIdsRef.current.has(m.sender_id)
        )
        hasMoreRef.current = history.length >= MESSAGES_PAGE_SIZE
        setMessages(filtered)
        setLoading(false)
        markedReadRef.current = new Set()
        requestAnimationFrame(() => scrollToBottom('auto'))
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }

    fetchHistory()
    return () => {
      cancelled = true
    }
  }, [sharedKey, conversationId, user?.id])

  // Alimente le cache mémoire (réouverture instantanée)
  useEffect(() => {
    if (loading || !conversationId) return
    setCachedMessages(conversationId, messages)
  }, [messages, loading, conversationId])

  // Souscriptions realtime — stables tant que la conversation ne change pas
  useEffect(() => {
    if (!sharedKey || !conversationId || !user) return

    const msgChannel = subscribeToMessages(conversationId, {
      onInsert: async (newMsg) => {
        const decrypted = await decryptChatMessage(sharedKey, newMsg)
        // Ne pas afficher les messages des utilisateurs bloqués
        if (blockedUserIdsRef.current.has(newMsg.sender_id)) return

        // Autoscroll seulement si on est déjà en bas (ou message envoyé par soi)
        const shouldScroll = newMsg.sender_id === user.id || isNearBottom()
        setMessages((prev) => {
          if (prev.some((m) => m.id === decrypted.id)) return prev
          // Envoi par soi : le realtime peut arriver avant la réponse HTTP —
          // remplacer le message optimiste au lieu de dupliquer
          if (newMsg.sender_id === user.id) {
            const tempIdx = prev.findIndex((m) => m.pending && m.sender_id === user.id)
            if (tempIdx >= 0) {
              const copy = [...prev]
              copy[tempIdx] = decrypted
              return copy
            }
          }
          return [...prev, decrypted]
        })
        if (shouldScroll) requestAnimationFrame(() => scrollToBottom('smooth'))

        if (newMsg.sender_id !== user.id) {
          markAsRead(conversationId).catch(console.error)
        }
      },
      onUpdate: async (updated) => {
        const decrypted = await decryptChatMessage(sharedKey, updated)
        setMessages((prev) =>
          prev.map((m) => (m.id === decrypted.id ? decrypted : m))
        )
      },
      onDelete: (old) => {
        if (!old?.id) return
        setMessages((prev) => prev.filter((m) => m.id !== old.id))
      },
    })

    const readChannel = subscribeToMessageReads(conversationId, (readRow) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== readRow.message_id) return m
          const existing = m.message_reads || []
          if (existing.some((r) => r.user_id === readRow.user_id)) return m
          return {
            ...m,
            message_reads: [
              ...existing,
              { user_id: readRow.user_id, read_at: readRow.read_at },
            ],
          }
        })
      )
    })

    const reactChannel = subscribeToReactions(conversationId, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const { message_id, user_id, emoji } = payload.new
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== message_id) return m
            const existing = m.message_reactions || []
            const idx = existing.findIndex((r) => r.user_id === user_id)
            let reactions
            if (idx >= 0) {
              reactions = existing.map((r) =>
                r.user_id === user_id ? { ...r, emoji } : r
              )
            } else {
              reactions = [...existing, { user_id, emoji }]
            }
            return { ...m, message_reactions: reactions }
          })
        )
      } else if (payload.eventType === 'DELETE') {
        const { message_id, user_id } = payload.old
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== message_id) return m
            return {
              ...m,
              message_reactions: (m.message_reactions || []).filter(
                (r) => r.user_id !== user_id
              ),
            }
          })
        )
      }
    })

    return () => {
      msgChannel?.unsubscribe?.()
      readChannel?.unsubscribe?.()
      reactChannel?.unsubscribe?.()
    }
  }, [sharedKey, conversationId, user?.id])

  // Chargement des messages plus anciens (pagination par curseur)
  const loadOlderMessages = useCallback(async () => {
    if (!sharedKey || loadingOlderRef.current || !hasMoreRef.current) return
    const oldest = messagesRef.current.find((m) => !m.pending && !m.failed)
    if (!oldest) return

    loadingOlderRef.current = true
    setLoadingOlder(true)
    try {
      const older = await getOlderMessages(conversationId, oldest.created_at)
      const decrypted = await Promise.all(
        older.map((m) => decryptChatMessage(sharedKey, m))
      )
      const filtered = decrypted.filter(
        (m) => !blockedUserIdsRef.current.has(m.sender_id)
      )
      hasMoreRef.current = older.length >= MESSAGES_PAGE_SIZE

      // Mémorise la distance au bas pour restaurer la position après insertion
      const el = scrollContainerRef.current
      scrollAdjustRef.current = el ? el.scrollHeight - el.scrollTop : null

      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id))
        const fresh = filtered.filter((m) => !known.has(m.id))
        if (fresh.length === 0) {
          scrollAdjustRef.current = null
          return prev
        }
        return [...fresh, ...prev]
      })
    } catch (err) {
      console.error('loadOlderMessages:', err)
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [sharedKey, conversationId])

  loadOlderRef.current = loadOlderMessages

  // Restaure la position de scroll après insertion de messages anciens
  useLayoutEffect(() => {
    if (scrollAdjustRef.current == null) return
    const el = scrollContainerRef.current
    if (el) el.scrollTop = el.scrollHeight - scrollAdjustRef.current
    scrollAdjustRef.current = null
  }, [messages])

  // Sentinel en haut de liste : déclenche le chargement de l'historique
  useEffect(() => {
    if (loading) return
    const sentinel = topSentinelRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !container) return

    let observer = null
    let raf2 = null
    // Attache après le scroll initial vers le bas (sinon le sentinel visible
    // au premier rendu déclencherait un chargement parasite)
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        observer = new IntersectionObserver(
          (entries) => {
            if (entries[0]?.isIntersecting) loadOlderRef.current?.()
          },
          { root: container, rootMargin: '200px 0px 0px 0px' }
        )
        observer.observe(sentinel)
      })
    })

    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
      observer?.disconnect()
    }
  }, [loading, conversationId])

  function getReplyToPayload() {
    if (!replyToMessage?.payload) return null
    let snippet = 'Contenu multimédia'
    if (replyToMessage.payload.t === 'text') {
      snippet = replyToMessage.payload.b.substring(0, 60)
    }
    let sender = otherUser?.username || 'Inconnu'
    if (isGroup) {
      const p = conversation?.conversation_participants?.find(
        (cp) => cp.profiles.id === replyToMessage.sender_id
      )
      if (p) sender = p.profiles.username
    }
    if (replyToMessage.sender_id === user?.id) sender = 'Vous'
    return { id: replyToMessage.id, senderName: sender, snippet }
  }

  function assertOtherUserNotBlocked() {
    // État déjà chargé/maintenu localement : pas de round-trip réseau par envoi
    if (!isGroup && otherUser?.id && (isOtherUserBlocked || blockedUserIds.has(otherUser.id))) {
      throw new Error(`Vous avez bloqué @${otherUser.username}. Débloquez cet utilisateur pour envoyer un message.`)
    }
  }

  function makeTempId() {
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  function appendOptimisticMessage(payload, sendOptions = {}) {
    const tempId = makeTempId()
    const optimistic = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      expires_at: sendOptions.expiresAt ?? null,
      ephemeral_kind: sendOptions.ephemeralKind ?? null,
      payload,
      message_reads: [],
      message_reactions: [],
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    requestAnimationFrame(() => scrollToBottom('smooth'))
    return tempId
  }

  function replaceOptimisticMessage(tempId, decrypted) {
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId)
      // Le canal realtime a pu livrer le message avant la réponse HTTP :
      // on écrase sa copie (conserve localUrl pour les médias)
      const idx = withoutTemp.findIndex((m) => m.id === decrypted.id)
      if (idx >= 0) {
        const copy = [...withoutTemp]
        copy[idx] = decrypted
        return copy
      }
      return [...withoutTemp, decrypted]
    })
  }

  function markOptimisticFailed(tempId, retry) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, pending: false, failed: true, _retry: retry } : m
      )
    )
  }

  // Envoi optimiste : le message apparaît immédiatement (horloge),
  // le chiffrement + réseau se font en arrière-plan.
  function sendOptimistic(payloadJson, sendOptions = {}, localExtras = null) {
    const payload = { ...parseMessagePayload(payloadJson), ...(localExtras || {}) }
    const tempId = appendOptimisticMessage(payload, sendOptions)

    void (async () => {
      try {
        const ciphertext = await encryptMessage(sharedKey, payloadJson)
        const sent = await sendMessage(conversationId, user.id, ciphertext, sendOptions)
        const decrypted = await decryptChatMessage(sharedKey, sent)
        if (localExtras?.localUrl) decrypted.payload.localUrl = localExtras.localUrl
        replaceOptimisticMessage(tempId, decrypted)
      } catch (err) {
        console.error('sendOptimistic:', err)
        markOptimisticFailed(tempId, () => sendOptimistic(payloadJson, sendOptions, localExtras))
      }
    })()
  }

  async function handleSendMessage(text, ephemeralMode = null, editTarget = null) {
    if (!sharedKey || !user) return

    assertOtherUserNotBlocked()

    if (editTarget?.id) {
      const ciphertext = await encryptMessage(
        sharedKey,
        buildTextPayload(text, null, null, null, null)
      )
      await editMessageCiphertext(editTarget.id, ciphertext)
      setEditingMessage(null)
      await refreshMessages()
      return
    }

    const replyTo = getReplyToPayload()
    const { server, payload: ephemeralPayload } = buildEphemeralSendOptions(ephemeralMode)
    const storyReplyMeta = storyReplyContext
      ? {
        storyId: storyReplyContext.storyId,
        authorUsername: storyReplyContext.authorUsername,
      }
      : null

    const payloadJson = buildTextPayload(text, replyTo, ephemeralPayload, storyReplyMeta)

    setReplyToMessage(null)
    setStoryReplyContext(null)

    sendOptimistic(payloadJson, {
      expiresAt: server.expiresAt,
      ephemeralKind: server.ephemeralKind,
    })
  }

  function handleSendSticker(emoji) {
    if (!sharedKey || !user) return
    sendOptimistic(buildStickerPayload(emoji))
  }

  // Pipeline média : préview locale immédiate, chiffrement/upload en arrière-plan
  function sendFilePipeline(args) {
    const { buffer, name, mime, size, replyTo, ephemeralPayload, server, localUrl } = args

    const optimisticPayload = { t: 'media', name, mime, size, localUrl }
    if (replyTo) optimisticPayload.replyTo = replyTo
    if (ephemeralPayload) optimisticPayload.ephemeral = ephemeralPayload

    const tempId = appendOptimisticMessage(optimisticPayload, {
      expiresAt: server.expiresAt,
      ephemeralKind: server.ephemeralKind,
    })

    void (async () => {
      try {
        const encrypted = await prepareEncryptedMedia(sharedKey, buffer)

        let payloadJson
        let mediaStoragePath = null
        if (size <= INLINE_MEDIA_MAX) {
          payloadJson = buildMediaPayload({
            name,
            mime,
            size,
            inline: true,
            data: bufToBase64(encrypted),
            replyTo,
            ephemeral: ephemeralPayload,
          })
        } else {
          mediaStoragePath = await uploadEncryptedMedia(conversationId, encrypted)
          payloadJson = buildMediaPayload({
            name,
            mime,
            size,
            path: mediaStoragePath,
            replyTo,
            ephemeral: ephemeralPayload,
          })
        }

        const ciphertext = await encryptMessage(sharedKey, payloadJson)
        const sent = await sendMessage(conversationId, user.id, ciphertext, {
          expiresAt: server.expiresAt,
          ephemeralKind: server.ephemeralKind,
          mediaStoragePath,
        })
        const decrypted = await decryptChatMessage(sharedKey, sent)
        // Réutilise la préview locale : pas de re-téléchargement/déchiffrement
        decrypted.payload.localUrl = localUrl
        replaceOptimisticMessage(tempId, decrypted)
      } catch (err) {
        console.error('sendFilePipeline:', err)
        markOptimisticFailed(tempId, () => sendFilePipeline(args))
      }
    })()
  }

  async function handleSendFile(file, ephemeralMode = null) {
    if (!sharedKey || !user) return

    assertOtherUserNotBlocked()

    if (file.size > MAX_MEDIA_BYTES) {
      throw new Error('Fichier trop volumineux (maximum 50 Mo).')
    }

    const buffer = await file.arrayBuffer()
    const mime = file.type || 'application/octet-stream'
    const replyTo = getReplyToPayload()
    const { server, payload: ephemeralPayload } = buildEphemeralSendOptions(ephemeralMode)
    const localUrl = URL.createObjectURL(new Blob([buffer], { type: mime }))

    setReplyToMessage(null)

    sendFilePipeline({
      buffer,
      name: file.name,
      mime,
      size: file.size,
      replyTo,
      ephemeralPayload,
      server,
      localUrl,
    })
  }

  function handleRetryMessage(message) {
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
    message._retry?.()
  }

  async function handleReact(message, emoji) {
    const mine = message.message_reactions?.find((r) => r.user_id === user?.id)

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== message.id) return m
        const reactions = [...(m.message_reactions || [])]
        const idx = reactions.findIndex((r) => r.user_id === user?.id)
        if (mine?.emoji === emoji) {
          if (idx >= 0) reactions.splice(idx, 1)
        } else {
          if (idx >= 0) {
            reactions[idx] = { ...reactions[idx], emoji }
          } else {
            reactions.push({ user_id: user?.id, emoji })
          }
        }
        return { ...m, message_reactions: reactions }
      })
    )

    try {
      if (mine?.emoji === emoji) {
        await removeMessageReaction(message.id)
      } else {
        await setMessageReaction(message.id, emoji)
      }
    } catch (err) {
      refreshMessagesRef.current?.()
    }
  }

  async function handleUnblocked() {
    if (otherUser?.id) {
      setIsOtherUserBlocked(false)
      // Recharger la liste des utilisateurs bloqués
      const blocked = await getBlockedUsers()
      const ids = new Set(blocked.map((b) => b.blocked_id))
      setBlockedUserIds(ids)
    }
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center backdrop-blur-sm">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center backdrop-blur-sm">
        <Spinner className="h-8 w-8 text-violet-500" />
      </div>
    )
  }

  const participants = conversation?.conversation_participants || []
  const memberCount = participants.length

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Header */}
      <header className="relative z-20 flex items-center justify-between border-b border-border bg-surface-highlight px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/chat"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text md:hidden"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          {/* Avatar */}
          {isGroup ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <GroupIcon className="h-5 w-5 text-primary" />
            </div>
          ) : otherUser ? (
            <UserAvatar username={otherUser.username} avatarUrl={otherUser.avatar_url} size="md" />
          ) : (
            <div className="h-10 w-10 animate-pulse rounded-full bg-surface" />
          )}

          <div className="min-w-0">
            {isGroup ? (
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-text">
                  <span className="truncate">{conversation?.name?.trim() || 'Groupe'}</span>
                  {isMuted && (
                    <svg className="h-4 w-4 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  )}
                </h2>
                <p className="text-xs text-text-muted">{memberCount} membres</p>
              </div>
            ) : otherUser ? (
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-text">
                  <span className="truncate">@{otherUser.username}</span>
                  {isMuted && (
                    <svg className="h-4 w-4 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  )}
                </h2>
                <p className="text-xs text-text-muted">
                  {typingLabel ? (
                    <span className="text-primary">{typingLabel}</span>
                  ) : presenceLabel ? (
                    presenceLabel
                  ) : (
                    'chiffre de bout en bout'
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="h-5 w-28 animate-pulse rounded bg-surface" />
                <div className="h-3 w-20 animate-pulse rounded bg-surface" />
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text"
            title="Rechercher"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          {!isGroup && isWebRTCSupported() && (
            <>
              <button
                type="button"
                onClick={() => handleStartCall('audio')}
                className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text"
                title="Appel audio"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => handleStartCall('video')}
                className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text"
                title="Appel vidéo"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </>
          )}
          {isGroup && (
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text"
              onClick={() => setShowMembersModal(true)}
              title="Membres"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
          )}
          <ChatHeaderMenu
            conversationId={conversationId}
            isGroup={isGroup}
            otherUser={otherUser}
            isArchived={isArchived}
            isMuted={isMuted}
            isBlocked={isOtherUserBlocked}
            onCleared={() => {
              setMessages([])
              reloadConversation()
            }}
            onArchived={reloadConversation}
            onMuted={reloadConversation}
            onUnblocked={handleUnblocked}
          />
        </div>
      </header>

      {showSearch && (
        <ChatSearchPanel
          messages={messages}
          onClose={() => setShowSearch(false)}
          onSelectMessage={scrollToMessage}
          currentUserId={user?.id}
          otherUserName={otherUser?.username}
        />
      )}

      {pinnedMessage && (
        <PinnedMessageBar
          message={pinnedMessage}
          onUnpin={async () => {
            await unpinMessage(conversationId)
            reloadConversation()
          }}
          onClick={() => scrollToMessage(pinnedMessage.id)}
        />
      )}

      {showMembersModal && isGroup && (
        <ManageGroupMembersModal
          conversationId={conversationId}
          groupName={conversation?.name}
          participants={participants}
          currentUserId={user?.id}
          isAdmin={userRole === 'admin'}
          onClose={() => setShowMembersModal(false)}
          onUpdated={reloadConversation}
        />
      )}

      {forwardMessage && (
        <ForwardMessageModal
          message={{
            ...forwardMessage,
            senderName:
              forwardMessage.sender_id === user?.id
                ? 'Vous'
                : participants.find((p) => p.profiles.id === forwardMessage.sender_id)
                  ?.profiles?.username,
          }}
          onClose={() => setForwardMessage(null)}
        />
      )}

      {showCallModal && (
        <CallModal
          isOpen={showCallModal}
          onClose={handleEndCall}
          onCallEnded={handleEndCall}
          callId={activeCall?.id || incomingCall?.id}
          isIncoming={!!incomingCall && !activeCall}
          callType={activeCall?.call_type || incomingCall?.call_type || 'audio'}
          callManager={callManager}
          remoteDisplayName={otherUser?.username}
        />
      )}

      <WellbeingBar />

      {/* Messages area with chat background */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto py-2"
        style={{ backgroundColor: 'var(--background)' }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-highlight">
              <svg className="h-8 w-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-text-muted">
              {isGroup
                ? 'Aucun message dans ce groupe'
                : 'Aucun message'}
            </p>
            <p className="text-xs text-text-muted">
              Les messages sont chiffres de bout en bout
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Sentinel : charge les messages plus anciens quand il devient visible */}
            <div ref={topSentinelRef} aria-hidden="true" />
            {loadingOlder && (
              <div className="flex justify-center py-2">
                <Spinner className="h-5 w-5 text-primary" />
              </div>
            )}
            {messages.map((msg, index) => {
              const sender = participants.find((p) => p.profiles.id === msg.sender_id)?.profiles
              const prev = messages[index - 1]
              const showDateSeparator =
                !prev || !isSameCalendarDay(prev.created_at, msg.created_at)

              return (
                <Fragment key={msg.id}>
                  {showDateSeparator && <MessageDateSeparator date={msg.created_at} />}
                  <MessageBubble
                    message={msg}
                    sharedKey={sharedKey}
                    isOwn={msg.sender_id === user?.id}
                    senderName={isGroup ? sender?.username : null}
                    isGroup={isGroup}
                    isDirect={!isGroup}
                    currentUserId={user?.id}
                    otherParticipantIds={participantIds}
                    highlight={highlightId === msg.id}
                    messageRef={(el) => {
                      if (el) messageRefs.current[msg.id] = el
                    }}
                    onReply={() => setReplyToMessage(msg)}
                    onEdit={(m) => setEditingMessage(m)}
                    onForward={(m) => setForwardMessage(m)}
                    onPin={async (m) => {
                      await pinMessage(conversationId, m.id)
                      reloadConversation()
                    }}
                    onReact={handleReact}
                    onRetry={handleRetryMessage}
                    onScrollToReply={scrollToMessage}
                    onDeleteForMe={async (m) => {
                      await hideMessageForMe(m.id)
                      setMessages((prev) => prev.filter((x) => x.id !== m.id))
                    }}
                    onDeleteForAll={async (m) => {
                      if (!confirm('Supprimer ce message pour tout le monde ?')) return
                      await deleteMessageForAll(m.id)
                      setMessages((prev) => prev.filter((x) => x.id !== m.id))
                    }}
                  />
                </Fragment>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {typingLabel && (
        <div className="border-t border-border bg-surface px-4 py-2">
          <p className="text-xs text-primary">{typingLabel}</p>
        </div>
      )}

      <ChatInput
        conversationId={conversationId}
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        disabled={!sharedKey}
        replyToMessage={replyToMessage}
        onCancelReply={() => setReplyToMessage(null)}
        storyReplyContext={storyReplyContext}
        onCancelStoryReply={() => setStoryReplyContext(null)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        onTyping={broadcastTyping}
        onStartCall={handleStartCall}
        onSendSticker={handleSendSticker}
      />
    </div>
  )
}
