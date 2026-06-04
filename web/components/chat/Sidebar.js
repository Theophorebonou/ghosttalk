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
    <aside className={`relative z-10 h-full shrink-0 flex-col border-r border-border bg-surface ${sidebarClasses}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-highlight px-4 py-3">
        <h1 className="text-lg font-semibold text-text">GhostTalk</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text"
            title="Nouveau groupe"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text"
            title="Parametres"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2">
        <form onSubmit={handleSearch} className="relative">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher ou demarrer une discussion"
              className="w-full rounded-lg bg-surface-highlight pl-10 pr-4 py-2 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {searchResults.length > 0 && search.trim().length >= 2 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-surface border border-border rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in">
              {searchResults.map((res) => (
                <button
                  key={res.id}
                  type="button"
                  className="w-full text-left px-4 py-3 text-sm text-text hover:bg-surface-highlight transition flex items-center gap-3"
                  onClick={async () => {
                    setSearch('')
                    setSearchResults([])
                    setSearchLoading(true)
                    try {
                      const blocked = await isUserBlocked(res.id)
                      if (blocked) {
                        setSearchError(`Vous avez bloque @${res.username}. Debloquez cet utilisateur pour discuter.`)
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold">
                    {res.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate font-medium">{res.username}</span>
                </button>
              ))}
            </div>
          )}
        </form>
        {searchError && <p className="mt-2 px-2 text-xs text-error">{searchError}</p>}
      </div>

      <StoriesBar />

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        ) : (
          <>
            {/* All conversations combined and sorted by last message */}
            {activeConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-highlight">
                  <svg className="h-8 w-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm text-text-muted">Aucune conversation</p>
                <p className="mt-1 text-xs text-text-muted">Recherchez un utilisateur pour commencer</p>
              </div>
            ) : (
              <ul>
                {activeConversations.map((conv) => {
                  const isGroup = conv.type === 'group'
                  const other = !isGroup
                    ? conv.conversation_participants.find((cp) => cp.profiles?.id !== user?.id)?.profiles
                    : null
                  const isActive = activeId === conv.id
                  const unread = isConvUnread(conv)
                  const muted = isMuted(conv)
                  const participantCount = conv.conversation_participants?.length || 0

                  const displayName = isGroup
                    ? conv.name?.trim() || 'Groupe'
                    : other?.username || 'Utilisateur'

                  const lastMessageTime = conv.last_message_at
                    ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''

                  return (
                    <li key={conv.id}>
                      <Link
                        href={`/chat/${conv.id}`}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          isActive
                            ? 'bg-surface-highlight'
                            : 'hover:bg-surface-highlight/50'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                          isGroup ? 'bg-primary/20' : 'bg-surface-highlight'
                        }`}>
                          {isGroup ? (
                            <GroupIcon className="h-6 w-6 text-primary" />
                          ) : (
                            <span className="text-lg font-semibold text-text">
                              {displayName.charAt(0).toUpperCase()}
                            </span>
                          )}
                          {unread && !isActive && (
                            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-primary animate-pulse-dot" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate ${unread ? 'font-semibold text-text' : 'font-medium text-text'}`}>
                              {isGroup ? displayName : `@${displayName}`}
                            </span>
                            <span className={`text-xs shrink-0 ${unread ? 'text-primary font-medium' : 'text-text-muted'}`}>
                              {lastMessageTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {muted && (
                              <svg className="h-4 w-4 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                              </svg>
                            )}
                            <span className={`truncate text-sm ${unread ? 'text-text' : 'text-text-muted'}`}>
                              {isGroup ? `${participantCount} membres` : 'Message chiffre'}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Archived */}
            {archivedConversations.length > 0 && (
              <div className="border-t border-border">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-muted hover:bg-surface-highlight/50 transition"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span>Archives ({archivedConversations.length})</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Profile footer */}
      <div className="border-t border-border bg-surface-highlight px-4 py-3">
        {profile ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white">
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col truncate">
              <span className="truncate text-sm font-semibold text-text">
                @{profile.username}
              </span>
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <span className="h-2 w-2 rounded-full bg-primary" />
                En ligne
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-surface" />
            <div className="flex flex-col gap-1">
              <div className="h-4 w-20 animate-pulse rounded bg-surface" />
              <div className="h-3 w-16 animate-pulse rounded bg-surface" />
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
