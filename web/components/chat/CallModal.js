'use client'

import { useState, useEffect, useRef } from 'react'
import { getCall, updateCallStatus } from '@/lib/api/calls'
import { CallManager } from '@/lib/webrtc/callManager'

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
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling')
  const [callDuration, setCallDuration] = useState(0)
  const [remoteUser, setRemoteUser] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const endedRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return

    endedRef.current = false
    setCallStatus(isIncoming ? 'ringing' : 'calling')
    setErrorMessage(null)

    if (callManager?.localStream) {
      setLocalStream(callManager.localStream)
    }

    if (remoteDisplayName) {
      setRemoteUser({ username: remoteDisplayName })
    }

    if (callId && !String(callId).startsWith('demo-')) {
      getCall(callId)
        .then((call) => {
          if (call) {
            setRemoteUser(call.callee || call.caller)
          }
        })
        .catch(console.error)
    }

    if (!callManager) return

    callManager.onRemoteStream = (stream) => {
      setRemoteStream(stream)
      setCallStatus('connected')
    }

    callManager.onCallEnded = () => {
      if (!endedRef.current) {
        endedRef.current = true
        onCallEnded?.()
        onClose()
      }
    }

    callManager.onCallError = (err) => {
      console.error('Call error:', err)
      setErrorMessage(err.message ?? 'Erreur de connexion')
      setCallStatus('error')
    }

    callManager.onCallStatusChanged = (status) => {
      if (status === 'ringing') setCallStatus(isIncoming ? 'ringing' : 'calling')
      else if (status === 'connected') setCallStatus('connected')
    }

    if (isIncoming && callId) {
      callManager
        .answerCall(callId, callType)
        .then(() => setLocalStream(callManager.localStream))
        .catch((err) => {
          setErrorMessage(err.message)
          setCallStatus('error')
        })
    }

    return () => {
      callManager.onRemoteStream = null
      callManager.onCallEnded = null
      callManager.onCallError = null
      callManager.onCallStatusChanged = null
    }
  }, [isOpen, callId, isIncoming, callType, callManager, remoteDisplayName, onCallEnded, onClose])

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  useEffect(() => {
    if (callStatus !== 'connected') return
    const interval = setInterval(() => setCallDuration((p) => p + 1), 1000)
    return () => clearInterval(interval)
  }, [callStatus])

  async function handleEndCall() {
    endedRef.current = true
    if (callManager) await callManager.endCall()
    if (callId) await updateCallStatus(callId, 'ended')
    localStream?.getTracks().forEach((t) => t.stop())
    onCallEnded?.()
    onClose()
  }

  async function handleRejectCall() {
    endedRef.current = true
    if (callManager) await callManager.endCall('rejected')
    if (callId) await updateCallStatus(callId, 'rejected')
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

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const displayName =
    remoteUser?.display_name || remoteUser?.username || remoteDisplayName || 'Contact'

  if (!isOpen) return null

  const isOutgoingRinging = !isIncoming && (callStatus === 'calling' || callStatus === 'ringing')
  const isConnecting = callStatus === 'connecting'

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#1a1828] via-[#12101c] to-black">
      {/* En-tête */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <p className="text-lg font-semibold text-white">@{displayName}</p>
          <p className="text-sm text-zinc-400">
            {callStatus === 'connected'
              ? formatDuration(callDuration)
              : callStatus === 'error'
                ? errorMessage
                : isOutgoingRinging
                  ? `Appel ${callType === 'video' ? 'vidéo' : 'audio'} en cours…`
                  : isIncoming
                    ? 'Appel entrant'
                    : 'Connexion…'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleEndCall}
          className="rounded-full px-3 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          Fermer
        </button>
      </div>

      {/* Zone principale */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6">
        {callStatus === 'error' && (
          <div className="text-center">
            <p className="mb-4 text-5xl">⚠️</p>
            <p className="text-red-400">{errorMessage || 'Appel impossible'}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Vérifiez le micro / la caméra et la migration 019_calls.sql
            </p>
          </div>
        )}

        {(isOutgoingRinging || isConnecting) && (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-violet-600/20">
              <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/30" />
              <span className="text-5xl">{callType === 'video' ? '📹' : '📞'}</span>
            </div>
            <p className="text-xl font-medium text-white">@{displayName}</p>
            <p className="mt-2 text-zinc-400">
              {isConnecting ? 'Connexion…' : 'Sonnerie…'}
            </p>
            <div className="mt-8 flex items-center gap-2">
              <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {isIncoming && callStatus === 'ringing' && (
          <div className="flex flex-col items-center">
            <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-green-600/20 text-5xl">
              📞
            </div>
            <p className="mb-8 text-xl text-white">@{displayName}</p>
            <div className="flex gap-6">
              <button
                type="button"
                onClick={handleRejectCall}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl text-white hover:bg-red-700"
              >
                ✕
              </button>
              <button
                type="button"
                onClick={handleAnswer}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-2xl text-white hover:bg-green-700"
              >
                ✓
              </button>
            </div>
          </div>
        )}

        {callStatus === 'connected' && (
          <div className="relative h-full w-full max-w-4xl">
            {remoteStream && callType === 'video' ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="h-[50vh] w-full rounded-2xl bg-zinc-900 object-cover"
              />
            ) : (
              <div className="flex h-[40vh] items-center justify-center rounded-2xl bg-zinc-900/80">
                <p className="text-6xl">🎧</p>
              </div>
            )}
            {localStream && callType === 'video' && !isVideoOff && (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 h-32 w-44 rounded-xl border-2 border-zinc-700 object-cover shadow-xl"
              />
            )}
          </div>
        )}
      </div>

      {/* Contrôles bas */}
      <div className="flex items-center justify-center gap-6 px-6 py-8">
        {(isOutgoingRinging || callStatus === 'connected') && (
          <>
            <button
              type="button"
              onClick={toggleMute}
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                isMuted ? 'bg-red-600' : 'bg-zinc-700'
              } text-xl text-white`}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            {callType === 'video' && (
              <button
                type="button"
                onClick={toggleVideo}
                className={`flex h-14 w-14 items-center justify-center rounded-full ${
                  isVideoOff ? 'bg-red-600' : 'bg-zinc-700'
                } text-xl text-white`}
              >
                {isVideoOff ? '📷' : '📹'}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={handleEndCall}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl text-white hover:bg-red-700"
          title="Raccrocher"
        >
          📵
        </button>
      </div>
    </div>
  )
}
