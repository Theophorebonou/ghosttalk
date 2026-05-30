'use client'

export function WelcomeScreen({ onGhostMode, onEmailPhone, authError }) {
  return (
    <div className="ghost-welcome flex w-full max-w-md flex-col items-center gap-8 text-center">
      <div className="ghost-stagger-1 relative">
        <div className="ghost-logo-ring mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 shadow-[0_0_40px_rgba(124,58,237,0.25)]">
          <span className="text-4xl ghost-logo-float" aria-hidden>
            🎭
          </span>
        </div>
        <p className="text-sm font-medium uppercase tracking-[0.35em] text-violet-400">
          GhostTalk
        </p>
      </div>

      <div className="ghost-stagger-2 space-y-3">
        <h1 className="bg-gradient-to-b from-zinc-50 to-zinc-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          Parlez sans laisser de trace
        </h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          Messagerie chiffrée de bout en bout. Anonyme ou classique — vous
          choisissez votre ombre.
        </p>
      </div>

      <ul className="ghost-stagger-3 flex flex-wrap justify-center gap-2">
        {['E2E', 'Anonyme', 'Groupes'].map((tag) => (
          <li
            key={tag}
            className="rounded-full border border-violet-500/20 bg-[#353347]/80 px-3 py-1 text-xs text-zinc-300 backdrop-blur-sm"
          >
            {tag}
          </li>
        ))}
      </ul>

      <div className="ghost-stagger-4 flex w-full flex-col gap-3">
        <button
          type="button"
          onClick={onGhostMode}
          className="ghost-card-hover group w-full rounded-xl border border-violet-500/40 bg-[#353347]/95 px-6 py-4 text-left backdrop-blur-md transition"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/20 text-lg transition group-hover:scale-110 group-hover:bg-violet-600/30">
              👻
            </span>
            <div>
              <div className="font-semibold text-zinc-100">Mode Fantôme</div>
              <div className="mt-0.5 text-xs text-zinc-400">
                Anonyme • Pas d&apos;email • Pas de numéro
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onEmailPhone}
          className="ghost-card-hover group w-full rounded-xl border border-violet-500/15 bg-[#353347]/90 px-6 py-4 text-left backdrop-blur-md transition"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 text-lg transition group-hover:scale-110 group-hover:border-violet-500/50">
              ✉️
            </span>
            <div>
              <div className="font-semibold text-zinc-100">Email ou Téléphone</div>
              <div className="mt-0.5 text-xs text-zinc-400">
                Mot de passe, lien magique ou SMS
              </div>
            </div>
          </div>
        </button>
      </div>

      {authError && (
        <p className="ghost-stagger-5 text-sm text-red-400">{authError}</p>
      )}

      <p className="ghost-stagger-5 text-[10px] uppercase tracking-widest text-zinc-600">
        Chiffrement local • Clés sur votre appareil
      </p>
    </div>
  )
}
