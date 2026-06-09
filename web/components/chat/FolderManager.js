'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  createFolder,
  updateFolder,
  deleteFolder,
  addFolderFilter,
  removeFolderFilter,
  getFolders,
} from '@/lib/api/folders'

const FOLDER_ICONS = ['📁', '📂', '🗂️', '💼', '🏠', '❤️', '⭐', '🔥', '💡', '🎯']

export function FolderManager({ onClose, onFolderCreated }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📁')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError(null)
    try {
      await createFolder(name.trim(), icon)
      onFolderCreated?.()
      onClose()
    } catch (err) {
      setError(err.message ?? 'Erreur lors de la création du dossier')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => onClose?.()}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-text">Créer un dossier</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-text-muted">
              Nom du dossier
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Travail, Famille, Amis..."
              maxLength={50}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text-muted">
              Icône
            </label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`h-10 w-10 rounded-lg border-2 text-xl transition ${
                    icon === i
                      ? 'border-primary bg-primary/20'
                      : 'border-border bg-surface-highlight hover:border-text-muted'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function FolderList({ folders, onSelectFolder, onDeleteFolder }) {
  return (
    <div className="space-y-1">
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => onSelectFolder(folder)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text transition hover:bg-surface-highlight"
        >
          <span className="text-lg">{folder.icon}</span>
          <span className="flex-1 truncate">{folder.name}</span>
          {onDeleteFolder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteFolder(folder.id)
              }}
              className="px-2 text-text-muted transition hover:text-error"
            >
              ✕
            </button>
          )}
        </button>
      ))}
    </div>
  )
}
