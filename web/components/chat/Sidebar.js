'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { getConversations, getOrCreateDirectConversation, getConversationById } from '@/lib/api/conversations'
import { getProfileByUsername, searchProfiles } from '@/lib/api/profiles'
import { isUserBlocked } from '@/lib/api/conversationSettings'
import { getFolders, deleteFolder } from '@/lib/api/folders'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CreateGroupModal } from './CreateGroupModal'
import { KeySettingsModal } from '@/components/auth/KeySettingsModal'
import { AppSettingsModal } from '@/components/settings/AppSettingsModal'
import { StoriesBar } from '@/components/stories/StoriesBar'
import { GroupIcon } from '@/components/ui/GroupIcon'

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
  const [showSettings, setShowSettings] = useState(false)
  const [showFolderManager, setShowFolderManager] = useState(false)

  const [searchResults, setSearchResults] = useState([])
  const [folders, setFolders] = useState([])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length >= 2) {
        try {
          const results = await searchProfiles(search)
          setSearchResults(results.filter(r => r.id !== user?.id))
        } catch (err) {
          console.error('Search error', err)
        }
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, user])

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

    // Charger les dossiers
    async function loadFolders() {
      if (!user) return
      try {
        const data = await getFolders()
        setFolders(data)
      } catch (err) {
        console.error('Failed to load folders', err)
      }
    }
    loadFolders()
  }, [user])

  const activeId = params?.id

  // Helper to check unread
  function isConvUnread(conv) {
    if (activeId === conv.id) return false
    const myParticipant = conv.conversation_participants?.find(p => p.profiles?.id === user?.id)
    if (!myParticipant) return false
    
    if (!conv.last_message_at) return false
    if (!myParticipant.last_read_at) return true
    
    return new Date(conv.last_message_at).getTime() > new Date(myParticipant.last_read_at).getTime()
  }

  // Effect for global notifications
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('global-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new
          let isUnknown = false
          const updatedConvDate = newMsg.created_at || new Date().toISOString()
          
          setConversations((prev) => {
            const exists = prev.find(c => c.id === newMsg.conversation_id)
            if (!exists) {
               isUnknown = true
               return prev
            }
            
            const updated = prev.map((c) => {
              if (c.id === newMsg.conversation_id) {
                const newC = { ...c, last_message_at: updatedConvDate }
                if (activeId === c.id) {
                   const myParticipantIdx = newC.conversation_participants?.findIndex(p => p.profiles?.id === user?.id)
                   if (myParticipantIdx > -1) {
                     newC.conversation_participants[myParticipantIdx].last_read_at = new Date().toISOString()
                   }
                }
                return newC
              }
              return c
            })

            updated.sort((a, b) => {
               const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : new Date(a.created_at).getTime()
               const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : new Date(b.created_at).getTime()
               return bTime - aTime
            })
            return updated
          })
          
          if (isUnknown) {
            try {
              const fetched = await getConversationById(newMsg.conversation_id)
              if (fetched) {
                 fetched.last_message_at = updatedConvDate
                 setConversations(prev => {
                   const updated = [fetched, ...prev]
                   return updated
                 })
              }
            } catch (err) {
              console.error('Failed to fetch new conversation', err)
            }
          }
        }
      )
      .subscribe()
    
    // Subscribe to participant property updates (Mute, Archive)
    const partChannel = supabase.channel('participants-notifications')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setConversations(prev => prev.map(c => {
            if (c.id === payload.new.conversation_id) {
              const myIdx = c.conversation_participants?.findIndex(p => p.profiles?.id === user.id)
              if (myIdx > -1) {
                const newC = { ...c }
                newC.conversation_participants = [...newC.conversation_participants]
                newC.conversation_participants[myIdx] = {
                  ...newC.conversation_participants[myIdx],
                  muted_until: payload.new.muted_until,
                  archived_at: payload.new.archived_at,
                  last_read_at: payload.new.last_read_at,
                }
                return newC
              }
            }
            return c
          }))
        }
      )
      .subscribe()
      
    // Subscribe to conversation updates (e.g. pinned_message nullified during clear history)
    const convChannel = supabase.channel('conversations-notifications')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        async (payload) => {
          try {
            const fetched = await getConversationById(payload.new.id)
            setConversations(prev => prev.map(c => c.id === fetched.id ? fetched : c))
          } catch (err) {
            console.error('Failed to reload conversation for sidebar', err)
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      partChannel.unsubscribe()
      convChannel.unsubscribe()
    }
  }, [user, activeId])

  // Clear local unread status actively when navigating to a conversation
  useEffect(() => {
    if (!activeId || !user) return
    setConversations(prev => prev.map(c => {
      if (c.id === activeId) {
        const myIdx = c.conversation_participants?.findIndex(p => p.profiles?.id === user?.id)
        if (myIdx > -1) {
          const newC = { ...c }
          newC.conversation_participants = [...newC.conversation_participants]
          newC.conversation_participants[myIdx] = {
            ...newC.conversation_participants[myIdx],
            last_read_at: new Date().toISOString()
          }
          return newC
        }
      }
      return c
    }))
  }, [activeId, user])

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

      // Vérifier si l'utilisateur est bloqué
      const blocked = await isUserBlocked(profile.id)
      if (blocked) {
        setSearchError(`Vous avez bloqué @${profile.username}. Débloquez cet utilisateur pour discuter.`)
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

  async function handleDeleteFolder(folderId) {
    if (!confirm('Supprimer ce dossier ?')) return
    try {
      await deleteFolder(folderId)
      setFolders((prev) => prev.filter((f) => f.id !== folderId))
    } catch (err) {
      console.error(err)
      alert('Erreur lors de la suppression du dossier')
    }
  }

  function handleFolderCreated() {
    getFolders().then(setFolders).catch(console.error)
  }


  function myParticipant(conv) {
    return conv.conversation_participants?.find((p) => p.profiles?.id === user?.id)
  }

  function isArchived(conv) {
    return !!myParticipant(conv)?.archived_at
  }

  function isMuted(conv) {
    const p = myParticipant(conv)
    if (!p?.muted_until) return false
    return new Date(p.muted_until).getTime() > Date.now()
  }

  const activeConversations = conversations.filter((c) => !isArchived(c))
  const archivedConversations = conversations.filter((c) => isArchived(c))
  const directConversations = activeConversations.filter((c) => c.type === 'direct')
  const groupConversations = activeConversations.filter((c) => c.type === 'group')

  const sidebarClasses = activeId 
    ? 'hidden md:flex md:w-80' 
    : 'flex w-full md:w-80'

  return (
    <aside className={`relative z-10 h-full shrink-0 flex-col border-r border-border bg-surface/90 backdrop-blur-xl ${sidebarClasses}`}>
      <div className="p-4">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Rechercher
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2 relative">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">@</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="pseudo"
              className="pl-7 w-full"
              autoComplete="off"
              spellCheck={false}
            />

            {searchResults.length > 0 && search.trim().length >= 2 && (
              <div className="absolute top-full mt-1 left-0 w-[150%] max-w-sm bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50">
                {searchResults.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition flex items-center gap-2"
                    onClick={async () => {
                      setSearch('')
                      setSearchResults([])
                      setSearchLoading(true)
                      try {
                        // Vérifier si l'utilisateur est bloqué
                        const blocked = await isUserBlocked(res.id)
                        if (blocked) {
                          setSearchError(`Vous avez bloqué @${res.username}. Débloquez cet utilisateur pour discuter.`)
                          return
                        }
                        
                        const convId = await getOrCreateDirectConversation(res.id)
                        router.push(`/chat/${convId}`)
                      } catch (err) {
                        console.error(err)
                        setSearchError('Impossible d\'ouvrir la discussion.')
                      } finally {
                        setSearchLoading(false)
                      }
                    }}
                  >
                    <div className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {res.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{res.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" disabled={searchLoading || !search.trim()}>
            {searchLoading ? <Spinner className="h-4 w-4" /> : 'Aller'}
          </Button>
        </form>
        {searchError && <p className="mt-2 text-xs text-red-500">{searchError}</p>}
      </div>

      <StoriesBar />

      <div className="flex-1 overflow-y-auto p-2">
        {folders.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between px-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Dossiers
              </h2>
              <button
                onClick={() => setShowFolderManager(true)}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                + Nouveau
              </button>
            </div>
            <div className="space-y-1">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
                >
                  <span className="text-lg">{folder.icon}</span>
                  <span className="flex-1 truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
                      className={`block relative rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-surface-highlight text-text'
                          : isConvUnread(conv) ? 'text-text bg-primary/10 border border-primary/30' : 'text-text-muted hover:bg-surface-highlight hover:text-text'
                      }`}
                    >
                      {isConvUnread(conv) && !isActive && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                           <span className="flex h-3 w-3">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
                           </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pl-2 pr-6">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 text-violet-400/90">
                          <GroupIcon className="h-4 w-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`truncate flex items-center gap-1 ${isConvUnread(conv) ? 'font-bold text-violet-200' : 'font-medium'}`}>
                            {conv.name?.trim() || 'Groupe sans nom'}
                            {isMuted(conv) && <span className="text-zinc-500 text-xs">🔕</span>}
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
                      className={`block relative rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-surface-highlight text-text'
                          : isConvUnread(conv) ? 'text-text bg-primary/10 border border-primary/30' : 'text-text-muted hover:bg-surface-highlight hover:text-text'
                      }`}
                    >
                      {isConvUnread(conv) && !isActive && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                           <span className="flex h-3 w-3">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500"></span>
                           </span>
                        </div>
                      )}
                      <div className={`pl-2 pr-6 truncate flex items-center gap-1 ${isConvUnread(conv) ? 'font-bold text-primary' : 'font-medium'}`}>
                        @{other.username}
                        {isMuted(conv) && <span className="text-text-muted text-xs">🔕</span>}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {archivedConversations.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Archivées
            </h2>
            <ul className="space-y-1">
              {archivedConversations.map((conv) => {
                const other =
                  conv.type === 'direct'
                    ? conv.conversation_participants.find((cp) => cp.profiles?.id !== user?.id)
                        ?.profiles
                    : null
                const label =
                  conv.type === 'group'
                    ? conv.name || 'Groupe'
                    : other
                      ? `@${other.username}`
                      : 'Discussion'
                return (
                  <li key={conv.id}>
                    <Link
                      href={`/chat/${conv.id}`}
                      className={`block rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-900 ${
                        activeId === conv.id ? 'bg-zinc-800 text-zinc-300' : ''
                      }`}
                    >
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
      <div className="border-t border-border p-4">
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="mb-3 flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-sm text-text-muted transition hover:bg-surface-highlight hover:text-text"
        >
          <span aria-hidden>⚙️</span>
          Paramètres
        </button>
        {profile ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-highlight font-bold text-primary">
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col truncate">
              <span className="truncate text-sm font-semibold text-text">
                @{profile.username}
              </span>
              <span className="truncate text-xs text-text-muted">
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
      {showSettings && (
        <AppSettingsModal
          onClose={() => setShowSettings(false)}
          onOpenKeys={() => setShowKeySettings(true)}
        />
      )}
      {showKeySettings && <KeySettingsModal onClose={() => setShowKeySettings(false)} />}
      {showFolderManager && (
        <FolderManager
          onClose={() => setShowFolderManager(false)}
          onFolderCreated={handleFolderCreated}
        />
      )}
    </aside>
  )
}
