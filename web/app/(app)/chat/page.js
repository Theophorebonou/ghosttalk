'use client'

import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'

export default function ChatPage() {
  const { signOut } = useAuth()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 bg-background">
      <div className="flex max-w-sm flex-col items-center text-center animate-fade-in">
        {/* Icon */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <svg className="h-10 w-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="mb-2 text-xl font-semibold text-text">
          Vos conversations sont chiffrees
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-text-muted">
          Recherchez un utilisateur dans la barre laterale pour commencer une discussion securisee.
        </p>

        <Button variant="ghost" onClick={signOut}>
          Se deconnecter
        </Button>
      </div>
    </div>
  )
}
