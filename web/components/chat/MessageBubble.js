'use client'

import { useState } from 'react'
import { MessageContent } from './MessageContent'
import { EphemeralBadge } from './EphemeralBadge'
import { ReadReceiptIcon, getReadStatusForMessage } from './ReadReceiptIcon'
import { QUICK_REACTIONS } from '@/lib/constants/telegram'

export function MessageBubble({
  message,
  isOwn,
  senderName,
  isGroup,
  sharedKey,
  onReply,
  onEdit,
  onDeleteForAll,
  onDeleteForMe,
  onForward,
  onPin,
  onReact,
  onScrollToReply,
  currentUserId,
  otherParticipantIds,
  isDirect,
  messageRef,
  highlight,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showReactions, setShowReactions] = useState(false)

  if (!message.payload) {
    return (
      <div
        ref={messageRef}
        className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} my-2`}
      >
        <div className="max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-2 opacity-50 sm:max-w-[70%]">
          <p className="text-xs italic text-zinc-500">Déchiffrement…</p>
        </div>
      </div>
    )
  }

  const reactions = message.message_reactions ?? []
  const reactionGroups = reactions.reduce((acc, r) => {
    const e = r.emoji
    if (!acc[e]) acc[e] = []
    acc[e].push(r)
    return acc
  }, {})

  const canEdit = isOwn && message.payload?.t === 'text' && !message.ephemeral_kind

  return (
    <div
      ref={messageRef}
      id={`msg-${message.id}`}
      className={`group flex w-full ${isOwn ? 'justify-end' : 'justify-start'} my-2 items-end gap-1 ${
        highlight ? 'rounded-lg ring-2 ring-violet-500/50' : ''
      }`}
    >
      <div className="relative flex max-w-[88%] flex-col sm:max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-2 ${
            isOwn
              ? 'rounded-tr-sm bg-violet-600 text-white'
              : 'rounded-tl-sm bg-zinc-800 text-zinc-200'
          }`}
        >
          {message.payload?.forwarded && (
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-violet-200/80">
              Transféré de {message.payload.forwarded.from}
            </p>
          )}

          {message.payload?.storyReply && (
            <div className="mb-2 rounded-r border-l-2 border-violet-300/50 bg-black/15 p-1.5 text-xs opacity-90">
              <p className="font-semibold text-violet-200/90">
                Réponse au statut de @{message.payload.storyReply.authorUsername}
              </p>
            </div>
          )}

          {message.payload?.replyTo && (
            <button
              type="button"
              onClick={() => onScrollToReply?.(message.payload.replyTo.id)}
              className="mb-2 w-full rounded-r border-l-2 border-white/30 bg-black/10 p-1.5 text-left text-xs opacity-90 hover:bg-black/20"
            >
              <p className="font-semibold text-white/90">{message.payload.replyTo.senderName}</p>
              <p className="truncate opacity-80">{message.payload.replyTo.snippet}</p>
            </button>
          )}

          {isGroup && !isOwn && senderName && (
            <p className="mb-1 text-xs font-semibold text-violet-400">@{senderName}</p>
          )}

          <MessageContent payload={message.payload} sharedKey={sharedKey} isOwn={isOwn} />

          <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
            <EphemeralBadge message={message} />
            {message.edited_at && (
              <span className="text-[10px] italic opacity-50">modifié</span>
            )}
            <span className="text-[10px] opacity-60">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {isOwn && isDirect && currentUserId && otherParticipantIds?.length > 0 && (
              <ReadReceiptIcon
                status={getReadStatusForMessage(
                  message,
                  currentUserId,
                  otherParticipantIds
                )}
              />
            )}
            {isOwn && isGroup && message.message_reads?.length > 0 && (
              <span className="text-[10px] text-sky-300/90">
                Lu {message.message_reads.length}×
              </span>
            )}
          </div>
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(reactionGroups).map(([emoji, list]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact?.(message, emoji)}
                className="rounded-full border border-zinc-700 bg-zinc-900/90 px-2 py-0.5 text-xs hover:bg-zinc-800"
              >
                {emoji} {list.length > 1 ? list.length : ''}
              </button>
            ))}
          </div>
        )}

        {showReactions && (
          <div
            className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-10 z-20 flex gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 shadow-lg`}
          >
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                className="text-base hover:scale-125 transition"
                onClick={() => {
                  onReact?.(message, e)
                  setShowReactions(false)
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          title="Actions"
        >
          ⋮
        </button>
        <button
          type="button"
          onClick={onReply}
          className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          title="Répondre"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={() => setShowReactions((v) => !v)}
          className="rounded-full p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          title="Réagir"
        >
          😊
        </button>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className={`fixed z-40 min-w-[160px] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl ${
              isOwn ? 'right-4' : 'left-4'
            }`}
            style={{ top: '40%' }}
          >
            {message.payload?.t === 'text' && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                onClick={() => {
                  navigator.clipboard?.writeText(message.payload.b)
                  setMenuOpen(false)
                }}
              >
                Copier
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                onClick={() => {
                  onEdit?.(message)
                  setMenuOpen(false)
                }}
              >
                Modifier
              </button>
            )}
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                onForward?.(message)
                setMenuOpen(false)
              }}
            >
              Transférer
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                onPin?.(message)
                setMenuOpen(false)
              }}
            >
              Épingler
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                onDeleteForMe?.(message)
                setMenuOpen(false)
              }}
            >
              Supprimer pour moi
            </button>
            {(isOwn || isGroup) && (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800"
                onClick={() => {
                  onDeleteForAll?.(message)
                  setMenuOpen(false)
                }}
              >
                Supprimer pour tous
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
