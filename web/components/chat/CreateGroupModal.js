'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGroup, addGroupMember } from '@/lib/api/conversations'
import { searchProfiles } from '@/lib/api/profiles'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'

export function CreateGroupModal({ onClose }) {
  const router = useRouter()
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Recherche de membres
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [searching, setSearching] = useState(false)

  async function handleSearch(value) {
    setSearch(value)
    if (value.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const data = await searchProfiles(value)
      setSearchResults(data)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  function toggleMember(user) {
    setSelectedMembers(prev =>
      prev.find(m => m.id === user.id)
        ? prev.filter(m => m.id !== user.id)
        : [...prev, user]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!groupName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const convId = await createGroup(groupName.trim())

      // Ajouter les membres sélectionnés
      await Promise.all(
        selectedMembers.map(member => addGroupMember(convId, member.id))
      )

      onClose()
      router.push(`/chat/${convId}`)
    } catch (err) {
      setError(err.message ?? 'Impossible de créer le groupe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => onClose?.()}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-xl font-bold text-text">Créer un groupe</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Nom du groupe */}
          <div>
            <label htmlFor="groupName" className="mb-2 block text-sm text-text-muted">
              Nom du groupe
            </label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Mon groupe"
              required
            />
          </div>

          {/* Recherche de membres */}
          <div>
            <label className="mb-2 block text-sm text-text-muted">
              Ajouter des membres
            </label>
            <Input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Rechercher par pseudo..."
            />

            {/* Résultats de recherche */}
            {searching && (
              <div className="mt-2 flex justify-center">
                <Spinner className="h-4 w-4 border-2" />
              </div>
            )}
            {searchResults.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-xl bg-surface-highlight">
                {searchResults.map(user => {
                  const isSelected = selectedMembers.find(m => m.id === user.id)
                  return (
                    <li
                      key={user.id}
                      onClick={() => toggleMember(user)}
                      className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors ${
                        isSelected ? 'bg-primary/20' : 'hover:bg-surface'
                      }`}
                    >
                      <span className="text-sm text-text">{user.username}</span>
                      {isSelected && <span className="text-xs font-bold text-primary">✓ Ajouté</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Membres sélectionnés */}
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMembers.map(member => (
                <span
                  key={member.id}
                  onClick={() => toggleMember(member)}
                  className="flex cursor-pointer items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-xs text-primary transition-colors hover:bg-error/20 hover:text-error"
                >
                  {member.username} ✕
                </span>
              ))}
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-5 w-5 border-2" />
                  Création…
                </span>
              ) : (
                `Créer${selectedMembers.length > 0 ? ` (${selectedMembers.length + 1})` : ''}`
              )}
            </Button>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}