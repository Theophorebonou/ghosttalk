'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ACCEPTED_MEDIA } from '@/lib/constants/media'

export function ChatInput({ onSendMessage, onSendFile, disabled }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const fileRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() || loading || disabled) return

    const currentText = text
    setText('')
    setLoading(true)
    setStatus(null)

    try {
      await onSendMessage(currentText)
    } catch (err) {
      console.error(err)
      setText(currentText)
      setStatus(err.message ?? "Échec de l'envoi")
    } finally {
      setLoading(false)
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || loading || disabled || !onSendFile) return

    setLoading(true)
    setStatus(`Envoi de ${file.name}…`)

    try {
      await onSendFile(file)
      setStatus(null)
    } catch (err) {
      console.error(err)
      setStatus(err.message ?? "Échec de l'envoi du fichier")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 border-t border-violet-500/10 bg-[#2a2838]/80 p-2 sm:p-4 backdrop-blur-md"
    >
      {status && (
        <p className="text-center text-xs text-violet-300">{status}</p>
      )}
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_MEDIA}
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => fileRef.current?.click()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg text-zinc-300 transition hover:border-violet-500 hover:text-violet-300 disabled:opacity-40"
          title="Envoyer une image, vidéo ou fichier"
        >
          📎
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || loading}
          placeholder="Message ou pièce jointe chiffrée…"
          className="min-w-0 flex-1 rounded-full border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          autoComplete="off"
        />
        <Button
          type="submit"
          disabled={disabled || loading || !text.trim()}
          className="shrink-0 rounded-full px-5 sm:px-6"
        >
          {loading && !text.trim() ? (
            <Spinner className="h-5 w-5" />
          ) : loading ? (
            <Spinner className="h-5 w-5" />
          ) : (
            'Envoyer'
          )}
        </Button>
      </div>
    </form>
  )
}
