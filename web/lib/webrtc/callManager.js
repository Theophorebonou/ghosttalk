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

    this.onRemoteStream = null
    this.onCallEnded = null
    this.onCallError = null
    this.onCallStatusChanged = null
  }

  async startCall(calleeId, callType = 'audio', conversationId = null, existingCallId = null) {
    try {
      this.callType = callType
      this.isCaller = true

      const rtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      }

      this.peerConnection = new RTCPeerConnection(rtcConfig)

      const constraints = { audio: true, video: callType === 'video' }
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream)
      })

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

      if (existingCallId) {
        this.callId = existingCallId
      } else {
        const { data: newCallId, error } = await supabase.rpc('create_call', {
          p_callee_id: calleeId,
          p_call_type: callType,
          p_conversation_id: conversationId,
        })
        if (error) throw error
        this.callId = newCallId
      }

      this.subscribeToSignals()

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal('ice_candidate', event.candidate)
        }
      }

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      })
      await this.peerConnection.setLocalDescription(offer)
      await this.sendSignal('offer', offer)

      this.onCallStatusChanged?.('ringing')
      return this.callId
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

      const rtcConfig = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      }

      this.peerConnection = new RTCPeerConnection(rtcConfig)

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal('ice_candidate', event.candidate)
        }
      }

      const constraints = { audio: true, video: callType === 'video' }
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)

      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream)
      })

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

      const { data: signals } = await supabase
        .from('call_signals')
        .select('*')
        .eq('call_id', callId)
        .eq('signal_type', 'offer')
        .order('created_at', { ascending: false })
        .limit(1)

      if (!signals?.length) {
        throw new Error('Offre WebRTC introuvable')
      }

      await this.peerConnection.setRemoteDescription(signals[0].signal_data)

      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)
      await this.sendSignal('answer', answer)

      await supabase.rpc('update_call_status', {
        p_call_id: callId,
        p_status: 'connected',
      })

      this.subscribeToSignals()
      this.onCallStatusChanged?.('connected')
      return answer
    } catch (err) {
      this.onCallError?.(err)
      throw err
    }
  }

  async setRemoteAnswer(answer) {
    if (!this.peerConnection) throw new Error('No peer connection')
    await this.peerConnection.setRemoteDescription(answer)
  }

  async addIceCandidate(candidate) {
    if (!this.peerConnection) return
    try {
      await this.peerConnection.addIceCandidate(candidate)
    } catch (err) {
      console.warn('ICE candidate:', err)
    }
  }

  async sendSignal(signalType, signalData) {
    if (!this.callId || String(this.callId).startsWith('demo-')) return

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.user) return

    await supabase.from('call_signals').insert({
      call_id: this.callId,
      sender_id: session.user.id,
      signal_type: signalType,
      signal_data: signalData,
    })
  }

  subscribeToSignals() {
    if (!this.callId || String(this.callId).startsWith('demo-')) return

    if (this.signalChannel) {
      this.signalChannel.unsubscribe()
    }

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
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (signal.sender_id === session?.user?.id) return

        try {
          if (signal.signal_type === 'answer' && this.isCaller) {
            await this.setRemoteAnswer(signal.signal_data)
            this.onCallStatusChanged?.('connected')
          } else if (signal.signal_type === 'offer' && !this.isCaller) {
            await this.peerConnection.setRemoteDescription(signal.signal_data)
          } else if (signal.signal_type === 'ice_candidate') {
            await this.addIceCandidate(signal.signal_data)
          }
        } catch (err) {
          console.error('Signal handling error:', err)
        }
      }
    )

    this.signalChannel.subscribe()
  }

  toggleAudio(enabled) {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled
    })
  }

  toggleVideo(enabled) {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = enabled
    })
  }

  async endCall(reason = 'ended') {
    if (this.callId && !String(this.callId).startsWith('demo-')) {
      try {
        await supabase.rpc('update_call_status', {
          p_call_id: this.callId,
          p_status: reason === 'rejected' ? 'rejected' : 'ended',
        })
      } catch (err) {
        console.warn('endCall status:', err)
      }
    }

    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null

    this.peerConnection?.close()
    this.peerConnection = null

    this.signalChannel?.unsubscribe()
    this.signalChannel = null

    this.remoteStream = null
    const endedId = this.callId
    this.callId = null
    this.onCallEnded?.(reason)
    return endedId
  }

  isCallActive() {
    return !!this.peerConnection
  }
}

export function isWebRTCSupported() {
  return typeof window !== 'undefined' && !!window.RTCPeerConnection
}
