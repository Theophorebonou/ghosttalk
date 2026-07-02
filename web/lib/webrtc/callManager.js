import { supabase } from '@/lib/supabase/client'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Public TURN for symmetric NAT (mobile 4G/5G)
  { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
]

export class CallManager {
  constructor() {
    this.peerConnection   = null
    this.localStream      = null
    this.remoteStream     = null
    this.callId           = null
    this.callType         = 'audio'
    this.isCaller         = false
    this.signalChannel    = null
    this._ended           = false
    this._remoteDescSet   = false
    this._pendingCandidates = []  // ICE queue before remote desc is set

    this.onRemoteStream        = null
    this.onCallEnded           = null
    this.onCallError           = null
    this.onCallStatusChanged   = null
  }

  _buildPeerConnection() {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = (event) => {
      if (event.candidate) this.sendSignal('ice_candidate', event.candidate.toJSON())
    }

    pc.ontrack = (event) => {
      this.remoteStream = event.streams[0] ?? new MediaStream([event.track])
      this.onRemoteStream?.(this.remoteStream)
    }

    // Both state machines — whichever fires first wins
    const handleConnected = () => {
      if (!this._ended) this.onCallStatusChanged?.('connected')
    }
    const handleDisconnected = () => {
      if (!this._ended) this.endCall('disconnected')
    }

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      if (s === 'connected')                          handleConnected()
      if (s === 'disconnected' || s === 'failed' || s === 'closed') handleDisconnected()
    }

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState
      if (s === 'connected' || s === 'completed')     handleConnected()
      if (s === 'disconnected' || s === 'failed')     handleDisconnected()
    }

    return pc
  }

  _mediaConstraints() {
    if (this.callType !== 'video') return { audio: true, video: false }
    return {
      audio: true,
      video: {
        facingMode: 'user',
        width:  { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24 },
      },
    }
  }

  async startCall(calleeId, callType = 'audio', conversationId = null, existingCallId = null) {
    this._ended = false
    this.callType  = callType
    this.isCaller  = true
    this._remoteDescSet = false
    this._pendingCandidates = []

    try {
      this.peerConnection = this._buildPeerConnection()
      this.localStream    = await navigator.mediaDevices.getUserMedia(this._mediaConstraints())

      this.localStream.getTracks().forEach((t) => this.peerConnection.addTrack(t, this.localStream))

      if (existingCallId) {
        this.callId = existingCallId
      } else {
        const { data, error } = await supabase.rpc('create_call', {
          p_callee_id: calleeId, p_call_type: callType, p_conversation_id: conversationId,
        })
        if (error) throw error
        this.callId = data
      }

      // Subscribe BEFORE creating the offer — so answer + ICE from callee are never missed
      this.subscribeToSignals()

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      })
      await this.peerConnection.setLocalDescription(offer)
      await this.sendSignal('offer', this.peerConnection.localDescription.toJSON())

      this.onCallStatusChanged?.('ringing')
      return this.callId
    } catch (err) {
      this.onCallError?.(err)
      throw err
    }
  }

  async answerCall(callId, callType = 'audio') {
    this._ended = false
    this.callId   = callId
    this.callType = callType
    this.isCaller = false
    this._remoteDescSet = false
    this._pendingCandidates = []

    try {
      this.peerConnection = this._buildPeerConnection()

      // Subscribe BEFORE fetching the offer — so caller's ICE candidates are queued, not lost
      this.subscribeToSignals()

      this.localStream = await navigator.mediaDevices.getUserMedia(this._mediaConstraints())
      this.localStream.getTracks().forEach((t) => this.peerConnection.addTrack(t, this.localStream))

      // Fetch every signal already stored (offer + ICE candidates sent before
      // our realtime subscription existed — otherwise these candidates are lost)
      const { data: { session } } = await supabase.auth.getSession()
      const { data: signals } = await supabase
        .from('call_signals')
        .select('*')
        .eq('call_id', callId)
        .order('created_at', { ascending: true })

      const remoteSignals = (signals ?? []).filter((s) => s.sender_id !== session?.user?.id)
      const offer = remoteSignals.filter((s) => s.signal_type === 'offer').pop()
      if (!offer) throw new Error('Offre WebRTC introuvable')

      await this.peerConnection.setRemoteDescription(offer.signal_data)
      this._remoteDescSet = true

      // Drain early candidates (from the fetch) then those queued via realtime
      const earlyCandidates = remoteSignals
        .filter((s) => s.signal_type === 'ice_candidate')
        .map((s) => s.signal_data)
      for (const c of [...earlyCandidates, ...this._pendingCandidates]) {
        await this._addIce(c)
      }
      this._pendingCandidates = []

      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)
      await this.sendSignal('answer', this.peerConnection.localDescription.toJSON())

      await supabase.rpc('update_call_status', { p_call_id: callId, p_status: 'connected' })

      this.onCallStatusChanged?.('connected')
      return answer
    } catch (err) {
      this.onCallError?.(err)
      throw err
    }
  }

  async _addIce(candidate) {
    if (!this.peerConnection) return
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (err) {
      console.warn('addIceCandidate:', err)
    }
  }

  async sendSignal(signalType, signalData) {
    if (!this.callId || String(this.callId).startsWith('demo-')) return
    const { data: { session } } = await supabase.auth.getSession()
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
    this.signalChannel?.unsubscribe()

    this.signalChannel = supabase
      .channel(`call_signals:${this.callId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'call_signals',
        filter: `call_id=eq.${this.callId}`,
      }, async (payload) => {
        const signal = payload.new
        const { data: { session } } = await supabase.auth.getSession()
        if (signal.sender_id === session?.user?.id) return

        try {
          if (signal.signal_type === 'answer' && this.isCaller) {
            await this.peerConnection?.setRemoteDescription(signal.signal_data)
            this._remoteDescSet = true
            for (const c of this._pendingCandidates) await this._addIce(c)
            this._pendingCandidates = []
            this.onCallStatusChanged?.('connected')
          } else if (signal.signal_type === 'ice_candidate') {
            if (this._remoteDescSet) {
              await this._addIce(signal.signal_data)
            } else {
              this._pendingCandidates.push(signal.signal_data)
            }
          }
        } catch (err) {
          console.error('Signal handling error:', err)
        }
      })
      .subscribe()
  }

  toggleAudio(enabled) {
    this.localStream?.getAudioTracks().forEach((t) => { t.enabled = enabled })
  }

  toggleVideo(enabled) {
    this.localStream?.getVideoTracks().forEach((t) => { t.enabled = enabled })
  }

  // updateStatus:false — cleanup local seulement (l'autre participant a déjà
  // mis le statut terminal en base, ne pas l'écraser)
  async endCall(reason = 'ended', { updateStatus = true } = {}) {
    if (this._ended) return
    this._ended = true

    if (updateStatus && this.callId && !String(this.callId).startsWith('demo-')) {
      try {
        await supabase.rpc('update_call_status', {
          p_call_id: this.callId,
          p_status: ['rejected', 'missed'].includes(reason) ? reason : 'ended',
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
    this.remoteStream  = null
    const id = this.callId
    this.callId = null
    this.onCallEnded?.(reason)
    return id
  }

  isCallActive() { return !!this.peerConnection }
}

export function isWebRTCSupported() {
  return typeof window !== 'undefined' && !!window.RTCPeerConnection
}
