'use client'

import { useEffect, useRef, useState } from 'react'

const BARS = 40
const MIN_H = 0.06  // hauteur minimale des barres (0-1)

function downsample(channelData, bars) {
  const blockSize = Math.floor(channelData.length / bars)
  const out = new Array(bars)
  for (let i = 0; i < bars; i++) {
    let rms = 0
    const start = i * blockSize
    for (let j = 0; j < blockSize; j++) rms += channelData[start + j] ** 2
    out[i] = Math.sqrt(rms / blockSize)
  }
  const max = Math.max(...out, 0.001)
  return out.map((v) => Math.max(v / max, MIN_H))
}

function fmt(s) {
  const m = Math.floor((s || 0) / 60)
  const sec = Math.floor((s || 0) % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function VoicePlayer({ blobUrl, isOwn }) {
  const audioRef = useRef(null)
  const [playing, setPlaying]     = useState(false)
  const [currentTime, setCurrent] = useState(0)
  const [duration, setDuration]   = useState(0)
  const [bars, setBars]           = useState(() => Array(BARS).fill(MIN_H))

  // Analyse de la forme d'onde via Web Audio API
  useEffect(() => {
    if (!blobUrl) return
    let cancelled = false
    let ctx = null
    ;(async () => {
      try {
        const buf = await fetch(blobUrl).then((r) => r.arrayBuffer())
        if (cancelled) return
        ctx = new AudioContext()
        const decoded = await ctx.decodeAudioData(buf)
        await ctx.close()
        ctx = null
        if (cancelled) return
        setBars(downsample(decoded.getChannelData(0), BARS))
        if (!audioRef.current?.duration) setDuration(decoded.duration)
      } catch {
        if (ctx) { ctx.close().catch(() => {}); ctx = null }
      }
    })()
    return () => {
      cancelled = true
      if (ctx) { ctx.close().catch(() => {}); ctx = null }
    }
  }, [blobUrl])

  function togglePlay() {
    const a = audioRef.current
    if (!a) return
    playing ? a.pause() : a.play()
  }

  function handleSeek(e) {
    const a = audioRef.current
    if (!a || !duration) return
    const r = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - r.left) / r.width) * duration
  }

  const progress   = duration > 0 ? currentTime / duration : 0
  const activeBars = Math.round(progress * BARS)

  return (
    <div className="flex min-w-[210px] max-w-[280px] items-center gap-2.5 py-0.5">
      <audio
        ref={audioRef}
        src={blobUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0) }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
      />

      {/* Bouton play / pause */}
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
          isOwn
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-primary/20 text-primary hover:bg-primary/30'
        }`}
        aria-label={playing ? 'Pause' : 'Lire'}
      >
        {playing ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="h-4 w-4 translate-x-px" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1">
        {/* Forme d'onde cliquable */}
        <div
          className="flex h-8 cursor-pointer items-end gap-px"
          onClick={handleSeek}
          role="slider"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {bars.map((amp, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-colors duration-75 ${
                i < activeBars
                  ? isOwn ? 'bg-white/90' : 'bg-primary'
                  : isOwn ? 'bg-white/30' : 'bg-primary/30'
              }`}
              style={{ height: `${amp * 100}%`, minHeight: 3 }}
            />
          ))}
        </div>

        {/* Durée */}
        <span className={`text-[10px] tabular-nums ${isOwn ? 'text-white/60' : 'text-text-muted'}`}>
          {playing ? fmt(currentTime) : fmt(duration)}
        </span>
      </div>
    </div>
  )
}
