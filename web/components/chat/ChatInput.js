'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ACCEPTED_MEDIA } from '@/lib/constants/media'

export function ChatInput({ onSendMessage, onSendFile, disabled, replyToMessage, onCancelReply }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  
  const fileRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])

  async function handleSubmit(e) {
    if (e) e.preventDefault()
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

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)

      // Ghost filter: Bandpass + Delay
      const lowpass = audioCtx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 2500

      const highpass = audioCtx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 200

      const delay = audioCtx.createDelay(1.0)
      delay.delayTime.value = 0.08 // 80ms robotic echo

      const feedback = audioCtx.createGain()
      feedback.gain.value = 0.3

      const wet = audioCtx.createGain()
      wet.gain.value = 0.6

      const dry = audioCtx.createGain()
      dry.gain.value = 0.8

      // Routing
      source.connect(lowpass)
      lowpass.connect(highpass)

      // Dry path
      highpass.connect(dry)

      // Wet delay path
      highpass.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(wet)

      const dest = audioCtx.createMediaStreamDestination()
      dry.connect(dest)
      wet.connect(dest)

      // Browser fallback mime types
      let mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4'
      }

      const recorder = new MediaRecorder(dest.stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const _chunks = chunksRef.current
        const blob = new Blob(_chunks, { type: mimeType })
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
        const file = new File([blob], `Vocal_Fantome_${Date.now()}.${ext}`, { type: mimeType })
        
        try {
          setLoading(true)
          setStatus('Chiffrement et envoi du vocal…')
          await onSendFile(file)
        } catch (err) {
          console.error(err)
          setStatus("Échec de l'envoi vocal")
        } finally {
          setLoading(false)
          setTimeout(() => setStatus(null), 3000)
        }
        
        // cleanup
        stream.getTracks().forEach(t => t.stop())
        audioCtx.close()
      }

      recorder.start()
      setIsRecording(true)
      setRecordingTime(0)
    } catch (err) {
      console.error(err)
      setStatus("Impossible d'accéder au micro (vérifiez les autorisations)")
      setTimeout(() => setStatus(null), 4000)
    }
  }

  function stopRecording(cancel = false) {
    if (mediaRecorderRef.current && isRecording) {
      if (cancel) {
        mediaRecorderRef.current.onstop = () => {
          streamRef.current?.getTracks().forEach(t => t.stop())
          audioContextRef.current?.close()
          setStatus('Mémo vocal annulé')
          setTimeout(() => setStatus(null), 2000)
        }
      }
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  useEffect(() => {
    let interval = null
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 border-t border-violet-500/10 bg-[#2a2838]/80 p-2 sm:p-4 backdrop-blur-md"
    >
      {replyToMessage && (
        <div className="flex items-center justify-between bg-black/20 rounded-lg p-2 text-sm border-l-2 border-violet-500/50">
          <div className="flex flex-col truncate pr-4">
            <span className="text-[10px] uppercase font-bold text-violet-400">En réponse à un message</span>
            <span className="truncate text-zinc-300 text-xs">
              {replyToMessage.payload?.t === 'text' ? replyToMessage.payload.b : 'Contenu multimédia'}
            </span>
          </div>
          <button type="button" onClick={onCancelReply} className="text-zinc-500 hover:text-zinc-300 px-2 shrink-0">
            ✕
          </button>
        </div>
      )}

      {status && (
        <p className="text-center text-xs text-violet-300">{status}</p>
      )}

      {isRecording ? (
        <div className="flex items-center gap-3 bg-zinc-900/80 p-2 rounded-full border border-violet-500/50 text-white animate-pulse-slow shadow-[0_0_15px_rgba(139,92,246,0.2)]">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse ml-3 shrink-0" />
          <span className="text-sm font-mono flex-1 font-semibold">
            {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
          </span>
          <button type="button" disabled={loading} onClick={() => stopRecording(true)} className="text-xs text-zinc-400 hover:text-red-400 px-3 py-2 font-medium shrink-0">
            Annuler
          </button>
          <Button type="button" disabled={loading} onClick={() => stopRecording(false)} className="rounded-full h-8 px-4 py-1 text-xs bg-violet-600 hover:bg-violet-700 shrink-0">
            {loading ? <Spinner className="h-4 w-4" /> : 'Envoyer'}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 items-center">
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
            title="Envoyer une pièce jointe"
          >
            📎
          </button>
          
          <div className="relative flex-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={disabled || loading}
              placeholder="Message chiffré…"
              className="w-full rounded-full border border-zinc-700 bg-zinc-900 px-5 py-3 pr-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              autoComplete="off"
            />
            {/* Si c'est vide, on affiche le bouton micro, sinon rien (on privilégie le texte) */}
            {!text.trim() && (
              <button
                type="button"
                disabled={disabled || loading}
                onClick={startRecording}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 transition"
                title="Vocal Fantôme"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
              </button>
            )}
          </div>
          
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
      )}
    </form>
  )
}
