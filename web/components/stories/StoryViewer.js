'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markStoryViewed } from '@/lib/api/stories'
import { getOrCreateDirectConversation } from '@/lib/api/conversations'
import { decryptStoryItem } from '@/lib/messages/decryptStory'
import { StoryContent } from './StoryContent'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase/client'

const AUTO_ADVANCE_MS = 6000

const STORY_REPLY_KEY = 'ghosttalk_pending_story_reply'

export function setPendingStoryReply(data) {
  sessionStorage.setItem(STORY_REPLY_KEY, JSON.stringify(data))
}

export function consumePendingStoryReply() {
  const raw = sessionStorage.getItem(STORY_REPLY_KEY)
  if (!raw) return null
  sessionStorage.removeItem(STORY_REPLY_KEY)
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function StoryViewer({ storyGroup, viewerId, onClose, onViewed }) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [decrypted, setDecrypted] = useState(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const stories = storyGroup?.stories ?? []
  const author = storyGroup?.author
  const current = stories[index]
  const isOwn = author?.id === viewerId

  const timerRef = useRef(null)

  function goNext() {
    if (index < stories.length - 1) setIndex((i) => i + 1)
    else onClose()
  }

  useEffect(() => {
    if (!current || !viewerId) return

    let cancelled = false
    setLoading(true)

    decryptStoryItem(current, viewerId).then((d) => {
      if (!cancelled) {
        setDecrypted(d)
        setLoading(false)
      }
    })

    if (!isOwn) {
      markStoryViewed(current.id).then(() => onViewed?.())
    }

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!cancelled) goNext()
    }, AUTO_ADVANCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
    }
  }, [current?.id, viewerId, isOwn, onViewed, index, stories.length])

  async function handleReply(e) {
    e.preventDefault()
    if (!replyText.trim() || isOwn || !author) return

    setReplying(true)
    try {
      const convId = await getOrCreateDirectConversation(author.id)
      setPendingStoryReply({
        storyId: current.id,
        authorUsername: author.username,
        authorId: author.id,
        text: replyText.trim(),
      })
      onClose()
      router.push(`/chat/${convId}`)
    } catch (err) {
      console.error(err)
    } finally {
      setReplying(false)
    }
  }

  async function handleDeleteStory() {
    if (!current || !isOwn) return
    setLoading(true)
    try {
      await supabase.from('stories').delete().eq('id', current.id)
      onViewed?.()
      onClose()
    } catch (err) {
      console.error('Delete story error', err)
      setLoading(false)
    } finally {
      setConfirmDelete(false)
    }
  }

  if (!current || !author) return null

  const viewCount = current.story_views?.length ?? 0
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95">
      <div className="flex gap-1 px-2 pt-3">
        {stories.map((s, i) => (
          <div
            key={s.id}
            className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20"
          >
            <div
              className="h-full bg-white"
              style={
                i < index
                  ? { width: '100%' }
                  : i === index
                    ? {
                        transformOrigin: 'left',
                        animationName: 'story-progress',
                        animationDuration: `${AUTO_ADVANCE_MS}ms`,
                        animationTimingFunction: 'linear',
                        animationFillMode: 'forwards',
                      }
                    : { width: '0%' }
              }
            />
          </div>
        ))}
      </div>

      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 overflow-hidden rounded-full bg-primary/30">
            {author.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.avatar_url} alt={author.username ?? ''} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                {author.username?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">@{author.username}</p>
            <p className="text-[10px] text-white/50">
              {new Date(current.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isOwn && (
            <div className="flex items-center gap-3 rounded-full bg-black/40 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
              <span className="flex items-center gap-1 font-medium" title={`${viewCount} vue(s)`}>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {viewCount}
              </span>
              <div className="h-3 w-[1px] bg-white/20" />
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-white/60 transition hover:text-white"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="font-semibold text-red-400 transition hover:text-red-300"
                    onClick={handleDeleteStory}
                  >
                    Supprimer
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-white/60 transition hover:text-red-400"
                  onClick={() => setConfirmDelete(true)}
                  title="Supprimer ce statut"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      </header>

      <button
        type="button"
        className="absolute left-0 top-16 z-10 h-[calc(100%-8rem)] w-1/3"
        onClick={() => index > 0 && setIndex((i) => i - 1)}
        aria-label="Précédent"
      />
      <button
        type="button"
        className="absolute right-0 top-16 z-10 h-[calc(100%-8rem)] w-1/3"
        onClick={goNext}
        aria-label="Suivant"
      />

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-4">
        {loading ? (
          <Spinner className="h-8 w-8 text-primary" />
        ) : (
          <StoryContent
            payload={decrypted?.payload}
            authorPublicKey={author.public_key}
          />
        )}
      </div>

      {!isOwn && (
        <form
          onSubmit={handleReply}
          className="border-t border-white/10 bg-black/50 p-4 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-lg gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Répondre en message privé…"
              className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 backdrop-blur-sm focus:border-white/40 focus:outline-none"
              disabled={replying}
            />
            <Button type="submit" disabled={replying || !replyText.trim()} className="rounded-full px-5">
              {replying ? <Spinner className="h-4 w-4" /> : 'Envoyer'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
