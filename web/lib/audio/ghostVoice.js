import { audioBufferToWav } from './audioBufferToWav'

/**
 * Préréglages de transformation vocale (traitement OfflineAudioContext).
 * Chaque preset modifie nettement le timbre — pas un simple filtre passe-bas.
 */
export const GHOST_VOICE_PRESETS = {
  phantom: {
    id: 'phantom',
    label: 'Fantôme',
    description: 'Voix grave, réverbération spectrale',
    pitch: 1,
    lowshelfGain: 9,
    lowshelfFreq: 200,
    lowpassHz: 3000,
    ringHz: 55,
    ringDepth: 0.45,
    reverbMix: 0.35,
    distortion: 0.2,
  },
  wraith: {
    id: 'wraith',
    label: 'Spectre',
    description: 'Voix aiguë et métallique',
    pitch: 1.25,
    ringHz: 120,
    ringDepth: 0.55,
    reverbMix: 0.2,
    distortion: 0.15,
    lowpassHz: 5200,
  },
  void: {
    id: 'void',
    label: 'Abîme',
    description: 'Voix très grave, saturée',
    pitch: 1,
    lowshelfGain: 14,
    lowshelfFreq: 140,
    lowpassHz: 2400,
    ringHz: 40,
    ringDepth: 0.6,
    reverbMix: 0.45,
    distortion: 0.45,
  },
}

const DEFAULT_PRESET = 'phantom'

function makeDistortionCurve(amount) {
  const n = 256
  const curve = new Float32Array(n)
  const k = Math.max(1, amount * 80)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}

function buildImpulseResponse(ctx, duration, decay) {
  const rate = ctx.sampleRate
  const len = rate * duration
  const impulse = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
  }
  return impulse
}

async function decodeToBuffer(arrayBuffer) {
  const ctx = new AudioContext()
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await ctx.close()
  }
}

/**
 * Ring modulation, saturation, reverb ; pitch optionnel (ralentit si ≠ 1).
 * Voix grave via lowshelf sans changer la vitesse (pitch = 1).
 */
async function renderProcessedBuffer(sourceBuffer, preset) {
  const pitch = preset.pitch ?? 1
  const shiftPitch = Math.abs(pitch - 1) > 0.02
  const duration = shiftPitch ? sourceBuffer.duration / pitch : sourceBuffer.duration
  const channels = sourceBuffer.numberOfChannels
  const sampleRate = sourceBuffer.sampleRate

  const offline = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate) + 1024, sampleRate)

  const source = offline.createBufferSource()
  source.buffer = sourceBuffer
  source.playbackRate.value = shiftPitch ? pitch : 1

  const dry = offline.createGain()
  dry.gain.value = 0.55

  const wet = offline.createGain()
  wet.gain.value = preset.reverbMix ?? 0.3

  const ringGain = offline.createGain()
  ringGain.gain.value = 1

  const ringOsc = offline.createOscillator()
  ringOsc.type = 'sine'
  ringOsc.frequency.value = preset.ringHz ?? 60
  const ringDepth = offline.createGain()
  ringDepth.gain.value = preset.ringDepth ?? 0.4
  ringOsc.connect(ringDepth)
  ringDepth.connect(ringGain.gain)

  const shaper = offline.createWaveShaper()
  shaper.curve = makeDistortionCurve(preset.distortion ?? 0.2)
  shaper.oversample = '4x'

  const low = offline.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = preset.lowpassHz ?? (shiftPitch && pitch < 1 ? 3200 : 5200)
  low.Q.value = 0.7

  let toneTail = low
  if (preset.lowshelfGain) {
    const shelf = offline.createBiquadFilter()
    shelf.type = 'lowshelf'
    shelf.frequency.value = preset.lowshelfFreq ?? 200
    shelf.gain.value = preset.lowshelfGain
    low.connect(shelf)
    toneTail = shelf
  }

  const convolver = offline.createConvolver()
  convolver.buffer = buildImpulseResponse(offline, 0.4, 2.5)
  convolver.normalize = true

  source.connect(ringGain)
  ringGain.connect(shaper)
  shaper.connect(low)
  toneTail.connect(dry)
  toneTail.connect(convolver)
  convolver.connect(wet)
  dry.connect(offline.destination)
  wet.connect(offline.destination)

  ringOsc.start(0)
  source.start(0)
  ringOsc.stop(duration + 0.1)
  source.stop(duration)

  return offline.startRendering()
}

/**
 * Transforme un enregistrement vocal (webm/mp4/…) en WAV avec voix masquée.
 */
export async function processGhostVoice(blob, presetId = DEFAULT_PRESET) {
  const preset = GHOST_VOICE_PRESETS[presetId] ?? GHOST_VOICE_PRESETS[DEFAULT_PRESET]
  const arrayBuffer = await blob.arrayBuffer()
  const decoded = await decodeToBuffer(arrayBuffer)
  const rendered = await renderProcessedBuffer(decoded, preset)
  const wav = audioBufferToWav(rendered)
  const name = blob.name?.replace(/\.[^.]+$/, '') || 'vocal'
  return new File([wav], `${name}_masque.wav`, { type: 'audio/wav' })
}

export function isGhostVoiceSupported() {
  return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext)
}
