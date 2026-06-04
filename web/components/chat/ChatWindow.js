'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { getConversationById, markAsRead } from '@/lib/api/conversations'
import {
  getMessages,
  sendMessage,
  subscribeToMessages,
  purgeExpiredInConversation,
} from '@/lib/api/messages'
import { markMessagesRead, subscribeToMessageReads } from '@/lib/api/messageReads'
import {
  editMessageCiphertext,
  deleteMessageForAll,
  hideMessageForMe,
  pinMessage,
  unpinMessage,
} from '@/lib/api/messageActions'
import { setMessageReaction, removeMessageReaction, subscribeToReactions } from '@/lib/api/reactions'
import { getUserPresence, updatePresence, isUserBlocked, getBlockedUsers } from '@/lib/api/conversationSettings'
import { uploadEncryptedMedia, prepareEncryptedMedia } from '@/lib/api/media'
import { initiateCall, getIncomingCalls, subscribeToIncomingCalls, getActiveCall, updateCallStatus } from '@/lib/api/calls'
import { CallManager, isWebRTCSupported } from '@/lib/webrtc/callManager'
import { deriveSharedKey, encryptMessage } from '@/lib/crypto/e2e'
import { bufToBase64, importStoredKeyPair } from '@/lib/crypto/keys'
import { INLINE_MEDIA_MAX } from '@/lib/crypto/media'
import { buildMediaPayload, buildTextPayload } from '@/lib/crypto/messagePayload'
import { MAX_MEDIA_BYTES } from '@/lib/constants/media'
import { getHideReadReceipts } from '@/lib/constants/wellbeing'
import { decryptChatMessage } from '@/lib/messages/decryptChatMessage'
import { buildEphemeralSendOptions } from '@/lib/messages/ephemeral'
import { useAuth } from '@/hooks/useAuth'
import { useTypingIndicator } from '@/hooks/useTypingIndicator'
import { notifyNewMessage } from '@/lib/notifications'
import { Spinner } from '@/components/ui/Spinner'
import { ChatInput } from './ChatInput'
import { ManageGroupMembersModal } from './ManageGroupMembersModal'
import { MessageBubble } from './MessageBubble'
import { WellbeingBar } from './WellbeingBar'
import { GroupIcon } from '@/components/ui/GroupIcon'
import { ChatHeaderMenu } from './ChatHeaderMenu'
import { ChatSearchPanel } from './ChatSearchPanel'
import { ForwardMessageModal } from './ForwardMessageModal'
import { PinnedMessageBar } from './PinnedMessageBar'
import { CallModal } from './CallModal'
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

  const messagesEndRef = useRef(null)
  const messageRefs = useRef({})
  const markedReadRef = useRef(new Set())

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
    if (isWebRTCSupported()) {
      const channel = subscribeToIncomingCalls((call) => {
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
    
    // Vérifier si bloqué
    isUserBlocked(otherUser.id).then(setIsOtherUserBlocked).catch(console.error)
    
    function refresh() {
      getUserPresence(otherUser.id).then((p) => {
        if (!p) return
        if (p.is_online) setPresenceLabel('en ligne')
        else if (p.last_seen_at) {
          setPresenceLabel(
            `vu ${new Date(p.last_seen_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
          )
        }
      })
    }
    refresh()
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleStartCall(callType = 'audio') {
    if (!otherUser?.id) return
    try {
      const call = await initiateCall(otherUser.id, callType, conversationId)
      setActiveCall(call)
      setShowCallModal(true)
    } catch (err) {
      console.error('Failed to start call:', err)
      alert('Échec de l\'appel')
    }
  }

  function handleEndCall() {
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
    // Filtrer les messages des utilisateurs bloqués
    const filtered = decrypted.filter((m) => !blockedUserIds.has(m.sender_id))
    setMessages(filtered)
  }, [sharedKey, conversationId, blockedUserIds])

  useEffect(() => {
    if (!user) return
    let isMounted = true

    async function init() {
      try {
        setLoading(true)
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

    const toMark = messages
      .filter((m) => m.sender_id !== user.id && !markedReadRef.current.has(m.id))
      .map((m) => m.id)

    if (toMark.length === 0) return
    toMark.forEach((id) => markedReadRef.current.add(id))
    markMessagesRead(toMark)
    markAsRead(conversationId).catch(console.error)
  }, [messages, user?.id, sharedKey, loading, conversationId])

  useEffect(() => {
    if (!conversationId || !sharedKey) return
    const tick = async () => {
      await purgeExpiredInConversation(conversationId).catch(() => { })
      setMessages((prev) =>
        prev.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now())
      )
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [conversationId, sharedKey])

  useEffect(() => {
    if (!sharedKey || !conversationId || !user) return

    let isMounted = true
    let msgChannel = null
    let readChannel = null
    let reactChannel = null

    async function fetchAndDecrypt() {
      try {
        const history = await getMessages(conversationId)
        if (!isMounted) return

        const decryptedHistory = await Promise.all(
          history.map((msg) => decryptChatMessage(sharedKey, msg))
        )
        if (!isMounted) return
        setMessages(decryptedHistory)
        setLoading(false)
        markedReadRef.current = new Set()
        setTimeout(scrollToBottom, 100)

        msgChannel = subscribeToMessages(conversationId, {
          onInsert: async (newMsg) => {
            const decrypted = await decryptChatMessage(sharedKey, newMsg)
            // Ne pas afficher les messages des utilisateurs bloqués
            if (blockedUserIds.has(newMsg.sender_id)) return
            
            setMessages((prev) => {
              if (prev.some((m) => m.id === decrypted.id)) return prev
              return [...prev, decrypted]
            })
            setTimeout(scrollToBottom, 100)

            if (newMsg.sender_id !== user.id) {
              markAsRead(conversationId).catch(console.error)
              const name = isGroup
                ? 'Groupe'
                : otherUser?.username
                  ? `@${otherUser.username}`
                  : 'Nouveau message'
              notifyNewMessage({
                title: name,
                body: 'Nouveau message chiffré',
                conversationId,
              })
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

        readChannel = subscribeToMessageReads(conversationId, (readRow) => {
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

        reactChannel = subscribeToReactions(conversationId, () => {
          if (isMounted) refreshMessages()
        })
      } catch (err) {
        if (isMounted) setError(err.message)
      }
    }

    fetchAndDecrypt()

    return () => {
      isMounted = false
      msgChannel?.unsubscribe?.()
      readChannel?.unsubscribe?.()
      reactChannel?.unsubscribe?.()
    }
  }, [sharedKey, conversationId, user, refreshMessages, isGroup, otherUser?.username, blockedUserIds])

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

  async function handleSendMessage(text, ephemeralMode = null, editTarget = null) {
    if (!sharedKey || !user) return

    // Vérifier si l'autre utilisateur est bloqué (conversation directe)
    if (!isGroup && otherUser?.id) {
      const blocked = await isUserBlocked(otherUser.id)
      if (blocked) {
        throw new Error(`Vous avez bloqué @${otherUser.username}. Débloquez cet utilisateur pour envoyer un message.`)
      }
    }

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

    const ciphertext = await encryptMessage(
      sharedKey,
      buildTextPayload(text, replyTo, ephemeralPayload, storyReplyMeta)
    )

    setReplyToMessage(null)
    setStoryReplyContext(null)

    const sent = await sendMessage(conversationId, user.id, ciphertext, {
      expiresAt: server.expiresAt,
      ephemeralKind: server.ephemeralKind,
    })
    const decrypted = await decryptChatMessage(sharedKey, sent)
    setMessages((prev) => [...prev, decrypted])
    setTimeout(scrollToBottom, 100)
  }

  async function handleSendFile(file, ephemeralMode = null) {
    if (!sharedKey || !user) return

    // Vérifier si l'autre utilisateur est bloqué (conversation directe)
    if (!isGroup && otherUser?.id) {
      const blocked = await isUserBlocked(otherUser.id)
      if (blocked) {
        throw new Error(`Vous avez bloqué @${otherUser.username}. Débloquez cet utilisateur pour envoyer un message.`)
      }
    }

    if (file.size > MAX_MEDIA_BYTES) {
      throw new Error('Fichier trop volumineux (maximum 50 Mo).')
    }

    const buffer = await file.arrayBuffer()
    const mime = file.type || 'application/octet-stream'
    const replyTo = getReplyToPayload()
    const { server, payload: ephemeralPayload } = buildEphemeralSendOptions(ephemeralMode)

    let payloadJson
    let mediaStoragePath = null

    if (file.size <= INLINE_MEDIA_MAX) {
      const encrypted = await prepareEncryptedMedia(sharedKey, buffer)
      payloadJson = buildMediaPayload({
        name: file.name,
        mime,
        size: file.size,
        inline: true,
        data: bufToBase64(encrypted),
        replyTo,
        ephemeral: ephemeralPayload,
      })
    } else {
      const encrypted = await prepareEncryptedMedia(sharedKey, buffer)
      mediaStoragePath = await uploadEncryptedMedia(conversationId, encrypted)
      payloadJson = buildMediaPayload({
        name: file.name,
        mime,
        size: file.size,
        path: mediaStoragePath,
        replyTo,
        ephemeral: ephemeralPayload,
      })
    }

    const ciphertext = await encryptMessage(sharedKey, payloadJson)
    setReplyToMessage(null)
    const sent = await sendMessage(conversationId, user.id, ciphertext, {
      expiresAt: server.expiresAt,
      ephemeralKind: server.ephemeralKind,
      mediaStoragePath,
    })
    const decrypted = await decryptChatMessage(sharedKey, sent)
    setMessages((prev) => [...prev, decrypted])
    setTimeout(scrollToBottom, 100)
  }

  async function handleReact(message, emoji) {
    const mine = message.message_reactions?.find((r) => r.user_id === user?.id)
    if (mine?.emoji === emoji) {
      await removeMessageReaction(message.id)
    } else {
      await setMessageReaction(message.id, emoji)
    }
    await refreshMessages()
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
    <div className="flex h-full flex-1 flex-col">
      <header className="relative z-20 flex items-center justify-between border-b border-violet-500/10 bg-[#2a2838]/80 px-4 py-3 md:px-6 md:py-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/chat"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800/50 hover:text-zinc-200 md:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            {isGroup ? (
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                    <GroupIcon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{conversation?.name?.trim() || 'Groupe sans nom'}</span>
                  {isMuted && <span className="text-zinc-500 text-sm">🔕</span>}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">{memberCount} membres</p>
              </div>
            ) : otherUser ? (
              <div>
                <h2 className="truncate text-lg font-semibold text-zinc-100 flex items-center gap-2">
                  @{otherUser.username}
                  {isMuted && <span className="text-zinc-500 text-sm">🔕</span>}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {typingLabel || presenceLabel || 'messagerie chiffrée'}
                </p>
              </div>
            ) : (
              <div className="h-6 w-32 animate-pulse rounded bg-zinc-800" />
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className="rounded-full px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Rechercher
          </button>
          {isGroup && (
            <button
              type="button"
              className="rounded-full px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              onClick={() => setShowMembersModal(true)}
            >
              Membres
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
          isIncoming={!!incomingCall}
          callType={activeCall?.call_type || incomingCall?.call_type || 'audio'}
        />
      )}

      <WellbeingBar />

      <div className="relative flex-1 overflow-y-auto scroll-smooth p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-zinc-500">
              {isGroup
                ? 'Aucun message dans ce groupe. Soyez le premier !'
                : 'Aucun message. Envoyez le premier !'}
            </p>
            <p className="text-xs text-zinc-600">Vos échanges restent chiffrés de bout en bout</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg) => {
              const sender = participants.find((p) => p.profiles.id === msg.sender_id)?.profiles
              return (
                <MessageBubble
                  key={msg.id}
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
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {typingLabel && (
        <p className="border-t border-violet-500/5 px-4 py-1 text-xs italic text-violet-300/80">
          {typingLabel}
        </p>
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
      />
    </div>
  )
}
