'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'

const CROP_PX   = 280   // taille de l'aperçu circulaire
const OUTPUT_PX = 400   // taille finale exportée

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

function maxOffsetForScale(nw, nh, bs, us) {
  const ts = bs * us
  return {
    x: Math.max(0, (nw * ts) / 2 - CROP_PX / 2),
    y: Math.max(0, (nh * ts) / 2 - CROP_PX / 2),
  }
}

export function AvatarCropModal({ file, onConfirm, onCancel }) {
  const [src, setSrc]               = useState(null)
  const [nat, setNat]               = useState({ w: 0, h: 0 })
  const [baseScale, setBaseScale]   = useState(1)
  const [zoom, setZoom]             = useState(1)
  const [offset, setOffset]         = useState({ x: 0, y: 0 })
  const [dragging, setDragging]     = useState(false)
  const [exporting, setExporting]   = useState(false)
  const drag   = useRef({ sx: 0, sy: 0, ox: 0, oy: 0 })
  const imgRef = useRef(null)
  const cropRef = useRef(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Wheel zoom — doit être non-passive pour pouvoir appeler preventDefault
  useEffect(() => {
    const el = cropRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      setZoom((prev) => {
        const next = clamp(prev - e.deltaY * 0.001, 1, 3)
        setOffset((o) => {
          const m = maxOffsetForScale(nat.w, nat.h, baseScale, next)
          return { x: clamp(o.x, -m.x, m.x), y: clamp(o.y, -m.y, m.y) }
        })
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [nat, baseScale])

  function handleLoad(e) {
    const nw = e.target.naturalWidth
    const nh = e.target.naturalHeight
    setNat({ w: nw, h: nh })
    setBaseScale(CROP_PX / Math.min(nw, nh))
  }

  function clientPos(e) {
    return e.touches?.[0]
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY }
  }

  function onDragStart(e) {
    e.preventDefault()
    const p = clientPos(e)
    drag.current = { sx: p.x, sy: p.y, ox: offset.x, oy: offset.y }
    setDragging(true)
  }

  function onDragMove(e) {
    if (!dragging) return
    e.preventDefault()
    const p = clientPos(e)
    const nx = drag.current.ox + p.x - drag.current.sx
    const ny = drag.current.oy + p.y - drag.current.sy
    const m = maxOffsetForScale(nat.w, nat.h, baseScale, zoom)
    setOffset({ x: clamp(nx, -m.x, m.x), y: clamp(ny, -m.y, m.y) })
  }

  function onDragEnd() { setDragging(false) }

  function handleZoomSlider(e) {
    const next = parseFloat(e.target.value)
    const m = maxOffsetForScale(nat.w, nat.h, baseScale, next)
    setZoom(next)
    setOffset((o) => ({ x: clamp(o.x, -m.x, m.x), y: clamp(o.y, -m.y, m.y) }))
  }

  async function handleConfirm() {
    if (!imgRef.current || !nat.w) return
    setExporting(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width  = OUTPUT_PX
      canvas.height = OUTPUT_PX
      const ctx = canvas.getContext('2d')

      // Clip circulaire
      ctx.beginPath()
      ctx.arc(OUTPUT_PX / 2, OUTPUT_PX / 2, OUTPUT_PX / 2, 0, Math.PI * 2)
      ctx.clip()

      // Calcul du rect source dans l'image naturelle
      const ts = baseScale * zoom
      const srcX = nat.w / 2 - (CROP_PX / 2 + offset.x) / ts
      const srcY = nat.h / 2 - (CROP_PX / 2 + offset.y) / ts
      const srcW = CROP_PX / ts
      const srcH = CROP_PX / ts

      ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, OUTPUT_PX, OUTPUT_PX)

      canvas.toBlob(
        (blob) => { setExporting(false); if (blob) onConfirm(blob) },
        'image/jpeg',
        0.88,
      )
    } catch {
      setExporting(false)
    }
  }

  const ts = baseScale * zoom

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h3 className="mb-4 text-center text-base font-semibold text-text">
          Ajuster la photo
        </h3>

        {/* Zone de crop circulaire */}
        <div className="mb-2 flex justify-center">
          <div
            ref={cropRef}
            className={`relative overflow-hidden rounded-full ring-2 ring-primary/50 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ width: CROP_PX, height: CROP_PX }}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
            onTouchStart={onDragStart}
            onTouchMove={onDragMove}
            onTouchEnd={onDragEnd}
          >
            {src && (
              <img
                ref={imgRef}
                src={src}
                alt=""
                onLoad={handleLoad}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width:  nat.w * baseScale,
                  height: nat.h * baseScale,
                  maxWidth: 'none',
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                  transformOrigin: 'center',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>

        {/* Slider zoom */}
        <div className="mb-1 flex items-center gap-3 px-1">
          <svg className="h-4 w-4 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35M8 11h6" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="range" min="1" max="3" step="0.02"
            value={zoom}
            onChange={handleZoomSlider}
            className="w-full accent-primary"
          />
          <svg className="h-4 w-4 shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="mb-5 text-center text-[11px] text-text-muted">
          Glissez pour repositionner · molette ou curseur pour zoomer
        </p>

        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancel} disabled={exporting}>
            Annuler
          </Button>
          <Button type="button" className="flex-1" onClick={handleConfirm} disabled={exporting || !src}>
            {exporting ? 'Traitement…' : 'Confirmer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
