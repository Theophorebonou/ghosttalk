'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getActiveStories, subscribeToStories } from '@/lib/api/stories'
import { useAuth } from '@/hooks/useAuth'
import dynamic from 'next/dynamic'
import { StoryAvatar } from './StoryAvatar'
import { StoryViewer } from './StoryViewer'

// Chargée à la demande : hors du bundle initial
const CreateStoryModal = dynamic(
  () => import('./CreateStoryModal').then((m) => m.CreateStoryModal),
  { ssr: false }
)

function groupStoriesByAuthor(stories, currentUserId) {
  const groups = new Map()

  for (const story of stories) {
    const author = story.profiles
    if (!author?.id) continue

    if (!groups.has(author.id)) {
      groups.set(author.id, {
        author,
        stories: [],
        hasUnviewed: false,
      })
    }

    const g = groups.get(author.id)
    g.stories.push(story)

    if (author.id !== currentUserId) {
      const viewed = story.story_views?.some((v) => v.viewer_id === currentUserId)
      if (!viewed) g.hasUnviewed = true
    }
  }

  for (const g of groups.values()) {
    g.stories.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }

  return Array.from(groups.values())
}

export function StoriesBar() {
  const { user, profile } = useAuth()
  const [rawStories, setRawStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [viewingGroup, setViewingGroup] = useState(null)

  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setLoadError(null)
      const data = await getActiveStories()
      setRawStories(data)
    } catch (err) {
      console.error('Stories load failed', err)
      setLoadError(err.message ?? 'Impossible de charger les statuts')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
    if (!user) return
    const channel = subscribeToStories(() => load())
    return () => channel.unsubscribe()
  }, [user, load])

  const groups = useMemo(
    () => groupStoriesByAuthor(rawStories, user?.id),
    [rawStories, user?.id]
  )

  const myGroup = groups.find((g) => g.author.id === user?.id)
  const contactGroups = groups.filter((g) => g.author.id !== user?.id)

  function openGroup(group) {
    setViewingGroup(group)
  }

  if (!user) return null

  return (
    <>
      <div className="border-b border-border px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Statuts
          </h2>
          <span className="text-[10px] text-text-muted">24 h · contacts</span>
        </div>

        {loading ? (
          <div className="h-16 animate-pulse rounded-lg bg-surface-highlight/50" />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
            <StoryAvatar
              username={profile?.username ?? 'vous'}
              avatarUrl={profile?.avatar_url}
              isOwn
              hasUnviewed={!!myGroup?.stories?.length}
              onClick={() => {
                if (myGroup?.stories?.length) openGroup(myGroup)
                else setShowCreate(true)
              }}
            />

            {contactGroups.map((group) => (
              <StoryAvatar
                key={group.author.id}
                username={group.author.username}
                avatarUrl={group.author.avatar_url}
                hasUnviewed={group.hasUnviewed}
                onClick={() => openGroup(group)}
              />
            ))}

            {contactGroups.length === 0 && !myGroup && (
              <p className="self-center text-xs text-text-muted">
                Aucun statut — ajoutez des contacts en discutant
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="mt-2 w-full rounded-lg border border-dashed border-primary/25 py-1.5 text-[11px] text-primary/70 transition hover:border-primary/50 hover:bg-primary/5"
        >
          + Publier un statut
        </button>
      </div>

      {showCreate && createPortal(
        <CreateStoryModal
          onClose={() => setShowCreate(false)}
          onPublished={async () => {
            setLoading(true)
            await load()
          }}
        />,
        document.body
      )}

      {viewingGroup && createPortal(
        <StoryViewer
          storyGroup={viewingGroup}
          viewerId={user.id}
          onClose={() => setViewingGroup(null)}
          onViewed={load}
        />,
        document.body
      )}
    </>
  )
}
