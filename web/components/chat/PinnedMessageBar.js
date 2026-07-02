'use client'

export function PinnedMessageBar({ message, onUnpin, onClick }) {
  if (!message?.payload) return null

  let preview = 'Message épinglé'
  if (message.payload.t === 'text') preview = message.payload.b
  else if (message.payload.t === 'media') preview = `📎 ${message.payload.name}`

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 border-b border-border bg-surface-highlight px-4 py-2 text-left text-xs hover:bg-surface-highlight/70"
    >
      <span className="text-primary">📌</span>
      <span className="flex-1 truncate text-text">{preview}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation()
          onUnpin?.()
        }}
        onKeyDown={(e) => e.key === 'Enter' && onUnpin?.()}
        className="shrink-0 text-text-muted hover:text-text"
      >
        ✕
      </span>
    </button>
  )
}
