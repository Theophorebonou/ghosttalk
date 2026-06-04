'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  archiveConversation,
  blockUser,
  unblockUser,
  muteConversation,
  unmuteConversation,
} from '@/lib/api/conversationSettings'
import { clearConversationHistory } from '@/lib/api/messageActions'
import { MUTE_DURATIONS } from '@/lib/constants/telegram'
import { requestNotificationPermission } from '@/lib/notifications'

export function ChatHeaderMenu({
  conversationId,
  isGroup,
  otherUser,
  isArchived,
  isMuted,
  isBlocked,
  onCleared,
  onArchived,
  onMuted,
  onUnblocked,
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef(null)

  function toggleOpen() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    function onResize() { setOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  async function run(fn) {
    setBusy(true)
    try {
      await fn()
      setOpen(false)
    } catch (err) {
      alert(err.message ?? 'Action impossible')
    } finally {
      setBusy(false)
    }
  }

  const menu = open ? createPortal(
    <>
      {/* Backdrop to close menu */}
      <button
        type="button"
        className="fixed inset-0 z-[90]"
        onClick={() => setOpen(false)}
        aria-label="Fermer"
      />
      {/* Dropdown – fixed so it escapes overflow:hidden */}
      <div
        className="fixed z-[100] min-w-[200px] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-2xl"
        style={{ top: menuPos.top, right: menuPos.right }}
      >
            <button
              type="button"
              disabled={busy}
              className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={() =>
                run(async () => {
                  await requestNotificationPermission()
                })
              }
            >
              Notifications (voir aussi Paramètres)
            </button>
            <div className="my-1 border-t border-zinc-800" />
            {!isMuted ? (
              <>
                <p className="px-4 py-1 text-[10px] uppercase text-zinc-500">Silencieux pour</p>
                {MUTE_DURATIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    disabled={busy}
                    className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                    onClick={() =>
                      run(async () => {
                        const until = d.ms
                          ? new Date(Date.now() + d.ms).toISOString()
                          : new Date('2099-01-01').toISOString()
                        await muteConversation(conversationId, until)
                        onMuted?.()
                      })
                    }
                  >
                    {d.label}
                  </button>
                ))}
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                onClick={() => run(async () => {
                  await unmuteConversation(conversationId)
                  onMuted?.()
                })}
              >
                Réactiver le son
              </button>
            )}
            <div className="my-1 border-t border-zinc-800" />
            <button
              type="button"
              disabled={busy}
              className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={() =>
                run(async () => {
                  await archiveConversation(conversationId, !isArchived)
                  onArchived?.()
                  router.push('/chat')
                })
              }
            >
              {isArchived ? 'Désarchiver' : 'Archiver'}
            </button>
            <button
              type="button"
              disabled={busy}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-800"
              onClick={() => {
                if (!confirm('Effacer tout l’historique de cette conversation ?')) return
                run(async () => {
                  await clearConversationHistory(conversationId)
                  onCleared?.()
                })
              }}
            >
              Effacer l&apos;historique
            </button>
            {!isGroup && otherUser && (
              <>
                {isBlocked ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-zinc-800"
                    onClick={() => {
                      if (!confirm(`Débloquer @${otherUser.username} ?`)) return
                      run(async () => {
                        await unblockUser(otherUser.id)
                        onUnblocked?.()
                      })
                    }}
                  >
                    Débloquer @{otherUser.username}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-800"
                    onClick={() => {
                      if (!confirm(`Bloquer @${otherUser.username} ?`)) return
                      run(async () => {
                        await blockUser(otherUser.id)
                        router.push('/chat')
                      })
                    }}
                  >
                    Bloquer @{otherUser.username}
                  </button>
                )}
              </>
            )}
      </div>
    </>,
    document.body
  ) : null

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        aria-label="Options"
      >
        ⋮
      </button>
      {menu}
    </div>
  )
}
