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
        className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} my-1 px-4`}
      >
        <div className="max-w-[75%] rounded-lg bg-surface-highlight px-3 py-2 opacity-60">
          <p className="text-xs text-text-muted">Dechiffrement...</p>
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
      className={`group flex w-full ${isOwn ? 'justify-end' : 'justify-start'} my-0.5 px-4 ${
        highlight ? 'bg-primary/10' : ''
      }`}
    >
      <div className={`relative flex max-w-[75%] flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Message bubble */}
        <div
          className={`relative rounded-lg px-3 py-2 shadow-sm ${
            isOwn
              ? 'bg-message-out text-white bubble-tail-out'
              : 'bg-message-in text-text bubble-tail-in'
          }`}
        >
          {/* Forwarded indicator */}
          {message.payload?.forwarded && (
            <p className="mb-1 text-[11px] italic text-white/70">
              Transfere de {message.payload.forwarded.from}
            </p>
          )}

          {/* Story reply indicator */}
          {message.payload?.storyReply && (
            <div className="mb-2 rounded border-l-2 border-primary bg-black/20 px-2 py-1 text-xs">
              <p className="font-medium text-primary">
                Reponse au statut de @{message.payload.storyReply.authorUsername}
              </p>
            </div>
          )}

          {/* Reply preview */}
          {message.payload?.replyTo && (
            <button
              type="button"
              onClick={() => onScrollToReply?.(message.payload.replyTo.id)}
              className={`mb-2 w-full rounded border-l-2 px-2 py-1 text-left text-xs transition ${
                isOwn 
                  ? 'border-white/40 bg-black/20 hover:bg-black/30' 
                  : 'border-primary bg-surface-highlight hover:bg-surface'
              }`}
            >
              <p className={`font-semibold ${isOwn ? 'text-white/90' : 'text-primary'}`}>
                {message.payload.replyTo.senderName}
              </p>
              <p className={`truncate ${isOwn ? 'text-white/70' : 'text-text-muted'}`}>
                {message.payload.replyTo.snippet}
              </p>
            </button>
          )}

          {/* Group sender name */}
          {isGroup && !isOwn && senderName && (
            <p className="mb-1 text-xs font-semibold text-primary">@{senderName}</p>
          )}

          {/* Message content */}
          <MessageContent payload={message.payload} sharedKey={sharedKey} isOwn={isOwn} />

          {/* Footer with time and status */}
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <EphemeralBadge message={message} />
            {message.edited_at && (
              <span className={`text-[10px] ${isOwn ? 'text-white/50' : 'text-text-muted'}`}>
                modifie
              </span>
            )}
            <span className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-text-muted'}`}>
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
              <span className="text-[10px] text-white/60">
                Lu {message.message_reads.length}
              </span>
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(reactionGroups).map(([emoji, list]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact?.(message, emoji)}
                className="rounded-full bg-surface-highlight px-2 py-0.5 text-xs shadow-sm transition hover:bg-surface"
              >
                {emoji} {list.length > 1 ? list.length : ''}
              </button>
            ))}
          </div>
        )}

        {/* Quick reactions picker */}
        {showReactions && (
          <div
            className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-10 z-20 flex gap-1 rounded-full bg-surface px-2 py-1 shadow-lg border border-border animate-fade-in`}
          >
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                className="text-lg hover:scale-125 transition-transform"
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

      {/* Action buttons */}
      <div className={`flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${isOwn ? 'order-first mr-1' : 'ml-1'}`}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-surface-highlight hover:text-text transition"
          title="Actions"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onReply}
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-surface-highlight hover:text-text transition"
          title="Repondre"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setShowReactions((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-surface-highlight hover:text-text transition"
          title="Reagir"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Context menu */}
      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className={`fixed z-40 min-w-[160px] rounded-lg border border-border bg-surface py-1 shadow-xl animate-fade-in ${
              isOwn ? 'right-16' : 'left-16'
            }`}
            style={{ top: '40%' }}
          >
            {message.payload?.t === 'text' && (
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-highlight transition"
                onClick={() => {
                  navigator.clipboard?.writeText(message.payload.b)
                  setMenuOpen(false)
                }}
              >
                <svg className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copier
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-highlight transition"
                onClick={() => {
                  onEdit?.(message)
                  setMenuOpen(false)
                }}
              >
                <svg className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modifier
              </button>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-highlight transition"
              onClick={() => {
                onForward?.(message)
                setMenuOpen(false)
              }}
            >
              <svg className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Transferer
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-highlight transition"
              onClick={() => {
                onPin?.(message)
                setMenuOpen(false)
              }}
            >
              <svg className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Epingler
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-highlight transition"
              onClick={() => {
                onDeleteForMe?.(message)
                setMenuOpen(false)
              }}
            >
              <svg className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Supprimer pour moi
            </button>
            {(isOwn || isGroup) && (
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-error hover:bg-surface-highlight transition"
                onClick={() => {
                  onDeleteForAll?.(message)
                  setMenuOpen(false)
                }}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Supprimer pour tous
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
