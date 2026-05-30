'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getConversations, getOrCreateDirectConversation } from '@/lib/api/conversations'
import { getProfileByUsername } from '@/lib/api/profiles'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CreateGroupModal } from './CreateGroupModal'
import { KeySettingsModal } from '@/components/auth/KeySettingsModal'

export function Sidebar() {
  const params = useParams()
  const router = useRouter()
  const { user, profile } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)

  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showKeySettings, setShowKeySettings] = useState(false)

  useEffect(() => {
    async function loadConversations() {
      if (!user) return
      try {
        const data = await getConversations()
        setConversations(data)
      } catch (err) {
        console.error('Failed to load conversations', err)
      } finally {
        setLoading(false)
      }
    }
    loadConversations()
  }, [user])

  async function handleSearch(e) {
    e.preventDefault()
    if (!search.trim()) return

    setSearchError(null)
    setSearchLoading(true)

    try {
      const profile = await getProfileByUsername(search.trim())
      if (!profile) {
        setSearchError('Utilisateur introuvable.')
        setSearchLoading(false)
        return
      }

      if (profile.id === user.id) {
        setSearchError('Vous ne pouvez pas discuter avec vous-même.')
        setSearchLoading(false)
        return
      }

      // Initiate or fetch conversation
      const convId = await getOrCreateDirectConversation(profile.id)
      setSearch('')
      
      // Navigate to chat
      router.push(`/chat/${convId}`)
    } catch (err) {
      console.error(err)
      setSearchError('Une erreur est survenue.')
    } finally {
      setSearchLoading(false)
    }
  }

  const activeId = params?.id

  // Separate direct and group conversations
  const directConversations = conversations.filter(c => c.type === 'direct')
  const groupConversations = conversations.filter(c => c.type === 'group')

  return (
    <aside className="relative z-10 flex h-full w-80 flex-col border-r border-violet-500/10 bg-[#2a2838]/85 backdrop-blur-xl">
      <div className="p-4">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Rechercher
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="pseudo"
              className="pl-7"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" disabled={searchLoading || !search.trim()}>
            {searchLoading ? <Spinner className="h-4 w-4" /> : 'Aller'}
          </Button>
        </form>
        {searchError && <p className="mt-2 text-xs text-red-500">{searchError}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Groupes
            </h2>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="text-xs text-violet-400 hover:text-violet-300"
            >
              + Créer
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center p-4">
              <Spinner className="h-5 w-5" />
            </div>
          ) : groupConversations.length === 0 ? (
            <p className="px-2 text-sm text-zinc-500">Aucun groupe.</p>
          ) : (
            <ul className="space-y-1">
              {groupConversations.map((conv) => {
                const isActive = activeId === conv.id
                const participantCount = conv.conversation_participants.length

                return (
                  <li key={conv.id}>
                    <Link
                      href={`/chat/${conv.id}`}
                      className={`block rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👥</span>
                        <div className="flex-1">
                          <div className="truncate font-medium">
                            {conv.name?.trim() || 'Groupe sans nom'}
                          </div>
                          <div className="text-xs text-zinc-500">{participantCount} membres</div>
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Discussions directes
          </h2>
          {loading ? (
            <div className="flex justify-center p-4">
              <Spinner className="h-5 w-5" />
            </div>
          ) : directConversations.length === 0 ? (
            <p className="px-2 text-sm text-zinc-500">Aucune discussion.</p>
          ) : (
            <ul className="space-y-1">
              {directConversations.map((conv) => {
                // Find the other participant
                const other = conv.conversation_participants.find(
                  (cp) => cp.profiles.id !== user?.id
                )?.profiles

                if (!other) return null

                const isActive = activeId === conv.id

                return (
                  <li key={conv.id}>
                    <Link
                      href={`/chat/${conv.id}`}
                      className={`block rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                    >
                      <div className="font-medium">@{other.username}</div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-zinc-900 p-4">
        <button
          type="button"
          onClick={() => setShowKeySettings(true)}
          className="mb-3 w-full rounded-lg px-2 py-2 text-left text-xs text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-300"
        >
          Sauvegarder mes clés
        </button>
        {profile ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-bold text-violet-400">
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col truncate">
              <span className="truncate text-sm font-semibold text-zinc-100">
                @{profile.username}
              </span>
              <span className="truncate text-xs text-zinc-500">
                {user?.is_anonymous ? 'Mode Fantôme' : 'Compte connecté'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-800" />
            <div className="flex flex-col gap-1">
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-800" />
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-800" />
            </div>
          </div>
        )}
      </div>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
      {showKeySettings && <KeySettingsModal onClose={() => setShowKeySettings(false)} />}
    </aside>
  )
}
