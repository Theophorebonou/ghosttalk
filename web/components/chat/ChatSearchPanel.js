'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const SNIPPET_BEFORE = 30
const SNIPPET_AFTER  = 60

function getSnippet(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return { before: text.slice(0, 60), match: '', after: text.length > 60 ? '…' : '' }
  const start = Math.max(0, idx - SNIPPET_BEFORE)
  const end   = Math.min(text.length, idx + query.length + SNIPPET_AFTER)
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, idx),
    match:  text.slice(idx, idx + query.length),
    after:  text.slice(idx + query.length, end) + (end < text.length ? '…' : ''),
  }
}

export function ChatSearchPanel({ messages, onClose, onSelectMessage, currentUserId, otherUserName }) {
  const [query, setQuery]           = useState('')
  const [selectedIdx, setSelected]  = useState(0)
  const inputRef = useRef(null)
  const listRef  = useRef(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return messages.filter((m) => {
      if (m.payload?.t === 'text'  && m.payload.b?.toLowerCase().includes(q))    return true
      if (m.payload?.t === 'media' && m.payload.name?.toLowerCase().includes(q)) return true
      if (m.payload?.forwarded?.from?.toLowerCase().includes(q))                 return true
      return false
    })
  }, [messages, query])

  useEffect(() => { setSelected(0) }, [results])

  // Scroll selected item into view
  useEffect(() => {
    listRef.current?.children[selectedIdx]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  function handleKeyDown(e) {
    if (e.key === 'Escape')    { onClose(); return }
    if (e.key === 'Enter')     { if (results[selectedIdx]) { onSelectMessage(results[selectedIdx].id); onClose() } return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected((i) => Math.max(i - 1, 0)) }
  }

  return (
    <div className="border-b border-border bg-surface px-4 py-3 animate-fade-in">
      {/* Input row */}
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 shrink-0 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher dans la conversation…"
          className="flex-1 bg-transparent py-1 text-sm text-text placeholder:text-text-muted focus:outline-none"
          autoFocus
        />
        {query.length >= 2 && (
          <span className="shrink-0 text-xs text-text-muted">
            {results.length} résultat{results.length !== 1 ? 's' : ''}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-1 shrink-0 rounded p-1 text-text-muted transition hover:bg-surface-highlight hover:text-text"
          aria-label="Fermer"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <ul ref={listRef} className="mt-2 max-h-56 divide-y divide-border/40 overflow-y-auto rounded-lg border border-border">
          {results.map((m, i) => {
            const isOwn    = m.sender_id === currentUserId
            const sender   = isOwn ? 'Vous' : (otherUserName ? `@${otherUserName}` : 'Autre')
            const isText   = m.payload?.t === 'text'
            const rawText  = isText ? m.payload.b : m.payload?.name ?? ''
            const snippet  = isText && rawText ? getSnippet(rawText, query) : null

            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => { onSelectMessage(m.id); onClose() }}
                  className={`w-full px-3 py-2 text-left transition ${
                    i === selectedIdx ? 'bg-primary/10' : 'hover:bg-surface-highlight'
                  }`}
                >
                  <div className="mb-0.5 flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold text-primary">{sender}</span>
                    <span className="text-[10px] text-text-muted">
                      {new Date(m.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {snippet ? (
                    <p className="text-xs text-text-muted">
                      {snippet.before}
                      <mark className="rounded-sm bg-primary/25 font-medium text-text not-italic">
                        {snippet.match}
                      </mark>
                      {snippet.after}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 text-xs text-text-muted">
                      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {rawText || 'Média'}
                    </p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Empty state */}
      {query.length >= 2 && results.length === 0 && (
        <p className="mt-3 pb-1 text-center text-xs text-text-muted">
          Aucun résultat pour «&nbsp;{query}&nbsp;»
        </p>
      )}

      {/* Hint */}
      {query.length < 2 && (
        <p className="mt-2 pb-0.5 text-center text-[11px] text-text-muted">
          ↑↓ naviguer · Entrée sélectionner · Échap fermer
        </p>
      )}
    </div>
  )
}
