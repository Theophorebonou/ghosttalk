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
        <div className="h-64 w-64 animate-pulse rounded-xl border border-zinc-700 bg-zinc-900" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Stickers</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300"
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
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
          />
        </div>

        {search ? (
          <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto">
            {searchResults.map((sticker) => (
              <button
                key={sticker.id}
                onClick={() => handleStickerClick(sticker)}
                className="aspect-square rounded-lg bg-zinc-800 p-2 text-4xl transition hover:bg-zinc-700"
              >
                {sticker.emoji}
              </button>
            ))}
            {searchResults.length === 0 && (
              <p className="col-span-5 text-center text-sm text-zinc-500">
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
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {pack.name}
                </button>
              ))}
            </div>

            {recent.length > 0 && !selectedPack && (
              <div className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Récents
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {recent.map((sticker) => (
                    <button
                      key={sticker.id}
                      onClick={() => handleStickerClick(sticker)}
                      className="aspect-square rounded-lg bg-zinc-800 p-2 text-4xl transition hover:bg-zinc-700"
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
                    className="aspect-square rounded-lg bg-zinc-800 p-2 text-4xl transition hover:bg-zinc-700"
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
