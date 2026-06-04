'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useTypingIndicator(conversationId, currentUserId, currentUsername) {
  const [typingUsers, setTypingUsers] = useState([])
  const channelRef = useRef(null)
  const timeoutRef = useRef({})

  useEffect(() => {
    if (!conversationId || !currentUserId) return

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload?.userId || payload.userId === currentUserId) return

        setTypingUsers((prev) => {
          const others = prev.filter((u) => u.userId !== payload.userId)
          return [...others, { userId: payload.userId, username: payload.username }]
        })

        clearTimeout(timeoutRef.current[payload.userId])
        timeoutRef.current[payload.userId] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
        }, 3000)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      Object.values(timeoutRef.current).forEach(clearTimeout)
      channel.unsubscribe()
    }
  }, [conversationId, currentUserId])

  const broadcastTyping = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, username: currentUsername },
    })
  }, [currentUserId, currentUsername])

  const label =
    typingUsers.length === 0
      ? null
      : typingUsers.length === 1
        ? `@${typingUsers[0].username} écrit…`
        : `${typingUsers.length} personnes écrivent…`

  return { typingLabel: label, broadcastTyping }
}
