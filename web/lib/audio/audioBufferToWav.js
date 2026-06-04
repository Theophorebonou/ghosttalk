/**
 * Encode AudioBuffer en WAV (PCM 16-bit) pour export après traitement vocal.
 */
export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16

  const samples = interleaveChannels(buffer)
  const dataLength = samples.length * 2
  const headerLength = 44
  const arrayBuffer = new ArrayBuffer(headerLength + dataLength)
  const view = new DataView(arrayBuffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true)
  view.setUint16(32, numChannels * (bitDepth / 8), true)
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  floatTo16BitPCM(view, 44, samples)

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function interleaveChannels(buffer) {
  const channels = []
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }
  const length = buffer.length
  const result = new Float32Array(length * buffer.numberOfChannels)
  let offset = 0
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      result[offset++] = channels[ch][i]
    }
  }
  return result
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
