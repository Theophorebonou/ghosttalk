'use client'

import { useState, useEffect, useRef } from 'react'
import { getCall, updateCallStatus, subscribeToCallStatus } from '@/lib/api/calls'

const RING_TIMEOUT_MS = 45000

export function CallModal({
  isOpen,
  onClose,
  onCallEnded,
  callId,
  isIncoming = false,
  callType = 'audio',
  callManager: externalCallManager,
  remoteDisplayName = null,
}) {
  const callManager = externalCallManager
  const [localStream,  setLocalStream]  = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted,      setIsMuted]      = useState(false)
  const [isVideoOff,   setIsVideoOff]   = useState(false)
  const [callStatus,   setCallStatus]   = useState(isIncoming ? 'ringing' : 'calling')
  const [callDuration, setCallDuration] = useState(0)
  const [remoteUser,   setRemoteUser]   = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const localVideoRef  = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const endedRef       = useRef(false)

  // Handlers du parent non mémoïsés — via refs pour ne pas résouscrire
  // les canaux realtime à chaque render de ChatWindow
  const onCloseRef     = useRef(onClose)
  const onCallEndedRef = useRef(onCallEnded)
  onCloseRef.current     = onClose
  onCallEndedRef.current = onCallEnded

  useEffect(() => {
    if (!isOpen) return

    endedRef.current = false
    setCallStatus(isIncoming ? 'ringing' : 'calling')
    setErrorMessage(null)
    setCallDuration(0)

    if (callManager?.localStream) setLocalStream(callManager.localStream)

    if (remoteDisplayName) setRemoteUser({ username: remoteDisplayName })

    if (callId && !String(callId).startsWith('demo-')) {
      getCall(callId).then((call) => {
        // L'interlocuteur : l'appelant si l'appel est entrant, sinon l'appelé
        if (call) setRemoteUser(isIncoming ? call.caller : call.callee)
      }).catch(console.error)
    }

    if (!callManager) return

    callManager.onRemoteStream = (stream) => {
      setRemoteStream(stream)
      setCallStatus('connected')
    }

    callManager.onCallEnded = () => {
      if (!endedRef.current) {
        endedRef.current = true
        onCallEndedRef.current?.()
        onCloseRef.current?.()
      }
    }

    callManager.onCallError = (err) => {
      console.error('Call error:', err)
      setErrorMessage(err.message ?? 'Erreur de connexion')
      setCallStatus('error')
    }

    callManager.onCallStatusChanged = (status) => {
      if (status === 'ringing')   setCallStatus(isIncoming ? 'ringing' : 'calling')
      else if (status === 'connected') setCallStatus('connected')
    }

    return () => {
      callManager.onRemoteStream    = null
      callManager.onCallEnded       = null
      callManager.onCallError       = null
      callManager.onCallStatusChanged = null
    }
  }, [isOpen, callId, isIncoming, callType, callManager, remoteDisplayName])

  // Fin d'appel signalée par l'autre participant (rejet, raccrochage, manqué)
  useEffect(() => {
    if (!isOpen || !callId) return
    const channel = subscribeToCallStatus(callId, (call) => {
      if (!['ended', 'rejected', 'missed'].includes(call?.status)) return
      if (endedRef.current) return
      endedRef.current = true
      callManager?.endCall(call.status, { updateStatus: false }).catch(console.error)
      onCallEndedRef.current?.()
      onCloseRef.current?.()
    })
    return () => channel?.unsubscribe()
  }, [isOpen, callId, callManager])

  // Timeout de sonnerie côté appelant : appel non répondu → manqué
  useEffect(() => {
    if (!isOpen || isIncoming || callStatus !== 'calling') return
    const timer = setTimeout(() => {
      if (endedRef.current) return
      endedRef.current = true
      callManager?.endCall('missed').catch(console.error)
      onCallEndedRef.current?.()
      onCloseRef.current?.()
    }, RING_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isOpen, isIncoming, callStatus, callManager])

  useEffect(() => {
    if (localStream  && localVideoRef.current)  localVideoRef.current.srcObject  = localStream
  }, [localStream, callStatus, isVideoOff])

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
    if (remoteStream && remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream
  }, [remoteStream, callStatus])

  useEffect(() => {
    if (callStatus !== 'connected') return
    const id = setInterval(() => setCallDuration((p) => p + 1), 1000)
    return () => clearInterval(id)
  }, [callStatus])

  // Statut mis à jour ici (pas via le manager) : pour un appel entrant non
  // décroché, le manager n'est pas encore lié au callId et n'écrirait rien
  async function handleEndCall() {
    endedRef.current = true
    if (callId) await updateCallStatus(callId, 'ended').catch(console.error)
    if (callManager) await callManager.endCall('ended', { updateStatus: false })
    localStream?.getTracks().forEach((t) => t.stop())
    onCallEnded?.()
    onClose()
  }

  async function handleRejectCall() {
    endedRef.current = true
    if (callId) await updateCallStatus(callId, 'rejected').catch(console.error)
    if (callManager) await callManager.endCall('rejected', { updateStatus: false })
    onClose()
  }

  async function handleAnswer() {
    if (!callManager || !callId) return
    setCallStatus('connecting')
    try {
      await callManager.answerCall(callId, callType)
      setLocalStream(callManager.localStream)
    } catch (err) {
      setErrorMessage(err.message)
      setCallStatus('error')
    }
  }

  function toggleMute() {
    const next = !isMuted
    setIsMuted(next)
    callManager?.toggleAudio(!next)
  }

  function toggleVideo() {
    const next = !isVideoOff
    setIsVideoOff(next)
    callManager?.toggleVideo(!next)
  }

  function fmt(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const displayName = remoteUser?.display_name || remoteUser?.username || remoteDisplayName || 'Contact'
  const isVideo     = callType === 'video'

  if (!isOpen) return null

  const isOutgoing   = !isIncoming && (callStatus === 'calling' || callStatus === 'ringing')
  const isConnecting = callStatus === 'connecting'

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'linear-gradient(160deg, #1f2c34 0%, #111b21 55%, #0b141a 100%)' }}>

      {/* Sortie audio des appels vocaux (la balise <video> ne couvre que le mode vidéo) */}
      {!isVideo && <audio ref={remoteAudioRef} autoPlay />}

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pb-3 pt-5">
        <div className="flex flex-col">
          <span className="text-base font-semibold text-white">@{displayName}</span>
          <span className="mt-0.5 text-xs text-white/50">
            {callStatus === 'connected'    ? fmt(callDuration)
            : callStatus === 'error'       ? (errorMessage ?? 'Erreur')
            : isOutgoing                   ? `Appel ${isVideo ? 'vidéo' : 'audio'}…`
            : isConnecting                 ? 'Connexion…'
            : isIncoming                   ? 'Appel entrant'
            : 'En cours…'}
          </span>
        </div>

        {/* End / minimise */}
        <button
          type="button"
          onClick={handleEndCall}
          className="rounded-full px-3 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white/70 transition"
        >
          Fermer
        </button>
      </div>

      {/* Main area */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6">

        {/* Error */}
        {callStatus === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error/10">
              <svg className="h-10 w-10 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm text-error">{errorMessage || 'Appel impossible'}</p>
            <p className="text-xs text-white/30">Vérifiez les permissions micro / caméra</p>
          </div>
        )}

        {/* Outgoing ringing */}
        {(isOutgoing || isConnecting) && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="relative">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <span className="absolute -inset-3 animate-ping rounded-full bg-primary/10 [animation-delay:300ms]" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-primary/20 ring-4 ring-primary/10">
                {isVideo
                  ? <VideoCamIcon className="h-12 w-12 text-primary/80" />
                  : <PhoneIcon     className="h-12 w-12 text-primary/80" />
                }
              </div>
            </div>
            <div>
              <p className="text-xl font-semibold text-white">@{displayName}</p>
              <p className="mt-1 text-sm text-white/40">{isConnecting ? 'Connexion…' : 'Sonnerie…'}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}

        {/* Incoming ringing */}
        {isIncoming && callStatus === 'ringing' && (
          <div className="flex flex-col items-center gap-8">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/5 ring-4 ring-white/10">
              <PhoneIcon className="h-12 w-12 animate-pulse text-white/80" />
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-white">@{displayName}</p>
              <p className="mt-1 text-sm text-white/40">{isVideo ? 'Appel vidéo entrant' : 'Appel audio entrant'}</p>
            </div>
            <div className="flex gap-8">
              <button
                type="button"
                onClick={handleRejectCall}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-error/90 shadow-lg hover:bg-error transition">
                  <PhoneOffIcon className="h-7 w-7 text-white" />
                </span>
              </button>
              <button
                type="button"
                onClick={handleAnswer}
                className="flex h-16 w-16 flex-col items-center justify-center gap-1"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 shadow-lg hover:bg-green-500 transition">
                  <PhoneIcon className="h-7 w-7 text-white" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Connected — video */}
        {callStatus === 'connected' && isVideo && (
          <div className="relative h-full w-full max-w-3xl">
            {/* Remote video (main) */}
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay playsInline
                className="h-[55vh] w-full rounded-2xl bg-surface object-cover shadow-xl"
              />
            ) : (
              <div className="flex h-[55vh] items-center justify-center rounded-2xl bg-surface">
                <VideoCamIcon className="h-12 w-12 text-text-muted" />
              </div>
            )}
            {/* Local pip */}
            {localStream && !isVideoOff && (
              <video
                ref={localVideoRef}
                autoPlay playsInline muted
                className="absolute bottom-3 right-3 h-32 w-44 rounded-xl border border-white/10 bg-surface object-cover shadow-xl"
              />
            )}
          </div>
        )}

        {/* Connected — audio only */}
        {callStatus === 'connected' && !isVideo && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/20">
              <svg className="h-12 w-12 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-white">@{displayName}</p>
            <p className="text-sm text-white/40">{fmt(callDuration)}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 px-6 pb-safe pb-10 pt-4">
        {(isOutgoing || callStatus === 'connected') && (
          <>
            {/* Mute */}
            <ControlBtn
              active={isMuted}
              onClick={toggleMute}
              title={isMuted ? 'Activer le micro' : 'Couper le micro'}
            >
              {isMuted
                ? <MicOffIcon className="h-6 w-6" />
                : <MicIcon    className="h-6 w-6" />
              }
            </ControlBtn>

            {/* Camera (video only) */}
            {isVideo && (
              <ControlBtn
                active={isVideoOff}
                onClick={toggleVideo}
                title={isVideoOff ? 'Activer la caméra' : 'Couper la caméra'}
              >
                {isVideoOff
                  ? <VideoCamOffIcon className="h-6 w-6" />
                  : <VideoCamIcon    className="h-6 w-6" />
                }
              </ControlBtn>
            )}
          </>
        )}

        {/* End call */}
        <button
          type="button"
          onClick={handleEndCall}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-error shadow-lg transition hover:bg-error/80"
          title="Raccrocher"
        >
          <PhoneOffIcon className="h-7 w-7 text-white" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ControlBtn({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
        active
          ? 'bg-error/80 text-white hover:bg-error'
          : 'bg-white/10 text-white/80 hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  )
}

// SVG icons
function PhoneIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function PhoneOffIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6" />
    </svg>
  )
}

function VideoCamIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function VideoCamOffIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
    </svg>
  )
}

function MicIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  )
}

function MicOffIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
    </svg>
  )
}
