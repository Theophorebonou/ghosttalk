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

export function CreateStoryModal({ onClose, onPublished }) {
  const { user, profile } = useAuth()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [contactCount, setContactCount] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    getContactProfiles(user.id)
      .then((c) => setContactCount(c.length))
      .catch((err) => {
        console.error(err)
        setContactCount(0)
      })
  }, [user?.id])

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

  async function handleImage(file) {
    if (!file || loading || !user?.id) return
    if (file.size > MAX_STORY_IMAGE) {
      setError('Image trop lourde (max 5 Mo).')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const contacts = await getContactProfiles(user.id)
      const author = { id: user.id, public_key: profile?.public_key }
      const buffer = await file.arrayBuffer()
      const ciphertext = await buildImageStoryCiphertext(buffer, file, contacts, author)
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
      <div className="w-full max-w-md rounded-2xl border border-violet-500/20 bg-[#2a2838] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-100">Nouveau statut</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-zinc-500">
          Visible 24 h{audienceLabel}. Contenu chiffré de bout en bout.
        </p>

        <form onSubmit={handleTextSubmit} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Quoi de neuf ?"
            rows={4}
            maxLength={500}
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
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
              if (f) handleImage(f)
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

        {!profile?.public_key && (
          <p className="mt-2 text-xs text-amber-400">
            Profil incomplet (clé publique manquante). Reconnectez-vous ou recréez vos clés.
          </p>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  )
}
