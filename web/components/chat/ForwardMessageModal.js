'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getConversations, getOrCreateDirectConversation } from '@/lib/api/conversations'
import { sendMessage } from '@/lib/api/messages'
import { deriveSharedKey, encryptMessage } from '@/lib/crypto/e2e'
import { buildForwardPayload } from '@/lib/crypto/messagePayload'
import { importStoredKeyPair } from '@/lib/crypto/keys'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

export function ForwardMessageModal({ message, onClose }) {
  const router = useRouter()
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getConversations()
      .then(setConversations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function forwardTo(conv) {
    if (!message?.payload || !user) return
    setSending(conv.id)
    setError(null)

    try {
      const other = conv.conversation_participants?.find(
        (cp) => cp.profiles?.id !== user.id
      )?.profiles

      let targetConvId = conv.id
      let sharedKey

      if (conv.type === 'direct' && other?.public_key) {
        const local = await importStoredKeyPair()
        sharedKey = await deriveSharedKey(local.privateKey, other.public_key)
      } else if (conv.type === 'group') {
        const encoder = new TextEncoder()
        const convKeyData = encoder.encode(conv.id + 'group-key')
        sharedKey = await crypto.subtle.importKey(
          'raw',
          await crypto.subtle.digest('SHA-256', convKeyData),
          'AES-GCM',
          true,
          ['encrypt', 'decrypt']
        )
      } else {
        throw new Error('Conversation invalide')
      }

      const forwardMeta = {
        from: message.senderName || 'Utilisateur',
        originalId: message.id,
      }

      const ciphertext = await encryptMessage(
        sharedKey,
        buildForwardPayload(message.payload, forwardMeta)
      )

      await sendMessage(targetConvId, user.id, ciphertext)
      onClose()
      router.push(`/chat/${targetConvId}`)
    } catch (err) {
      setError(err.message ?? 'Transfert impossible')
    } finally {
      setSending(null)
    }
  }

  function label(conv) {
    if (conv.type === 'group') return conv.name || 'Groupe'
    const other = conv.conversation_participants?.find((cp) => cp.profiles?.id !== user?.id)
    return other ? `@${other.profiles.username}` : 'Discussion'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-[#2a2838] shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-bold text-text">Transférer le message</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            ✕
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          )}
          {error && <p className="p-3 text-xs text-red-400">{error}</p>}
          {!loading &&
            conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                disabled={!!sending}
                onClick={() => forwardTo(conv)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-text hover:bg-surface-highlight"
              >
                <span>{label(conv)}</span>
                {sending === conv.id && <Spinner className="h-4 w-4" />}
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
