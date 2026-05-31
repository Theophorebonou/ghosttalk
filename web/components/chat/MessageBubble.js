'use client'

import { MessageContent } from './MessageContent'

export function MessageBubble({ message, isOwn, senderName, isGroup, sharedKey, onReply }) {
  if (!message.payload) {
    return (
      <div
        className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} my-2`}
      >
        <div className="max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2 opacity-50 sm:max-w-[70%]">
          <p className="text-xs italic text-zinc-500">Déchiffrement…</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group flex w-full ${isOwn ? 'justify-end' : 'justify-start'} my-2 items-end gap-2`}
    >
      {isOwn && (
        <button
          onClick={onReply}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-full shrink-0"
          title="Répondre"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
        </button>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 sm:max-w-[70%] ${
          isOwn
            ? 'rounded-tr-sm bg-violet-600 text-white'
            : 'rounded-tl-sm bg-zinc-800 text-zinc-200'
        }`}
      >
        {message.payload?.replyTo && (
          <div onClick={() => {
            // Optional: scroll to the message or visually indicate it.
            // For now, just display it beautifully.
          }} className="mb-2 pl-2 border-l-2 border-white/30 bg-black/10 rounded-r p-1.5 text-xs opacity-90 cursor-default">
            <p className="font-semibold text-white/90">{message.payload.replyTo.senderName}</p>
            <p className="truncate opacity-80">{message.payload.replyTo.snippet}</p>
          </div>
        )}

        {isGroup && !isOwn && senderName && (
          <p className="mb-1 text-xs font-semibold text-violet-400">@{senderName}</p>
        )}
        <MessageContent payload={message.payload} sharedKey={sharedKey} isOwn={isOwn} />
        <span className="mt-1 block text-right text-[10px] opacity-60">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {!isOwn && (
        <button
          onClick={onReply}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-full shrink-0"
          title="Répondre"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
        </button>
      )}
    </div>
  )
}
