'use client'

import { useEffect, useState } from 'react'
import { downloadStoryMedia } from '@/lib/api/stories'
import { decryptInlineMedia } from '@/lib/crypto/media'
import { deriveSharedKey } from '@/lib/crypto/e2e'
import { importStoredKeyPair } from '@/lib/crypto/keys'

export function StoryContent({ payload, authorPublicKey, viewerId }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (payload?.t !== 'image') return

    let cancelled = false
    let objectUrl

    async function load() {
      setLoading(true)
      setError(null)
      try {
        let buffer
        if (payload.inline && payload.data) {
          const localKeyPair = await importStoredKeyPair()
          const shared = await deriveSharedKey(localKeyPair.privateKey, authorPublicKey)
          buffer = await decryptInlineMedia(shared, payload.data)
        } else if (payload.path) {
          const enc = await downloadStoryMedia(payload.path)
          const localKeyPair = await importStoredKeyPair()
          const shared = await deriveSharedKey(localKeyPair.privateKey, authorPublicKey)
          const { decryptBytes } = await import('@/lib/crypto/media')
          buffer = await decryptBytes(shared, enc)
        } else {
          throw new Error('Image invalide')
        }

        if (cancelled) return
        objectUrl = URL.createObjectURL(
          new Blob([buffer], { type: payload.mime || 'image/jpeg' })
        )
        setBlobUrl(objectUrl)
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Image indéchiffrable')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [payload, authorPublicKey, viewerId])

  if (payload?.t === 'text') {
    return (
      <p className="max-w-lg whitespace-pre-wrap text-center text-xl leading-relaxed text-zinc-100">
        {payload.b}
      </p>
    )
  }

  if (payload?.t === 'error') {
    return <p className="text-sm text-red-300">{payload.message}</p>
  }

  if (payload?.t === 'image') {
    if (loading) return <p className="text-sm text-text-muted">Déchiffrement…</p>
    if (error) return <p className="text-sm text-error">{error}</p>
    if (blobUrl) {
      const caption =
        typeof payload.caption === 'string' ? payload.caption.trim() : ''
      return (
        <div className="flex max-w-lg flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt=""
            className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
          {caption ? (
            <p className="max-w-lg whitespace-pre-wrap text-center text-lg leading-relaxed text-text">
              {caption}
            </p>
          ) : null}
        </div>
      )
    }
  }

  return null
}
