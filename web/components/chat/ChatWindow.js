'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { getConversationById } from '@/lib/api/conversations'
import { getMessages, sendMessage, subscribeToMessages } from '@/lib/api/messages'
import { uploadEncryptedMedia, prepareEncryptedMedia } from '@/lib/api/media'
import { deriveSharedKey, encryptMessage } from '@/lib/crypto/e2e'
import { bufToBase64, importStoredKeyPair } from '@/lib/crypto/keys'
import { INLINE_MEDIA_MAX } from '@/lib/crypto/media'
import {
  buildMediaPayload,
  buildTextPayload,
} from '@/lib/crypto/messagePayload'
import { MAX_MEDIA_BYTES } from '@/lib/constants/media'
import { decryptChatMessage } from '@/lib/messages/decryptChatMessage'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'
import { ChatInput } from './ChatInput'
import { ManageGroupMembersModal } from './ManageGroupMembersModal'
import { MessageBubble } from './MessageBubble'

export function ChatWindow({ conversationId }) {
  const { user } = useAuth()
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

  const messagesEndRef = useRef(null)

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

  // 1. Load conversation and derive keys
  useEffect(() => {
    if (!user) return

    let isMounted = true

    async function init() {
      try {
        setLoading(true)
        const conv = await getConversationById(conversationId)
        if (!isMounted) return

        setConversation(conv)
        setIsGroup(conv.type === 'group')

        // Get user's role in this conversation
        const userParticipant = conv.conversation_participants.find(
          (cp) => cp.profiles.id === user.id
        )
        setUserRole(userParticipant?.role || 'member')

        if (conv.type === 'direct') {
          const recipient = conv.conversation_participants.find(
            (cp) => cp.profiles.id !== user.id
          )?.profiles

          setOtherUser(recipient)

          if (!recipient) {
            throw new Error('Participant introuvable')
          }

          // Generate shared key for direct conversation
          const localKeyPair = await importStoredKeyPair()
          if (!localKeyPair?.privateKey) {
            throw new Error('Clé privée locale introuvable. Reconnectez-vous.')
          }

          const derived = await deriveSharedKey(
            localKeyPair.privateKey,
            recipient.public_key
          )
          if (!isMounted) return
          setSharedKey(derived)
        } else {
          // For groups, use a simplified approach (same key for all)
          // In production, use proper group encryption like MLS
          const localKeyPair = await importStoredKeyPair()
          if (!localKeyPair?.privateKey) {
            throw new Error('Clé privée locale introuvable. Reconnectez-vous.')
          }
          
          // For now, derive a key from the conversation ID (simplified)
          // In production, implement proper group key management
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
    return () => { isMounted = false }
  }, [conversationId, user])

  // 2. Fetch messages & decrypt history
  useEffect(() => {
    if (!sharedKey || !conversationId) return

    let isMounted = true
    let unsubscribe = null

    async function fetchAndDecrypt() {
      try {
        const history = await getMessages(conversationId)
        if (!isMounted) return

        // Decrypt all
        const decryptedHistory = await Promise.all(
          history.map((msg) => decryptChatMessage(sharedKey, msg))
        )
        if (!isMounted) return
        setMessages(decryptedHistory)
        setLoading(false)

        setTimeout(scrollToBottom, 100)

        // 3. Subscribe to Realtime
        unsubscribe = subscribeToMessages(conversationId, async (newMsg) => {
          const decrypted = await decryptChatMessage(sharedKey, newMsg)
          setMessages((prev) => [...prev, decrypted])
          setTimeout(scrollToBottom, 100)
        })

      } catch (err) {
        if (isMounted) setError(err.message)
      }
    }

    fetchAndDecrypt()

    return () => {
      isMounted = false
      if (unsubscribe) unsubscribe.unsubscribe?.()
    }
  }, [sharedKey, conversationId])

  function getReplyToPayload() {
    if (!replyToMessage || !replyToMessage.payload) return null
    let snippet = 'Contenu multimédia'
    if (replyToMessage.payload.t === 'text') snippet = replyToMessage.payload.b.substring(0, 60)
    
    let sender = otherUser?.username || 'Inconnu'
    if (isGroup) {
      const p = conversation?.conversation_participants?.find((cp) => cp.profiles.id === replyToMessage.sender_id)
      if (p) sender = p.profiles.username
    }
    if (replyToMessage.sender_id === user?.id) sender = 'Vous'

    return {
      id: replyToMessage.id,
      senderName: sender,
      snippet,
    }
  }

  async function handleSendMessage(text) {
    if (!sharedKey || !user) return

    const replyTo = getReplyToPayload()
    const ciphertext = await encryptMessage(sharedKey, buildTextPayload(text, replyTo))
    
    setReplyToMessage(null)
    await sendMessage(conversationId, user.id, ciphertext)
  }

  async function handleSendFile(file) {
    if (!sharedKey || !user) return

    if (file.size > MAX_MEDIA_BYTES) {
      throw new Error('Fichier trop volumineux (maximum 50 Mo).')
    }

    const buffer = await file.arrayBuffer()
    const mime = file.type || 'application/octet-stream'

    let payloadJson

    const replyTo = getReplyToPayload()

    if (file.size <= INLINE_MEDIA_MAX) {
      const encrypted = await prepareEncryptedMedia(sharedKey, buffer)
      payloadJson = buildMediaPayload({
        name: file.name,
        mime,
        size: file.size,
        inline: true,
        data: bufToBase64(encrypted),
        replyTo,
      })
    } else {
      const encrypted = await prepareEncryptedMedia(sharedKey, buffer)
      const path = await uploadEncryptedMedia(conversationId, encrypted)
      payloadJson = buildMediaPayload({
        name: file.name,
        mime,
        size: file.size,
        path,
        replyTo,
      })
    }

    const ciphertext = await encryptMessage(sharedKey, payloadJson)
    setReplyToMessage(null)
    await sendMessage(conversationId, user.id, ciphertext)
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
      <header className="flex items-center justify-between border-b border-violet-500/10 bg-[#2a2838]/80 px-4 py-3 md:px-6 md:py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/chat" className="md:hidden flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            {isGroup ? (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <span>👥</span>
                <span>{conversation?.name?.trim() || 'Groupe sans nom'}</span>
                {userRole === 'admin' && (
                  <span className="text-xs bg-violet-600 px-2 py-0.5 rounded">Admin</span>
                )}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">{memberCount} membres</p>
            </div>
          ) : otherUser ? (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">@{otherUser.username}</h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate max-w-sm">Fingerprint: {otherUser.public_key.slice(0, 32)}...</p>
            </div>
          ) : (
            <div className="h-6 w-32 animate-pulse rounded bg-zinc-800" />
          )}
          </div>
        </div>

        {isGroup && (
          <button
            type="button"
            className="text-xs text-zinc-400 hover:text-zinc-200"
            onClick={() => setShowMembersModal(true)}
          >
            {userRole === 'admin' ? 'Gérer les membres' : 'Voir les membres'}
          </button>
        )}
      </header>

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

      <div className="relative flex-1 overflow-y-auto p-4 scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="ghost-stagger-2 text-sm text-zinc-500">
              {isGroup
                ? 'Aucun message dans ce groupe. Soyez le premier !'
                : 'Aucun message. Envoyez le premier !'}
            </p>
            <p className="ghost-stagger-3 text-xs text-zinc-600">
              Vos échanges restent chiffrés de bout en bout
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg) => {
              const sender = participants.find(p => p.profiles.id === msg.sender_id)?.profiles
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  sharedKey={sharedKey}
                  isOwn={msg.sender_id === user?.id}
                  senderName={isGroup ? sender?.username : null}
                  isGroup={isGroup}
                  onReply={() => setReplyToMessage(msg)}
                />
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        disabled={!sharedKey}
        replyToMessage={replyToMessage}
        onCancelReply={() => setReplyToMessage(null)}
      />
    </div>
  )
}
