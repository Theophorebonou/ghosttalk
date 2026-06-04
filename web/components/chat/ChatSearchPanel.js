'use client'

import { useMemo, useState } from 'react'

export function ChatSearchPanel({ messages, onClose, onSelectMessage }) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return messages.filter((m) => {
      if (m.payload?.t === 'text' && m.payload.b?.toLowerCase().includes(q)) return true
      if (m.payload?.forwarded?.from?.toLowerCase().includes(q)) return true
      return false
    })
  }, [messages, query])

  return (
    <div className="border-b border-violet-500/10 bg-zinc-900/90 px-4 py-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher dans la conversation…"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
          autoFocus
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 text-sm text-zinc-400 hover:bg-zinc-800"
        >
          ✕
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-y-auto">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelectMessage(m.id)}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800"
              >
                <span className="text-zinc-500">
                  {new Date(m.created_at).toLocaleString([], {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="ml-2 truncate">
                  {m.payload?.t === 'text' ? m.payload.b : 'Média'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.length >= 2 && results.length === 0 && (
        <p className="mt-2 text-xs text-zinc-500">Aucun résultat</p>
      )}
    </div>
  )
}
