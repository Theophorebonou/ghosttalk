'use client'

import { useEffect, useRef, useState } from 'react'
import { getContactProfiles, publishStory } from '@/lib/api/stories'
import { encryptStoryForContacts } from '@/lib/crypto/storyCrypto'
import { buildImageStoryCiphertext } from '@/lib/crypto/storyMedia'
import { buildTextStoryPayload } from '@/lib/crypto/storyPayload'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

const MAX_STORY_IMAGE = 5 * 1024 * 1024
const MAX_CAPTION = 500

export function CreateStoryModal({ onClose, onPublished }) {
  const { user, profile } = useAuth()
  const [text, setText] = useState('')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [contactCount, setContactCount] = useState(null)
  const [step, setStep] = useState('compose')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileRef = useRef(null)
  const previewUrlRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    getContactProfiles(user.id)
      .then((c) => setContactCount(c.length))
      .catch((err) => {
        console.error(err)
        setContactCount(0)
      })
  }, [user?.id])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  function clearImagePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setImagePreview(null)
    setImageFile(null)
    setCaption('')
    setStep('compose')
  }

  async function publishCiphertext(ciphertext, mediaPath = null) {
    await publishStory({
      ciphertext,
      mediaStoragePath: mediaPath,
      authorId: user.id,
    })
    await onPublished?.()
    onClose()
  }

  async function handleTextSubmit(e) {
    e.preventDefault()
    if (!text.trim() || loading || !user?.id) return

    setLoading(true)
    setError(null)

    try {
      const contacts = await getContactProfiles(user.id)
      const author = {
        id: user.id,
        public_key: profile?.public_key,
      }

      const ciphertext = await encryptStoryForContacts(
        buildTextStoryPayload(text.trim()),
        contacts,
        author
      )
      await publishCiphertext(ciphertext)
    } catch (err) {
      console.error('Publish story failed', err)
      setError(err.message ?? 'Publication impossible')
      setLoading(false)
    }
  }

  function handlePickImage(file) {
    if (!file || loading || !user?.id) return
    if (file.size > MAX_STORY_IMAGE) {
      setError('Image trop lourde (max 5 Mo).')
      return
    }
    setError(null)
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setImagePreview(url)
    setImageFile(file)
    setCaption('')
    setStep('image')
  }

  async function handleImagePublish(e) {
    e.preventDefault()
    if (!imageFile || loading || !user?.id) return

    setLoading(true)
    setError(null)

    try {
      const contacts = await getContactProfiles(user.id)
      const author = { id: user.id, public_key: profile?.public_key }
      const buffer = await imageFile.arrayBuffer()
      const ciphertext = await buildImageStoryCiphertext(
        buffer,
        imageFile,
        contacts,
        author,
        caption
      )
      await publishCiphertext(ciphertext)
    } catch (err) {
      console.error('Publish story image failed', err)
      setError(err.message ?? 'Publication impossible')
      setLoading(false)
    }
  }

  const audienceLabel =
    contactCount === null
      ? ''
      : contactCount === 0
        ? ' · visible par vous (ajoutez des contacts pour partager)'
        : ` · ${contactCount} contact${contactCount > 1 ? 's' : ''}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text">
            {step === 'image' ? 'Statut photo' : 'Nouveau statut'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-text-muted hover:text-text disabled:opacity-40"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-text-muted">
          Visible 24 h{audienceLabel}. Contenu chiffré de bout en bout.
        </p>

        {step === 'compose' && (
          <form onSubmit={handleTextSubmit} className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Quoi de neuf ?"
              rows={4}
              maxLength={MAX_CAPTION}
              className="w-full resize-none rounded-xl border border-border bg-surface-highlight px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={loading}
            />

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) handlePickImage(f)
              }}
            />

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading || !text.trim() || !profile?.public_key}>
                {loading ? <Spinner className="h-4 w-4" /> : 'Publier'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => fileRef.current?.click()}
              >
                Photo
              </Button>
            </div>
          </form>
        )}

        {step === 'image' && imagePreview && (
          <form onSubmit={handleImagePublish} className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-border bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Aperçu"
                className="max-h-48 w-full object-contain"
              />
            </div>

            <label className="block text-xs font-medium text-text-muted">
              Message (optionnel)
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ajoutez un texte à votre photo…"
              rows={3}
              maxLength={MAX_CAPTION}
              className="w-full resize-none rounded-xl border border-border bg-surface-highlight px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={loading}
              autoFocus
            />

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={loading || !profile?.public_key}>
                {loading ? <Spinner className="h-4 w-4" /> : 'Publier'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={clearImagePreview}
              >
                Retour
              </Button>
            </div>
          </form>
        )}

        {!profile?.public_key && (
          <p className="mt-2 text-xs text-warning">
            Profil incomplet (clé publique manquante). Reconnectez-vous ou recréez vos clés.
          </p>
        )}

        {error && <p className="mt-3 text-xs text-error">{error}</p>}
      </div>
    </div>
  )
}
