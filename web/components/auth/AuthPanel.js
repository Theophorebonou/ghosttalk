'use client'

export function AuthPanel({ children, onBack, title }) {
  return (
    <div className="ghost-panel-enter w-full max-w-md">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-200"
        >
          ← Accueil
        </button>
      )}
      {title && (
        <h2 className="mb-6 text-center text-lg font-semibold text-zinc-200">{title}</h2>
      )}
      <div className="rounded-2xl border border-violet-500/15 bg-[#353347]/90 p-6 shadow-xl backdrop-blur-xl">
        {children}
      </div>
    </div>
  )
}
