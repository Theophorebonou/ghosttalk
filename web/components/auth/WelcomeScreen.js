'use client'

export function WelcomeScreen({ onGhostMode, onEmailPhone, authError }) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 text-center animate-fade-in">
      {/* Logo */}
      <div className="relative">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
          <svg className="h-12 w-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-text">GhostTalk</h2>
      </div>

      {/* Tagline */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-text">
          Messagerie privee et securisee
        </h1>
        <p className="text-sm leading-relaxed text-text-muted">
          Chiffrement de bout en bout. Vos messages, votre vie privee.
        </p>
      </div>

      {/* Features */}
      <div className="flex flex-wrap justify-center gap-3">
        {[
          { icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', label: 'Chiffre E2E' },
          { icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: 'Mode anonyme' },
          { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', label: 'Groupes' },
        ].map((feature) => (
          <div
            key={feature.label}
            className="flex items-center gap-2 rounded-full bg-surface-highlight px-4 py-2 text-xs text-text"
          >
            <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
            </svg>
            {feature.label}
          </div>
        ))}
      </div>

      {/* Auth buttons */}
      <div className="flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onGhostMode}
          className="group w-full rounded-xl bg-primary px-6 py-4 text-left text-white transition hover:bg-primary-hover"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold">Mode Fantome</div>
              <div className="mt-0.5 text-sm opacity-80">
                Anonyme - Pas d&apos;email, pas de numero
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onEmailPhone}
          className="group w-full rounded-xl border border-border bg-surface px-6 py-4 text-left transition hover:bg-surface-highlight"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-highlight">
              <svg className="h-6 w-6 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-text">Email ou Telephone</div>
              <div className="mt-0.5 text-sm text-text-muted">
                Se connecter avec mot de passe ou code
              </div>
            </div>
          </div>
        </button>
      </div>

      {authError && (
        <p className="text-sm text-error">{authError}</p>
      )}

      <p className="text-xs text-text-muted">
        Vos cles de chiffrement restent sur votre appareil
      </p>
    </div>
  )
}
