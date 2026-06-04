import { supabase } from '@/lib/supabase/client'

export class CallManager {
  constructor() {
    this.peerConnection = null
    this.localStream = null
    this.remoteStream = null
    this.callId = null
    this.callType = 'audio'
    this.isCaller = false
    this.signalChannel = null
    
    // Callbacks
    this.onRemoteStream = null
    this.onCallEnded = null
    this.onCallError = null
    this.onCallStatusChanged = null
    this.onIncomingCall = null
  }

  async startCall(calleeId, callType = 'audio', conversationId = null) {
    try {
      this.callType = callType
      this.isCaller = true

      // Configuration STUN/TURN
      const rtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      }

      this.peerConnection = new RTCPeerConnection(rtcConfig)

      // Obtenir le flux local
      const constraints = {
        audio: true,
        video: callType === 'video',
      }
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      // Ajouter les pistes locales
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream)
      })

      // Écouter les pistes distantes
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0]
        this.onRemoteStream?.(this.remoteStream)
      }

      // Écouter les changements d'état ICE
      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection.iceConnectionState
        if (state === 'disconnected' || state === 'failed') {
          this.endCall('disconnected')
        } else if (state === 'connected') {
          this.onCallStatusChanged?.('connected')
        }
      }

      // Créer l'offre
      // Créer l'appel en base AVANT tout
      const { data: call } = await supabase.rpc('create_call', {
        p_callee_id: calleeId,
        p_call_type: callType,
        p_conversation_id: conversationId,
      })
      this.callId = call

      // S'abonner AVANT d'envoyer l'offre
      this.subscribeToSignals()

      // Envoyer les candidats ICE au fur et à mesure
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal('ice_candidate', event.candidate)
        }
      }

      // Créer et envoyer l'offre
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      })
      await this.peerConnection.setLocalDescription(offer)
      await this.sendSignal('offer', offer)
      return call
    } catch (err) {
      this.onCallError?.(err)
      throw err
    }
  }

  async answerCall(callId, callType = 'audio') {
    try {
      this.callId = callId
      this.callType = callType
      this.isCaller = false

      // Récupérer l'appel
      const { data: call } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single()

      if (!call) throw new Error('Call not found')

      // Configuration STUN/TURN
      const rtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      }

      this.peerConnection = new RTCPeerConnection(rtcConfig)
            // Envoyer les candidats ICE
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal('ice_candidate', event.candidate)
        }
      }

      // Obtenir le flux local
      const constraints = {
        audio: true,
        video: callType === 'video',
      }
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      // Ajouter les pistes locales
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream)
      })

      // Écouter les pistes distantes
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0]
        this.onRemoteStream?.(this.remoteStream)
      }

      this.peerConnection.oniceconnectionstatechange = () => {
        const state = this.peerConnection.iceConnectionState
        if (state === 'disconnected' || state === 'failed') {
          this.endCall('disconnected')
        } else if (state === 'connected') {
          this.onCallStatusChanged?.('connected')
        }
      }

      // Récupérer l'offre
      const { data: signals } = await supabase
        .from('call_signals')
        .select('*')
        .eq('call_id', callId)
        .eq('signal_type', 'offer')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!signals || signals.length === 0) {
        throw new Error('No offer found')
      }

      const offer = signals[0].signal_data
      await this.peerConnection.setRemoteDescription(offer)

      // Créer la réponse
      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)

      // Envoyer la réponse
      await this.sendSignal('answer', answer)

      // Mettre à jour le statut de l'appel
      await supabase.rpc('update_call_status', {
        p_call_id: callId,
        p_status: 'connected',
      })

      // S'abonner aux signaux ICE
      this.subscribeToSignals()
      // Juste après avoir créé le peerConnection
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal('ice_candidate', event.candidate)
        }
      }

      return answer
    } catch (err) {
      this.onCallError?.(err)
      throw err
    }
  }

  async setRemoteAnswer(answer) {
    if (!this.peerConnection) throw new Error('No active peer connection')
    await this.peerConnection.setRemoteDescription(answer)
  }

  async addIceCandidate(candidate) {
    if (!this.peerConnection) throw new Error('No active peer connection')
    await this.peerConnection.addIceCandidate(candidate)
  }

  onIceCandidate(callback) {
    if (!this.peerConnection) return
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        callback(event.candidate)
        // Envoyer le candidat ICE via signalisation
        this.sendSignal('ice_candidate', event.candidate)
      }
    }
  }

  async sendSignal(signalType, signalData) {
    if (!this.callId) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('call_signals').insert({
      call_id: this.callId,
      sender_id: user.id,
      signal_type: signalType,
      signal_data: signalData,
    })
  }

  subscribeToSignals() {
    if (!this.callId) return

    this.signalChannel = supabase.channel(`call_signals:${this.callId}`)

    this.signalChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `call_id=eq.${this.callId}`,
      },
      async (payload) => {
        const signal = payload.new
        
        // Ignorer nos propres signaux
        const { data: { user } } = await supabase.auth.getUser()
        if (signal.sender_id === user?.id) return

        if (signal.signal_type === 'answer' && this.isCaller) {
          await this.setRemoteAnswer(signal.signal_data)
        } else if (signal.signal_type === 'ice_candidate') {
          await this.addIceCandidate(signal.signal_data)
        }
      }
    )

    this.signalChannel.subscribe()
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled
      })
    }
  }

  async endCall(reason = 'ended') {
    if (this.callId) {
      // Mettre à jour le statut de l'appel
      await supabase.rpc('update_call_status', {
        p_call_id: this.callId,
        p_status: reason === 'rejected' ? 'rejected' : 'ended',
      })
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    if (this.signalChannel) {
      this.signalChannel.unsubscribe()
      this.signalChannel = null
    }

    this.remoteStream = null
    this.callId = null
    this.onCallEnded?.(reason)
  }

  isCallActive() {
    return this.peerConnection !== null
  }

  getCallType() {
    return this.callType
  }
}

export function isWebRTCSupported() {
  return typeof window !== 'undefined' && !!window.RTCPeerConnection
}
