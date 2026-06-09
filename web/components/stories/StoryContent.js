'use client'

import { useEffect, useState } from 'react'
import { downloadStoryMedia } from '@/lib/api/stories'
import { decryptInlineMedia } from '@/lib/crypto/media'
import { deriveSharedKey } from '@/lib/crypto/e2e'
import { importStoredKeyPair } from '@/lib/crypto/keys'
import { unwrapV2ImagePayload } from '@/lib/crypto/storyMedia'

export function StoryContent({ payload, authorPublicKey }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (payload?.t !== 'image' && payload?.v !== 2) return

    let cancelled = false
    let objectUrl

    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (payload.v === 2) {
          const result = await unwrapV2ImagePayload(payload, authorPublicKey)
          if (cancelled) { URL.revokeObjectURL(result.blobUrl); return }
          objectUrl = result.blobUrl
        } else if (payload.decryptedUrl) {
          objectUrl = payload.decryptedUrl
        } else if (payload.inline && payload.data) {
          const localKeyPair = await importStoredKeyPair()
          const shared = await deriveSharedKey(localKeyPair.privateKey, authorPublicKey)
          const buffer = await decryptInlineMedia(shared, payload.data)
          if (cancelled) return
          objectUrl = URL.createObjectURL(new Blob([buffer], { type: payload.mime || 'image/jpeg' }))
        } else if (payload.path) {
          const enc = await downloadStoryMedia(payload.path)
          const localKeyPair = await importStoredKeyPair()
          const shared = await deriveSharedKey(localKeyPair.privateKey, authorPublicKey)
          const { decryptBytes } = await import('@/lib/crypto/media')
          const buffer = await decryptBytes(shared, enc)
          if (cancelled) return
          objectUrl = URL.createObjectURL(new Blob([buffer], { type: payload.mime || 'image/jpeg' }))
        } else {
          throw new Error('Image invalide')
        }

        if (!cancelled) setBlobUrl(objectUrl)
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Image indéchiffrable')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (objectUrl && objectUrl !== payload.decryptedUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [payload, authorPublicKey])

  if (payload?.t === 'text') {
    return (
      <p className="max-w-lg whitespace-pre-wrap text-center text-xl leading-relaxed text-white/90">
        {payload.b}
      </p>
    )
  }

  if (payload?.t === 'error') {
    return <p className="text-sm text-error">{payload.message}</p>
  }

  if (payload?.t === 'image' || payload?.v === 2) {
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
