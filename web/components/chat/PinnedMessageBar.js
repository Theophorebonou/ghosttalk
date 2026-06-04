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
      className="flex w-full items-center gap-2 border-b border-violet-500/20 bg-violet-950/30 px-4 py-2 text-left text-xs hover:bg-violet-950/50"
    >
      <span className="text-violet-400">📌</span>
      <span className="flex-1 truncate text-zinc-300">{preview}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation()
          onUnpin?.()
        }}
        onKeyDown={(e) => e.key === 'Enter' && onUnpin?.()}
        className="shrink-0 text-zinc-500 hover:text-zinc-300"
      >
        ✕
      </span>
    </button>
  )
}
