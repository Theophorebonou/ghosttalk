'use client'

import { useState, useEffect } from 'react'
import { getStickerPacks, getStickers, searchStickers, getRecentStickers } from '@/lib/api/stickers'

export function StickerPicker({ onSelect, onClose }) {
  const [packs, setPacks] = useState([])
  const [selectedPack, setSelectedPack] = useState(null)
  const [stickers, setStickers] = useState([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [packsData, recentData] = await Promise.all([
          getStickerPacks(),
          getRecentStickers(),
        ])
        setPacks(packsData)
        setRecent(recentData)
        if (packsData.length > 0) {
          setSelectedPack(packsData[0])
          const stickersData = await getStickers(packsData[0].id)
          setStickers(stickersData)
        }
      } catch (err) {
        console.error('Failed to load stickers', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    async function handleSearch() {
      if (!search.trim()) {
        setSearchResults([])
        return
      }
      try {
        const results = await searchStickers(search)
        setSearchResults(results)
      } catch (err) {
        console.error('Search failed', err)
      }
    }
    const timer = setTimeout(handleSearch, 300)
    return () => clearTimeout(timer)
  }, [search])

  async function handlePackClick(pack) {
    setSelectedPack(pack)
    try {
      const stickersData = await getStickers(pack.id)
      setStickers(stickersData)
    } catch (err) {
      console.error('Failed to load stickers', err)
    }
  }

  function handleStickerClick(sticker) {
    onSelect(sticker)
    onClose()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="h-64 w-64 animate-pulse rounded-xl border border-border bg-surface" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Stickers</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un sticker..."
            className="w-full rounded-lg border border-border bg-surface-highlight px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
        </div>

        {search ? (
          <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto">
            {searchResults.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => handleStickerClick(sticker)}
                className="aspect-square rounded-lg bg-surface-highlight p-2 text-4xl transition hover:bg-border"
              >
                {sticker.emoji}
              </button>
            ))}
            {searchResults.length === 0 && (
              <p className="col-span-5 text-center text-sm text-text-muted">
                Aucun résultat
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => handlePackClick(pack)}
                  className={`shrink-0 rounded-full px-3 py-1 text-sm transition ${
                    selectedPack?.id === pack.id
                      ? 'bg-primary text-white'
                      : 'bg-surface-highlight text-text hover:bg-border'
                  }`}
                >
                  {pack.name}
                </button>
              ))}
            </div>

            {recent.length > 0 && !selectedPack && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Récents
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {recent.map((sticker) => (
                    <button
                      key={sticker.id}
                      onClick={() => handleStickerClick(sticker)}
                      className="aspect-square rounded-lg bg-surface-highlight p-2 text-4xl transition hover:bg-border"
                    >
                      {sticker.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedPack && (
              <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto">
                {stickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    onClick={() => handleStickerClick(sticker)}
                    className="aspect-square rounded-lg bg-surface-highlight p-2 text-4xl transition hover:bg-border"
                  >
                    {sticker.emoji}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
