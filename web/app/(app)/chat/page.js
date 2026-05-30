'use client'

import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export default function ChatPage() {
  const { signOut } = useAuth()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8">
      <div className="ghost-panel-enter flex max-w-sm flex-col items-center text-center">
        <div className="ghost-logo-ring mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/5">
          <span className="text-3xl ghost-logo-float" aria-hidden>
            👻
          </span>
        </div>
        <h1 className="ghost-stagger-2 mb-2 text-xl font-bold text-zinc-100">
          Vos conversations sont chiffrées
        </h1>
        <p className="ghost-stagger-3 mb-8 text-sm leading-relaxed text-zinc-400">
          Recherchez un pseudo dans la barre latérale pour entamer une discussion
          sécurisée. L&apos;ombre veille sur vos messages.
        </p>

        <Button variant="ghost" className="ghost-stagger-4" onClick={signOut}>
          Se déconnecter et effacer les clés
        </Button>
      </div>
    </div>
  )
}
