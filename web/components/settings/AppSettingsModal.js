'use client'

import { Component, useRef, useState } from 'react'
import { ThemeSelector } from '@/components/ui/ThemeSelector'
import { NotificationSettings } from '@/components/settings/NotificationSettings'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Spinner } from '@/components/ui/Spinner'
import { AvatarCropModal } from '@/components/ui/AvatarCropModal'
import { uploadAvatar, removeAvatar } from '@/lib/api/profiles'
import { useAuth } from '@/hooks/useAuth'

class SettingsErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('SettingsModal error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm text-error">
          Erreur d&apos;affichage : {this.state.error.message}
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="ml-2 text-primary hover:underline"
          >
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AvatarSection() {
  const { user, profile, refreshProfile } = useAuth()
  const inputRef = useRef(null)
  const [cropFile, setCropFile]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('Image trop volumineuse (max 10 Mo)')
      return
    }
    setError(null)
    setCropFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleCropConfirm(blob) {
    setCropFile(null)
    if (!user?.id) return
    setUploading(true)
    setError(null)
    try {
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      await uploadAvatar(user.id, file)
      await refreshProfile()
    } catch (err) {
      setError(err.message ?? 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!user?.id) return
    setUploading(true)
    setError(null)
    try {
      await removeAvatar(user.id)
      await refreshProfile()
    } catch (err) {
      setError(err.message ?? 'Erreur')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text">Photo de profil</h3>
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar username={profile?.username} avatarUrl={profile?.avatar_url} size="xl" />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Spinner className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="ghost"
              className="text-sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {profile?.avatar_url ? 'Changer la photo' : 'Ajouter une photo'}
            </Button>
            {profile?.avatar_url && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                className="text-xs text-error hover:underline disabled:opacity-50"
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
      </section>
    </>
  )
}

export function AppSettingsModal({ onClose, onOpenKeys }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-labelledby="settings-title"
      onClick={() => onClose?.()}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="settings-title" className="text-lg font-bold text-text">
            Paramètres
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-text-muted transition hover:bg-surface-highlight hover:text-text"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <SettingsErrorBoundary>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            <AvatarSection />

            <section className="border-t border-border pt-5">
              <h3 className="mb-1 text-sm font-semibold text-text">Apparence</h3>
              <p className="mb-3 text-xs text-text-muted">
                Couleurs de l&apos;interface (barre latérale, boutons, fond).
              </p>
              <ThemeSelector variant="settings" />
            </section>

            <section className="border-t border-border pt-5">
              <h3 className="mb-1 text-sm font-semibold text-text">Notifications</h3>
              <p className="mb-3 text-xs text-text-muted">
                Alertes navigateur pour les nouveaux messages (y compris onglet ouvert sur mobile).
              </p>
              <NotificationSettings />
            </section>

            <section className="border-t border-border pt-5">
              <h3 className="mb-1 text-sm font-semibold text-text">Sécurité</h3>
              <p className="mb-3 text-xs text-text-muted">
                Sauvegarde et restauration de vos clés de chiffrement bout en bout.
              </p>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  onClose()
                  onOpenKeys?.()
                }}
              >
                Clés de chiffrement
              </Button>
            </section>
          </div>
        </SettingsErrorBoundary>

        <div className="border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  )
}
