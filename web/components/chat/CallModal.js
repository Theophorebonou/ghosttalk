'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CallManager, isWebRTCSupported } from '@/lib/webrtc/callManager'
import { getCall, updateCallStatus } from '@/lib/api/calls'

export function CallModal({ isOpen, onClose, onCallEnded, callId, isIncoming = false, callType = 'audio' }) {
  const [callManager] = useState(() => new CallManager())
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [callStatus, setCallStatus] = useState('ringing')
  const [callDuration, setCallDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [connectionQuality, setConnectionQuality] = useState('good')
  const [remoteUser, setRemoteUser] = useState(null)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !callId) return

    // Récupérer les infos de l'appel
    getCall(callId).then(call => {
      setRemoteUser(call.caller || call.callee)
    }).catch(console.error)

    callManager.onRemoteStream = (stream) => {
      setRemoteStream(stream)
      setCallStatus('connected')
    }

    callManager.onCallEnded = (reason) => {
      onCallEnded?.(reason)
      onClose()
    }

    callManager.onCallError = (err) => {
      console.error('Call error:', err)
      setCallStatus('error')
    }

    callManager.onCallStatusChanged = (status) => {
      setCallStatus(status)
    }

    // Démarrer ou répondre à l'appel
    if (isIncoming) {
      answerCall()
    } else {
      // L'appel est déjà initié, attendre la connexion
      setCallStatus('ringing')
    }

    return () => {
      callManager.endCall()
    }
  }, [isOpen, callId, isIncoming])

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
    let interval
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [callStatus])

  // Gestion du plein écran
  useEffect(() => {
    if (!containerRef.current) return

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function answerCall() {
    try {
      setCallStatus('connecting')
      await callManager.answerCall(callId, callType)
      setLocalStream(callManager.localStream)
    } catch (err) {
      console.error('Failed to answer call:', err)
      setCallStatus('error')
    }
  }

  async function handleEndCall() {
    await callManager.endCall()
    await updateCallStatus(callId, 'ended')
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    onClose()
  }

  async function handleRejectCall() {
    await callManager.endCall('rejected')
    await updateCallStatus(callId, 'rejected')
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    onClose()
  }

  function toggleMute() {
    const newState = !isMuted
    setIsMuted(newState)
    callManager.toggleAudio(!newState)
  }

  function toggleVideo() {
    const newState = !isVideoOff
    setIsVideoOff(newState)
    callManager.toggleVideo(!newState)
  }

  function toggleFullscreen() {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  function toggleStats() {
    setShowStats(!showStats)
  }

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function getConnectionQualityIcon() {
    switch (connectionQuality) {
      case 'excellent':
        return '🟢'
      case 'good':
        return '🟡'
      case 'poor':
        return '🟠'
      case 'bad':
        return '🔴'
      default:
        return '⚪'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <div 
        ref={containerRef}
        className="flex h-full w-full flex-col items-center justify-center p-4"
      >
        {/* Vidéo distante */}
        <div className="relative mb-4 aspect-video w-full max-w-7xl overflow-hidden rounded-2xl bg-zinc-900">
          {callStatus === 'ringing' && isIncoming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-800">
              <div className="mb-4 text-6xl animate-pulse">📞</div>
              <p className="mb-2 text-2xl font-semibold text-white">
                {remoteUser?.display_name || remoteUser?.username}
              </p>
              <p className="text-zinc-400">Appel {callType === 'video' ? 'vidéo' : 'audio'} entrant...</p>
              <div className="mt-8 flex gap-4">
                <button
                  onClick={handleRejectCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                >
                  ✕
                </button>
                <button
                  onClick={answerCall}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-white transition hover:bg-green-700"
                >
                  ✓
                </button>
              </div>
            </div>
          )}

          {callStatus === 'connecting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Spinner className="mx-auto mb-4 h-12 w-12 text-violet-400" />
                <p className="text-zinc-300">Connexion en cours...</p>
              </div>
            </div>
          )}

          {callStatus === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="mb-4 text-6xl">❌</div>
                <p className="text-red-400">Erreur de connexion</p>
              </div>
            </div>
          )}

          {remoteStream && callStatus === 'connected' && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          )}

          {callStatus === 'connected' && !remoteStream && (
            <div className="flex h-full w-full items-center justify-center">
              <p className="text-zinc-500">En attente de connexion vidéo...</p>
            </div>
          )}
          
          {/* Vidéo locale (picture-in-picture) */}
          {localStream && !isVideoOff && callStatus === 'connected' && (
            <div className="absolute bottom-4 right-4 h-40 w-56 overflow-hidden rounded-xl border-2 border-zinc-700 bg-zinc-900 shadow-2xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Overlay d'informations */}
          {callStatus === 'connected' && (
            <>
              {/* Durée et qualité */}
              <div className="absolute top-4 left-4 flex items-center gap-3">
                <div className="rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur-sm">
                  {formatDuration(callDuration)}
                </div>
                <button
                  onClick={toggleStats}
                  className="rounded-full bg-black/60 px-3 py-2 text-sm text-white backdrop-blur-sm hover:bg-black/80"
                  title="Statistiques"
                >
                  {getConnectionQualityIcon()}
                </button>
              </div>

              {/* Nom du contact */}
              <div className="absolute top-4 right-4">
                <div className="rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur-sm">
                  {remoteUser?.display_name || remoteUser?.username}
                </div>
              </div>

              {/* Statistiques de connexion */}
              {showStats && (
                <div className="absolute top-16 left-4 rounded-lg bg-black/80 p-4 text-xs text-white backdrop-blur-sm">
                  <p>Qualité: {connectionQuality}</p>
                  <p>Type: {callType}</p>
                  <p>État: {callStatus}</p>
                </div>
              )}

              {/* Bouton plein écran */}
              <button
                onClick={toggleFullscreen}
                className="absolute bottom-4 left-4 rounded-full bg-black/60 p-3 text-white backdrop-blur-sm hover:bg-black/80"
                title="Plein écran"
              >
                {isFullscreen ? '⛶' : '⛶'}
              </button>
            </>
          )}
        </div>

        {/* Contrôles de l'appel */}
        {callStatus === 'connected' && (
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMute}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
                isMuted
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-700 text-white hover:bg-zinc-600'
              }`}
              title={isMuted ? 'Activer le micro' : 'Couper le micro'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>

            {callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
                  isVideoOff
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-700 text-white hover:bg-zinc-600'
                }`}
                title={isVideoOff ? 'Activer la caméra' : 'Couper la caméra'}
              >
                {isVideoOff ? '📷' : '📹'}
              </button>
            )}

            <button
              onClick={handleEndCall}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
              title="Raccrocher"
            >
              📞
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
