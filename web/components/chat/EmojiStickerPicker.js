'use client'

import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Emoji data (curated, no external dep)
// ---------------------------------------------------------------------------
const EMOJI_CATEGORIES = [
  {
    id: 'smileys', label: '😀', name: 'Visages',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😚','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','🤖'],
  },
  {
    id: 'people', label: '🤝', name: 'Gestes',
    emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🙏','🫂','💅','🦵','🦶','👂','👃','🧠','👁️','👅','🫀','🫁'],
  },
  {
    id: 'nature', label: '🌿', name: 'Nature',
    emojis: ['🌹','🌸','🌺','🌻','🌼','🌷','🌱','🌿','🍀','🍁','🍃','🎋','🎍','🍄','🪸','🌊','🌈','⚡','🔥','❄️','🌙','☀️','⭐','🌟','💫','✨','☁️','⛅','🌪️','🌊','🌋','🐶','🐱','🦊','🐺','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🦋','🐝','🐛','🐌','🦎','🐍','🐢','🦅','🦜','🦚','🐙','🦈','🐬','🐳','🦒','🦓','🦏'],
  },
  {
    id: 'food', label: '🍔', name: 'Nourriture',
    emojis: ['🍎','🍊','🍋','🍇','🍓','🍑','🍒','🍍','🥭','🍌','🫐','🍉','🍈','🍐','🍏','🥝','🍅','🥥','🥑','🍆','🥕','🌽','🌶️','🫑','🧄','🧅','🍄','🥦','🥬','🥒','🫒','🫘','🌰','🍞','🥐','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🍣','🍤','🍙','🍚','🍜','🍝','🍛','🍲','🥘','🫕','🍱','🥗','🍿','🧂','🍔','🍟','🌮','🌯','🫔','🥙','🧆','🥪','🍕','🥫','🫙','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','☕','🍵','🧋','🥤','🍺','🥂'],
  },
  {
    id: 'activities', label: '⚽', name: 'Sports',
    emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🏸','🥊','🥋','⛷️','🏂','🏄','🚣','🧗','🚴','🏇','🏊','🤽','🤸','🤼','🏋️','🤺','⛹️','🏌️','🏹','🎣','🤿','🎽','🎿','🛷','🛹','🥌','🎯','🎮','🎲','🎭','🎨','🎬','🎤','🎧','🎸','🎹','🎻','🥁','🎺','🪗','🪕','🎷','🪘'],
  },
  {
    id: 'symbols', label: '❤️', name: 'Symboles',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💗','💓','💞','💕','💟','❣️','💔','❤️‍🔥','💯','✅','❌','⭕','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','▪️','▫️','◾','◽','◼️','◻️','⬛','⬜','🏁','🚩','🎌','🏴','🏳️','🔑','🗝️','🔒','🔓','🔔','🔕','📢','📣','🔇','🔈','🔉','🔊','📳','📴','📵','📶','🚫','⛔','✨','🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','🎖️','🎗️','🎀','🎟️'],
  },
]

// ---------------------------------------------------------------------------
// Sticker packs (large emoji as stickers)
// ---------------------------------------------------------------------------
export const STICKER_PACKS = [
  {
    id: 'ghost', name: 'Fantômes', icon: '👻',
    stickers: ['👻','💀','☠️','🕷️','🕸️','🔮','🌑','🦇','🎃','🪄','🖤','🌙','⚰️','🪦','👁️','🧿','😈','👿','🌪️','🫀'],
  },
  {
    id: 'vibes', name: 'Vibes', icon: '🔥',
    stickers: ['🔥','💯','👀','✅','❤️','💔','👋','🫡','🙏','👏','💪','👑','💎','🗣️','😤','🤝','🫶','🎯','💀','🗿'],
  },
  {
    id: 'emotions', name: 'Émotions', icon: '😂',
    stickers: ['😂','😭','😍','🥺','😤','😠','🤩','🥰','😎','🤔','😴','🤯','😱','🤮','🙃','🥹','🫠','💅','🐸','🫨'],
  },
  {
    id: 'party', name: 'Fête', icon: '🎉',
    stickers: ['🎉','🎊','🥂','🍾','🎈','🎁','🎂','🎆','🎇','✨','🎤','🎵','🎶','💃','🕺','🪩','🎠','🪅','🎡','🎢'],
  },
  {
    id: 'animals', name: 'Animaux', icon: '🐶',
    stickers: ['🐶','🐱','🦊','🐺','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🦋','🐝','🐙','🦈','🦅','🦜','🐬','🦒'],
  },
]

// ---------------------------------------------------------------------------
// Recent stickers in localStorage
// ---------------------------------------------------------------------------
const RECENT_KEY = 'gt_recent_stickers'

function getRecentStickers() {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

function saveRecentSticker(emoji) {
  const prev = getRecentStickers().filter((e) => e !== emoji)
  const next = [emoji, ...prev].slice(0, 20)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmojiStickerPicker({ onEmojiSelect, onStickerSelect, onClose, anchorRef }) {
  const [tab, setTab]           = useState('emoji')
  const [emojiCat, setEmojiCat] = useState('smileys')
  const [stickerPack, setPack]  = useState('ghost')
  const [search, setSearch]     = useState('')
  const [recent, setRecent]     = useState([])
  const panelRef = useRef(null)

  useEffect(() => { setRecent(getRecentStickers()) }, [])

  // Close on outside click
  useEffect(() => {
    function onDown(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        anchorRef?.current && !anchorRef.current.contains(e.target)
      ) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose, anchorRef])

  function handleEmoji(emoji) {
    onEmojiSelect(emoji)
  }

  function handleSticker(emoji) {
    saveRecentSticker(emoji)
    setRecent(getRecentStickers())
    onStickerSelect(emoji)
    onClose()
  }

  // Filtered emoji search across all categories
  const searchResults = search.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) =>
        e.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 60)
    : null

  const activeEmojis = searchResults ?? EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.emojis ?? []
  const activeStickerPack = STICKER_PACKS.find((p) => p.id === stickerPack)

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-80 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
    >
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('emoji')}
          className={`flex-1 py-2.5 text-xs font-semibold transition ${tab === 'emoji' ? 'border-b-2 border-primary text-primary' : 'text-text-muted hover:text-text'}`}
        >
          Emoji
        </button>
        <button
          onClick={() => setTab('sticker')}
          className={`flex-1 py-2.5 text-xs font-semibold transition ${tab === 'sticker' ? 'border-b-2 border-primary text-primary' : 'text-text-muted hover:text-text'}`}
        >
          Stickers
        </button>
        <button
          onClick={onClose}
          className="px-3 text-text-muted hover:text-text"
          aria-label="Fermer"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {tab === 'emoji' ? (
        <div className="flex flex-col">
          {/* Search */}
          <div className="px-3 pt-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-lg border border-border bg-surface-highlight px-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </div>

          {/* Category tabs */}
          {!search && (
            <div className="flex gap-0.5 overflow-x-auto px-2 pt-2 scrollbar-none">
              {EMOJI_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setEmojiCat(c.id)}
                  title={c.name}
                  className={`shrink-0 rounded-lg px-2 py-1 text-base transition ${emojiCat === c.id ? 'bg-primary/20' : 'hover:bg-surface-highlight'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-0.5 overflow-y-auto px-2 py-2" style={{ maxHeight: '220px' }}>
            {activeEmojis.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => handleEmoji(emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-surface-highlight active:scale-90"
              >
                {emoji}
              </button>
            ))}
            {searchResults?.length === 0 && (
              <p className="col-span-8 py-6 text-center text-xs text-text-muted">Aucun résultat</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Pack tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 scrollbar-none">
            {recent.length > 0 && (
              <button
                onClick={() => setPack('recent')}
                title="Récents"
                className={`shrink-0 rounded-lg px-2 py-1 text-lg transition ${stickerPack === 'recent' ? 'bg-primary/20' : 'hover:bg-surface-highlight'}`}
              >
                🕐
              </button>
            )}
            {STICKER_PACKS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPack(p.id)}
                title={p.name}
                className={`shrink-0 rounded-lg px-2 py-1 text-lg transition ${stickerPack === p.id ? 'bg-primary/20' : 'hover:bg-surface-highlight'}`}
              >
                {p.icon}
              </button>
            ))}
          </div>

          {/* Pack name */}
          <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {stickerPack === 'recent' ? 'Récents' : (activeStickerPack?.name ?? '')}
          </p>

          {/* Sticker grid */}
          <div className="grid grid-cols-5 gap-1 overflow-y-auto p-2" style={{ maxHeight: '200px' }}>
            {(stickerPack === 'recent' ? recent : activeStickerPack?.stickers ?? []).map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => handleSticker(emoji)}
                className="flex h-14 w-full items-center justify-center rounded-xl text-4xl transition hover:bg-surface-highlight active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
