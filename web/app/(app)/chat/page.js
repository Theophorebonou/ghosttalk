'use client'

import { useAuth } from '@/hooks/useAuth'

export default function ChatPage() {
  const { signOut } = useAuth()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center border-b-[6px] border-primary bg-surface-highlight/60 px-8">
      <div className="flex max-w-md flex-col items-center text-center animate-fade-in">
        {/* Illustration */}
        <svg className="mb-8 h-56 w-72 text-text-muted/40" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 320 220">
          {/* Laptop */}
          <rect x="60" y="30" width="200" height="130" rx="10" />
          <path d="M40 160h240l16 24a6 6 0 01-5 9H29a6 6 0 01-5-9l16-24z" />
          {/* Screen content: chat bubbles */}
          <rect x="80" y="52" width="90" height="24" rx="12" className="text-primary/50" stroke="currentColor" />
          <rect x="150" y="88" width="90" height="24" rx="12" />
          <rect x="80" y="124" width="70" height="24" rx="12" className="text-primary/50" stroke="currentColor" />
          {/* Phone */}
          <rect x="252" y="96" width="44" height="84" rx="8" fill="var(--surface)" />
          <path d="M268 170h12" />
        </svg>

        <h1 className="mb-3 text-3xl font-light text-text">GhostTalk Web</h1>
        <p className="text-sm leading-relaxed text-text-muted">
          Envoyez et recevez des messages chiffrés de bout en bout.
          <br />
          Recherchez un utilisateur dans le panneau de gauche pour commencer une discussion.
        </p>

        <button
          type="button"
          onClick={signOut}
          className="mt-8 text-xs text-text-muted underline-offset-2 transition hover:text-text hover:underline"
        >
          Se déconnecter
        </button>
      </div>

      {/* Note chiffrement — bas de page WhatsApp */}
      <div className="absolute bottom-8 flex items-center gap-1.5 text-xs text-text-muted">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Vos messages personnels sont chiffrés de bout en bout</span>
      </div>
    </div>
  )
}
