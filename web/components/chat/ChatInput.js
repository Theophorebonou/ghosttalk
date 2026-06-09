'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CreatePollModal } from './CreatePollModal'
import { ScheduleMessageModal } from './ScheduleMessageModal'
import { StickerPicker } from './StickerPicker'
import { ACCEPTED_MEDIA } from '@/lib/constants/media'
import {
  EPHEMERAL_AFTER_READ,
  EPHEMERAL_TIMER_OPTIONS,
} from '@/lib/constants/wellbeing'
import {
  GHOST_VOICE_PRESETS,
  isGhostVoiceSupported,
  processGhostVoice,
} from '@/lib/audio/ghostVoice'
import {
  isSpeechRecognitionSupported,
  startRealtimeTranscription,
} from '@/lib/audio/speechRecognition'
import { getDraft, setDraft } from '@/lib/utils/drafts'

export function ChatInput({
  conversationId,
  onSendMessage,
  onSendFile,
  onSendPoll,
  onScheduleMessage,
  onSendSticker,
  onStartCall,
  disabled,
  replyToMessage,
  onCancelReply,
  storyReplyContext,
  onCancelStoryReply,
  editingMessage,
  onCancelEdit,
  onTyping,
}) {
  const [text, setText] = useState('')
  const typingTimerRef = useRef(null)

  useEffect(() => {
    if (conversationId && !editingMessage && !storyReplyContext) {
      setText(getDraft(conversationId))
    }
  }, [conversationId, editingMessage, storyReplyContext])

  useEffect(() => {
    if (storyReplyContext?.text) {
      setText(storyReplyContext.text)
    }
  }, [storyReplyContext])

  useEffect(() => {
    if (editingMessage?.payload?.t === 'text') {
      setText(editingMessage.payload.b)
    }
  }, [editingMessage])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [liveBars, setLiveBars] = useState([])
  const [ghostVoiceEnabled, setGhostVoiceEnabled] = useState(false)
  const [voicePreset, setVoicePreset] = useState('phantom')
  const [transcript, setTranscript] = useState('')
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(false)
  const [showEphemeralMenu, setShowEphemeralMenu] = useState(false)
  /** null | { kind: 'timer', seconds } | { kind: 'after_read' } */
  const [ephemeralMode, setEphemeralMode] = useState(null)
  const [showPollModal, setShowPollModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)

  const fileRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const audioCtxRef = useRef(null)
  const recognitionRef = useRef(null)
  const ghostVoiceEnabledRef = useRef(ghostVoiceEnabled)
  const voicePresetRef = useRef(voicePreset)
  ghostVoiceEnabledRef.current = ghostVoiceEnabled
  voicePresetRef.current = voicePreset

  const voiceSupported = isGhostVoiceSupported()
  const speechSupported = isSpeechRecognitionSupported()

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (!text.trim() || loading || disabled) return

    const currentText = text
    setText('')
    if (conversationId) setDraft(conversationId, '')
    setLoading(true)
    setStatus(null)

    try {
      await onSendMessage(currentText, ephemeralMode, editingMessage)
      onCancelEdit?.()
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
      await onSendFile(file, ephemeralMode)
      setStatus(null)
    } catch (err) {
      console.error(err)
      setStatus(err.message ?? "Échec de l'envoi du fichier")
    } finally {
      setLoading(false)
    }
  }

  function stopLiveWaveform() {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null }
    analyserRef.current = null
    setLiveBars([])
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Live waveform — time-domain RMS (responds to voice volume, not frequency)
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      const tdData = new Uint8Array(analyser.fftSize)
      const LIVE_BARS = 30
      function tick() {
        analyser.getByteTimeDomainData(tdData)
        const block = Math.floor(tdData.length / LIVE_BARS)
        const bars = Array.from({ length: LIVE_BARS }, (_, i) => {
          let rms = 0
          for (let j = 0; j < block; j++) {
            const v = (tdData[i * block + j] - 128) / 128
            rms += v * v
          }
          return Math.max(Math.sqrt(rms / block), 0.06)
        })
        setLiveBars(bars)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)

      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm'
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4'
      }

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const rawChunks = chunksRef.current
        stream.getTracks().forEach((t) => t.stop())
        stopLiveWaveform()

        // Arrêter la transcription
        if (recognitionRef.current) {
          recognitionRef.current.stop()
          recognitionRef.current = null
        }

        let blob = new Blob(rawChunks, { type: mimeType })
        let ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
        let outMime = mimeType

        const applyMask = ghostVoiceEnabledRef.current
        const preset = voicePresetRef.current

        if (applyMask && voiceSupported) {
          try {
            setStatus('Transformation de la voix…')
            const rawFile = new File([blob], `raw.${ext}`, { type: mimeType })
            const processed = await processGhostVoice(rawFile, preset)
            blob = processed
            ext = 'wav'
            outMime = 'audio/wav'
          } catch (procErr) {
            console.error(procErr)
            setStatus('Filtre vocal indisponible — envoi voix brute')
            await new Promise((r) => setTimeout(r, 1200))
          }
        }

        const file = new File(
          [blob],
          `Vocal_${applyMask ? 'Masque' : 'Fantome'}_${Date.now()}.${ext}`,
          { type: outMime }
        )

        try {
          setLoading(true)
          setStatus('Chiffrement et envoi du vocal…')
          await onSendFile(file, ephemeralMode)
        } catch (err) {
          console.error(err)
          setStatus("Échec de l'envoi vocal")
        } finally {
          setLoading(false)
          setTimeout(() => setStatus(null), 3000)
        }
      }

      recorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      setTranscript('')

      // Démarrer la transcription si activée
      if (transcriptionEnabled && speechSupported) {
        try {
          recognitionRef.current = startRealtimeTranscription(
            (result) => {
              if (result.final) {
                setTranscript((prev) => prev + result.final)
              }
            },
            (err) => console.error('Transcription error:', err)
          )
        } catch (err) {
          console.error('Failed to start transcription:', err)
        }
      }
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
          streamRef.current?.getTracks().forEach((t) => t.stop())
          stopLiveWaveform()
          setStatus('Mémo vocal annulé')
          setTimeout(() => setStatus(null), 2000)
        }
      }
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  async function handleCreatePoll(pollData) {
    if (!onSendPoll) return
    try {
      await onSendPoll(pollData)
      setShowPollModal(false)
    } catch (err) {
      console.error(err)
      setStatus('Échec de la création du sondage')
    }
  }

  async function handleScheduleMessage(scheduledFor) {
    if (!onScheduleMessage) return
    try {
      await onScheduleMessage(scheduledFor)
      setShowScheduleModal(false)
      setStatus('Message programmé avec succès')
      setTimeout(() => setStatus(null), 2000)
    } catch (err) {
      console.error(err)
      setStatus('Échec de la programmation du message')
    }
  }

  function handleStickerSelect(sticker) {
    if (!onSendSticker) return
    onSendSticker(sticker)
  }

  useEffect(() => {
    let interval = null
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  const ephemeralLabel = ephemeralMode
    ? ephemeralMode.kind === 'after_read'
      ? 'Après lecture'
      : EPHEMERAL_TIMER_OPTIONS.find((o) => o.seconds === ephemeralMode.seconds)?.label ?? 'Sans trace'
    : null

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 border-t border-border bg-surface-highlight p-2 sm:p-3"
      >
        {editingMessage && (
          <div className="flex items-center justify-between rounded-lg border-l-2 border-warning bg-warning/10 px-3 py-2 text-sm">
            <span className="text-xs text-warning">Modification du message</span>
            <button type="button" onClick={onCancelEdit} className="text-text-muted hover:text-text transition">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {storyReplyContext && (
          <div className="flex items-center justify-between rounded-lg border-l-2 border-primary bg-primary/10 px-3 py-2 text-sm">
            <div className="truncate pr-4">
              <span className="text-[10px] font-semibold uppercase text-primary">
                Reponse au statut
              </span>
              <span className="block truncate text-xs text-text">
                @{storyReplyContext.authorUsername}
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelStoryReply}
              className="shrink-0 text-text-muted hover:text-text transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {replyToMessage && (
          <div className="flex items-center justify-between rounded-lg border-l-2 border-primary bg-primary/10 px-3 py-2 text-sm">
            <div className="flex flex-col truncate pr-4">
              <span className="text-[10px] font-semibold uppercase text-primary">
                En reponse
              </span>
              <span className="truncate text-xs text-text">
                {replyToMessage.payload?.t === 'text'
                  ? replyToMessage.payload.b
                  : 'Contenu multimedia'}
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="shrink-0 text-text-muted hover:text-text transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {status && <p className="text-center text-xs text-primary">{status}</p>}

        {/* Ephemeral mode toggle */}
        {!isRecording && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => setShowEphemeralMenu((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition ${
                  ephemeralMode
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface text-text-muted hover:text-text'
                }`}
                title="Message ephemere"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {ephemeralLabel ?? 'Ephemere'}
              </button>
              {showEphemeralMenu && (
                <div className="absolute bottom-full left-0 z-20 mb-1 min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-xl animate-fade-in">
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-xs text-text-muted hover:bg-surface-highlight hover:text-text transition"
                    onClick={() => {
                      setEphemeralMode(null)
                      setShowEphemeralMenu(false)
                    }}
                  >
                    Desactive
                  </button>
                  {EPHEMERAL_TIMER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="w-full rounded-md px-3 py-2 text-left text-xs text-text hover:bg-surface-highlight transition"
                      onClick={() => {
                        setEphemeralMode({ kind: 'timer', seconds: opt.seconds })
                        setShowEphemeralMenu(false)
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-xs text-text hover:bg-surface-highlight transition"
                    onClick={() => {
                      setEphemeralMode({ kind: 'after_read' })
                      setShowEphemeralMenu(false)
                    }}
                  >
                    {EPHEMERAL_AFTER_READ.label}
                  </button>
                  <p className="px-3 py-1 text-[10px] text-text-muted">
                    {EPHEMERAL_AFTER_READ.description}
                  </p>
                </div>
              )}
            </div>
            {ephemeralMode && (
              <span className="text-[10px] text-text-muted">
                Le message disparaîtra automatiquement
              </span>
            )}
          </div>
        )}

        {isRecording ? (
          <div className="flex flex-col gap-2">
            {/* Recording bar with live waveform */}
            <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-surface px-3 py-2">
              <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-error" />
              {/* Live waveform */}
              <div className="flex h-8 flex-1 items-end gap-px">
                {(liveBars.length > 0 ? liveBars : Array(30).fill(0.06)).map((amp, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-error/70 transition-all duration-75"
                    style={{ height: `${amp * 100}%`, minHeight: 3 }}
                  />
                ))}
              </div>
              <span className="shrink-0 font-mono text-xs text-text-muted tabular-nums">
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </span>
              <button
                type="button"
                disabled={loading}
                onClick={() => stopRecording(true)}
                className="shrink-0 px-2 py-1 text-xs text-text-muted transition hover:text-error"
              >
                Annuler
              </button>
              <Button
                type="button"
                disabled={loading}
                onClick={() => stopRecording(false)}
                className="h-8 shrink-0 rounded-full px-4 py-1 text-xs"
              >
                {loading ? <Spinner className="h-4 w-4" /> : 'Envoyer'}
              </Button>
            </div>

            {voiceSupported && (
              <div className="rounded-xl border border-primary/20 bg-surface p-3">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-primary">
                      Masquer ma voix
                    </span>
                    <p className="text-[10px] text-text-muted">
                      Activable pendant l&apos;enregistrement · grave sans ralentir
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={ghostVoiceEnabled}
                    onChange={(e) => setGhostVoiceEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary"
                  />
                </label>
                {ghostVoiceEnabled && (
                  <select
                    value={voicePreset}
                    onChange={(e) => setVoicePreset(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-surface-highlight px-2 py-1.5 text-xs text-text"
                  >
                    {Object.values(GHOST_VOICE_PRESETS).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} — {p.description}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {speechSupported && (
              <div className="rounded-xl border border-primary/20 bg-surface p-3">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-primary">
                      Transcription vocale
                    </span>
                    <p className="text-[10px] text-text-muted">
                      Convertir la voix en texte en temps réel
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={transcriptionEnabled}
                    onChange={(e) => setTranscriptionEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary"
                  />
                </label>
                {transcript && (
                  <div className="mt-2 rounded-lg border border-border bg-surface-highlight p-2">
                    <p className="text-xs text-text">{transcript}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_MEDIA}
              className="hidden"
              onChange={handleFileChange}
            />
            
            {/* Attachment button */}
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => fileRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text disabled:opacity-40"
              title="Piece jointe"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {/* Text input */}
            <div className="relative flex-1">
              <input
                value={text}
                onChange={(e) => {
                  const v = e.target.value
                  setText(v)
                  if (conversationId && !editingMessage) setDraft(conversationId, v)
                  if (onTyping) {
                    onTyping()
                    clearTimeout(typingTimerRef.current)
                    typingTimerRef.current = setTimeout(() => {}, 2000)
                  }
                }}
                disabled={disabled || loading}
                placeholder={
                  editingMessage
                    ? 'Modifier le message...'
                    : ephemeralMode
                      ? 'Message ephemere...'
                      : 'Tapez un message'
                }
                className="w-full rounded-full bg-surface px-4 py-2.5 pr-12 text-sm text-text placeholder:text-text-muted focus:outline-none"
                autoComplete="off"
              />
              {!text.trim() && (
                <button
                  type="button"
                  disabled={disabled || loading}
                  onClick={startRecording}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition hover:bg-surface-highlight hover:text-text"
                  title="Message vocal"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Send button */}
            <button
              type="submit"
              disabled={disabled || loading || !text.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-hover disabled:opacity-40"
            >
              {loading ? (
                <Spinner className="h-5 w-5" />
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        )}
      </form>

      {showPollModal && (
        <CreatePollModal
          onClose={() => setShowPollModal(false)}
          onCreatePoll={handleCreatePoll}
        />
      )}

      {showScheduleModal && (
        <ScheduleMessageModal
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleScheduleMessage}
        />
      )}

      {showStickerPicker && (
        <StickerPicker
          onSelect={handleStickerSelect}
          onClose={() => setShowStickerPicker(false)}
        />
      )}
    </>
  )
}
