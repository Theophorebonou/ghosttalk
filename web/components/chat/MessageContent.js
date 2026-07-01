'use client'

import { useEffect, useState } from 'react'
import { downloadAndDecryptMedia } from '@/lib/api/media'
import { decryptInlineMedia } from '@/lib/crypto/media'
import { formatFileSize } from '@/lib/constants/media'
import { Spinner } from '@/components/ui/Spinner'
import { VoicePlayer } from './VoicePlayer'

export function MessageContent({ payload, sharedKey, isOwn }) {
  if (!payload) {
    return <p className="text-xs italic opacity-70">Chargement…</p>
  }

  if (payload.t === 'error') {
    return <p className="text-sm italic opacity-80">{payload.message}</p>
  }

  if (payload.t === 'text') {
    return <p className="whitespace-pre-wrap break-words text-sm">{payload.b}</p>
  }

  if (payload.t === 'sticker') {
    return (
      <span className="block select-none text-5xl leading-none" role="img">
        {payload.emoji}
      </span>
    )
  }

  if (payload.t === 'media') {
    return <MediaAttachment payload={payload} sharedKey={sharedKey} isOwn={isOwn} />
  }

  return null
}

function MediaAttachment({ payload, sharedKey, isOwn }) {
  // Préview locale (envoi optimiste) : affichée immédiatement, sans déchiffrement
  const [blobUrl, setBlobUrl] = useState(payload.localUrl ?? null)
  const [loading, setLoading] = useState(!payload.localUrl)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (payload.localUrl) return

    let objectUrl
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        let blob
        if (payload.inline && payload.data) {
          const buffer = await decryptInlineMedia(sharedKey, payload.data)
          blob = new Blob([buffer], { type: payload.mime })
        } else if (payload.path) {
          blob = await downloadAndDecryptMedia(sharedKey, payload.path, payload.mime)
        } else {
          throw new Error('Média invalide')
        }

        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Impossible de charger le fichier')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [payload, sharedKey])

  const linkClass = isOwn ? 'text-violet-100 underline' : 'text-violet-300 underline'

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Spinner className="h-4 w-4 border-2" />
        <span className="text-xs opacity-80">Déchiffrement du fichier…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm">
        <p className="font-medium">{payload.name}</p>
        <p className="text-xs opacity-70">{error}</p>
      </div>
    )
  }

  const isImage = payload.mime?.startsWith('image/')
  const isVideo = payload.mime?.startsWith('video/')
  const isAudio = payload.mime?.startsWith('audio/')
  const isVoiceMasked = isAudio && payload.name?.includes('Masque')

  // Voice messages get their own compact layout
  if (isAudio) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 shrink-0 opacity-70" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3zm6.364 8.364a.75.75 0 00-1.06 1.06A5.978 5.978 0 0119 15a6 6 0 01-12 0 5.978 5.978 0 011.696-4.576.75.75 0 00-1.06-1.06A7.478 7.478 0 006 15a7.5 7.5 0 0015 0 7.478 7.478 0 00-2.636-5.636zM11.25 22.5h1.5v-2.502a7.52 7.52 0 01-1.5 0V22.5z" />
          </svg>
          <span className="text-xs font-medium opacity-80">Message vocal</span>
          {isVoiceMasked && (
            <span className="rounded-full bg-current/10 px-1.5 py-px text-[10px] font-medium opacity-70">
              anonyme
            </span>
          )}
        </div>
        {blobUrl && <VoicePlayer blobUrl={blobUrl} isOwn={isOwn} />}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium opacity-90">
        {payload.name}{' '}
        <span className="font-normal opacity-70">({formatFileSize(payload.size)})</span>
      </p>

      {isImage && blobUrl && (
        <a href={blobUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={blobUrl}
            alt={payload.name}
            className="max-h-64 max-w-full rounded-lg object-contain"
          />
        </a>
      )}

      {isVideo && blobUrl && (
        <video
          src={blobUrl}
          controls
          className="max-h-64 max-w-full rounded-lg bg-black/40"
          preload="metadata"
        />
      )}

      {!isImage && !isVideo && blobUrl && (
        <a href={blobUrl} download={payload.name} className={`text-sm ${linkClass}`}>
          Télécharger le fichier
        </a>
      )}
    </div>
  )
}
