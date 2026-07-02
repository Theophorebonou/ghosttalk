'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addGroupMember,
  leaveGroup,
  removeGroupMember,
  updateGroupName,
} from '@/lib/api/conversations'
import { searchProfiles } from '@/lib/api/profiles'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'

export function ManageGroupMembersModal({
  conversationId,
  groupName,
  participants,
  currentUserId,
  isAdmin,
  onClose,
  onUpdated,
}) {
  const router = useRouter()
  const [name, setName] = useState(groupName ?? '')
  const [renaming, setRenaming] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState(null)

  const memberIds = new Set(
    participants.map((p) => p.profiles?.id ?? p.user_id).filter(Boolean)
  )

  async function handleSearch(value) {
    setSearch(value)
    setError(null)
    if (value.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await searchProfiles(value)
      setSearchResults(results.filter((u) => !memberIds.has(u.id)))
    } catch (err) {
      setError(err.message ?? 'Recherche impossible')
    } finally {
      setSearching(false)
    }
  }

  async function handleRename(e) {
    e.preventDefault()
    if (!name.trim()) return

    setRenaming(true)
    setError(null)
    try {
      await updateGroupName(conversationId, name.trim())
      await onUpdated()
    } catch (err) {
      setError(err.message ?? 'Impossible de renommer le groupe')
    } finally {
      setRenaming(false)
    }
  }

  async function handleAdd(userId) {
    setActionLoading(`add-${userId}`)
    setError(null)
    try {
      await addGroupMember(conversationId, userId)
      setSearch('')
      setSearchResults([])
      await onUpdated()
    } catch (err) {
      setError(err.message ?? "Impossible d'ajouter ce membre")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRemove(userId) {
    if (!confirm('Retirer ce membre du groupe ?')) return

    setActionLoading(`remove-${userId}`)
    setError(null)
    try {
      await removeGroupMember(conversationId, userId)
      await onUpdated()
    } catch (err) {
      setError(err.message ?? 'Impossible de retirer ce membre')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleLeave() {
    if (!confirm('Quitter ce groupe ?')) return

    setActionLoading('leave')
    setError(null)
    try {
      await leaveGroup(conversationId)
      onClose()
      router.push('/chat')
      router.refresh()
    } catch (err) {
      setError(err.message ?? 'Impossible de quitter le groupe')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-surface shadow-xl">
        <div className="border-b border-border p-6 pb-4">
          <h2 className="text-xl font-bold text-text">Membres du groupe</h2>
          <p className="mt-1 text-sm text-text-muted">
            {participants.length} membre{participants.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {isAdmin && (
            <form onSubmit={handleRename} className="mb-6 flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du groupe"
                maxLength={80}
                required
              />
              <Button type="submit" disabled={renaming || !name.trim()}>
                {renaming ? <Spinner className="h-4 w-4 border-2" /> : 'OK'}
              </Button>
            </form>
          )}

          <ul className="space-y-2">
            {participants.map((entry) => {
              const profile = entry.profiles
              const userId = profile?.id
              const isSelf = userId === currentUserId
              const loadingThis =
                actionLoading === `remove-${userId}` ||
                (isSelf && actionLoading === 'leave')

              return (
                <li
                  key={userId}
                  className="flex items-center justify-between rounded-xl bg-surface-highlight px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">
                      @{profile?.username}
                      {isSelf && (
                        <span className="ml-2 text-xs text-text-muted">(vous)</span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted">
                      {entry.role === 'admin' ? 'Administrateur' : 'Membre'}
                    </p>
                  </div>

                  {isAdmin && !isSelf && (
                    <button
                      type="button"
                      onClick={() => handleRemove(userId)}
                      disabled={!!actionLoading}
                      className="ml-3 shrink-0 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      {loadingThis ? <Spinner className="h-4 w-4 border-2" /> : 'Retirer'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>

          {isAdmin && (
            <div className="mt-6 border-t border-border pt-6">
              <label className="mb-2 block text-sm text-text-muted">
                Ajouter un membre
              </label>
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher par pseudo..."
                autoComplete="off"
              />
              {searching && (
                <div className="mt-2 flex justify-center">
                  <Spinner className="h-4 w-4 border-2" />
                </div>
              )}
              {searchResults.length > 0 && (
                <ul className="mt-2 overflow-hidden rounded-xl bg-surface-highlight">
                  {searchResults.map((user) => (
                    <li
                      key={user.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <span className="text-sm text-text">@{user.username}</span>
                      <button
                        type="button"
                        onClick={() => handleAdd(user.id)}
                        disabled={!!actionLoading}
                        className="text-xs font-semibold text-primary hover:text-primary-hover disabled:opacity-50"
                      >
                        {actionLoading === `add-${user.id}` ? (
                          <Spinner className="h-4 w-4 border-2" />
                        ) : (
                          'Ajouter'
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-6">
          <Button
            type="button"
            variant="ghost"
            onClick={handleLeave}
            disabled={!!actionLoading}
            className="w-full text-red-400 hover:text-red-300"
          >
            {actionLoading === 'leave' ? (
              <span className="flex items-center gap-2">
                <Spinner className="h-5 w-5 border-2" />
                Départ…
              </span>
            ) : (
              'Quitter le groupe'
            )}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={!!actionLoading}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  )
}
