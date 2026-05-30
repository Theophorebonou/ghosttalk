'use client'

import { MessageContent } from './MessageContent'

export function MessageBubble({ message, isOwn, senderName, isGroup, sharedKey }) {
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
      className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} my-2`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 sm:max-w-[70%] ${
          isOwn
            ? 'rounded-tr-sm bg-violet-600 text-white'
            : 'rounded-tl-sm bg-zinc-800 text-zinc-200'
        }`}
      >
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
    </div>
  )
}
