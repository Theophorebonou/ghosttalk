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
  const recognitionRef = useRef(null)

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

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

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

        // Arrêter la transcription
        if (recognitionRef.current) {
          recognitionRef.current.stop()
          recognitionRef.current = null
        }

        let blob = new Blob(rawChunks, { type: mimeType })
        let ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
        let outMime = mimeType

        if (ghostVoiceEnabled && voiceSupported) {
          try {
            setStatus('Transformation de la voix…')
            const rawFile = new File([blob], `raw.${ext}`, { type: mimeType })
            const processed = await processGhostVoice(rawFile, voicePreset)
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
          `Vocal_${ghostVoiceEnabled ? 'Masque' : 'Fantome'}_${Date.now()}.${ext}`,
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
        className="flex flex-col gap-2 border-t border-violet-500/10 bg-[#2a2838]/80 p-2 sm:p-4 backdrop-blur-md"
      >
        {editingMessage && (
          <div className="flex items-center justify-between rounded-lg border-l-2 border-amber-500/50 bg-amber-950/20 p-2 text-sm">
            <span className="text-xs text-amber-300">Modification du message</span>
            <button type="button" onClick={onCancelEdit} className="text-zinc-500 hover:text-zinc-300">
              ✕
            </button>
          </div>
        )}

        {storyReplyContext && (
          <div className="flex items-center justify-between rounded-lg border-l-2 border-fuchsia-500/50 bg-fuchsia-950/20 p-2 text-sm">
            <div className="truncate pr-4">
              <span className="text-[10px] font-bold uppercase text-fuchsia-400">
                Réponse au statut
              </span>
              <span className="block truncate text-xs text-zinc-300">
                @{storyReplyContext.authorUsername}
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelStoryReply}
              className="shrink-0 px-2 text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          </div>
        )}

        {replyToMessage && (
          <div className="flex items-center justify-between rounded-lg border-l-2 border-violet-500/50 bg-black/20 p-2 text-sm">
            <div className="flex flex-col truncate pr-4">
              <span className="text-[10px] font-bold uppercase text-violet-400">
                En réponse à un message
              </span>
              <span className="truncate text-xs text-zinc-300">
                {replyToMessage.payload?.t === 'text'
                  ? replyToMessage.payload.b
                  : 'Contenu multimédia'}
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="shrink-0 px-2 text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          </div>
        )}

        {status && <p className="text-center text-xs text-violet-300">{status}</p>}

        {/* Sans trace */}
        {!isRecording && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => setShowEphemeralMenu((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition ${
                  ephemeralMode
                    ? 'border-violet-500/50 bg-violet-600/20 text-violet-200'
                    : 'border-zinc-700 text-zinc-400 hover:border-violet-500/30 hover:text-zinc-300'
                }`}
                title="Message sans trace"
              >
                <span aria-hidden>👁‍🗨</span>
                {ephemeralLabel ?? 'Sans trace'}
              </button>
              {showEphemeralMenu && (
                <div className="absolute bottom-full left-0 z-20 mb-1 min-w-[180px] rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-800"
                    onClick={() => {
                      setEphemeralMode(null)
                      setShowEphemeralMenu(false)
                    }}
                  >
                    Désactivé
                  </button>
                  {EPHEMERAL_TIMER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                      onClick={() => {
                        setEphemeralMode({ kind: 'timer', seconds: opt.seconds })
                        setShowEphemeralMenu(false)
                      }}
                    >
                      ⏱ {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                    onClick={() => {
                      setEphemeralMode({ kind: 'after_read' })
                      setShowEphemeralMenu(false)
                    }}
                  >
                    ✓ {EPHEMERAL_AFTER_READ.label}
                  </button>
                  <p className="px-3 py-1 text-[10px] text-zinc-500">
                    {EPHEMERAL_AFTER_READ.description}
                  </p>
                </div>
              )}
            </div>
            {ephemeralMode && (
              <span className="text-[10px] text-zinc-500">
                Le message disparaîtra automatiquement
              </span>
            )}
          </div>
        )}

        {isRecording ? (
          <div className="flex flex-col gap-2">
            <div className="flex animate-pulse-slow items-center gap-3 rounded-full border border-violet-500/50 bg-zinc-900/80 p-2 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]">
              <div className="ml-3 h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-500" />
              <span className="flex-1 font-mono text-sm font-semibold">
                {Math.floor(recordingTime / 60)}:
                {(recordingTime % 60).toString().padStart(2, '0')}
              </span>
              <button
                type="button"
                disabled={loading}
                onClick={() => stopRecording(true)}
                className="shrink-0 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-red-400"
              >
                Annuler
              </button>
              <Button
                type="button"
                disabled={loading}
                onClick={() => stopRecording(false)}
                className="h-8 shrink-0 rounded-full bg-violet-600 px-4 py-1 text-xs hover:bg-violet-700"
              >
                {loading ? <Spinner className="h-4 w-4" /> : 'Envoyer'}
              </Button>
            </div>

            {voiceSupported && (
              <div className="rounded-xl border border-violet-500/20 bg-black/30 p-3">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-violet-200">
                      Masquer ma voix
                    </span>
                    <p className="text-[10px] text-zinc-500">
                      Transformation réelle (pitch + modulation)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={ghostVoiceEnabled}
                    onChange={(e) => setGhostVoiceEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-600 text-violet-600"
                  />
                </label>
                {ghostVoiceEnabled && (
                  <select
                    value={voicePreset}
                    onChange={(e) => setVoicePreset(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
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
              <div className="rounded-xl border border-violet-500/20 bg-black/30 p-3">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-violet-200">
                      Transcription vocale
                    </span>
                    <p className="text-[10px] text-zinc-500">
                      Convertir la voix en texte en temps réel
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={transcriptionEnabled}
                    onChange={(e) => setTranscriptionEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-600 text-violet-600"
                  />
                </label>
                {transcript && (
                  <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-900 p-2">
                    <p className="text-xs text-zinc-300">{transcript}</p>
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
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => fileRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg text-zinc-300 transition hover:border-violet-500 hover:text-violet-300 disabled:opacity-40"
              title="Envoyer une pièce jointe"
            >
              📎
            </button>

            {onSendPoll && (
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => setShowPollModal(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg text-zinc-300 transition hover:border-violet-500 hover:text-violet-300 disabled:opacity-40"
                title="Créer un sondage"
              >
                📊
              </button>
            )}

            {onScheduleMessage && (
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => setShowScheduleModal(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg text-zinc-300 transition hover:border-violet-500 hover:text-violet-300 disabled:opacity-40"
                title="Programmer l'envoi"
              >
                📅
              </button>
            )}

            {onSendSticker && (
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => setShowStickerPicker(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg text-zinc-300 transition hover:border-violet-500 hover:text-violet-300 disabled:opacity-40"
                title="Stickers"
              >
                😀
              </button>
            )}

            {onStartCall && (
              <>
                <button
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => onStartCall('audio')}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg text-zinc-300 transition hover:border-violet-500 hover:text-violet-300 disabled:opacity-40"
                  title="Appel audio"
                >
                  📞
                </button>
                <button
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => onStartCall('video')}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-lg text-zinc-300 transition hover:border-violet-500 hover:text-violet-300 disabled:opacity-40"
                  title="Appel vidéo"
                >
                  📹
                </button>
              </>
            )}

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
                    ? 'Modifier le message…'
                    : ephemeralMode
                      ? 'Message sans trace…'
                      : 'Message chiffré…'
                }
                className="w-full rounded-full border border-zinc-700 bg-zinc-900 px-5 py-3 pr-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                autoComplete="off"
              />
              {!text.trim() && (
                <button
                  type="button"
                  disabled={disabled || loading}
                  onClick={startRecording}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-violet-500/10 hover:text-violet-400"
                  title="Message vocal"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={disabled || loading || !text.trim()}
              className="shrink-0 rounded-full px-5 sm:px-6"
            >
              {loading ? (
                <Spinner className="h-5 w-5" />
              ) : editingMessage ? (
                'Enregistrer'
              ) : (
                'Envoyer'
              )}
            </Button>
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
