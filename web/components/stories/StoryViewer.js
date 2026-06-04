'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markStoryViewed } from '@/lib/api/stories'
import { getOrCreateDirectConversation } from '@/lib/api/conversations'
import { decryptStoryItem } from '@/lib/messages/decryptStory'
import { StoryContent } from './StoryContent'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase/client'

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

  const stories = storyGroup?.stories ?? []
  const author = storyGroup?.author
  const current = stories[index]
  const isOwn = author?.id === viewerId

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

    return () => {
      cancelled = true
    }
  }, [current?.id, viewerId, isOwn, onViewed])

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
    const ok = window.confirm('Supprimer ce statut ?')
    if (!ok) return

    setLoading(true)
    try {
      await supabase.from('stories').delete().eq('id', current.id)
      onViewed?.()
      onClose()
    } catch (err) {
      console.error('Delete story error', err)
      setLoading(false)
    }
  }

  function goNext() {
    if (index < stories.length - 1) setIndex((i) => i + 1)
    else onClose()
  }

  if (!current || !author) return null

  const progress = ((index + 1) / stories.length) * 100
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
              className="h-full bg-white transition-all duration-300"
              style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600/30 text-sm font-bold text-violet-200">
            {author.username?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">@{author.username}</p>
            <p className="text-[10px] text-zinc-500">
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
                <span className="text-[14px]">👁</span> {viewCount}
              </span>
              <div className="h-3 w-[1px] bg-white/20" />
              <button
                type="button"
                className="text-red-400 hover:text-red-300 transition-colors"
                onClick={handleDeleteStory}
                title="Supprimer la story"
              >
                🗑️
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
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
          <Spinner className="h-8 w-8 text-violet-400" />
        ) : (
          <StoryContent
            payload={decrypted?.payload}
            authorPublicKey={author.public_key}
            viewerId={viewerId}
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
              className="flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
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
