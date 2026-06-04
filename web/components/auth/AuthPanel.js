'use client'

export function AuthPanel({ children, onBack, title }) {
  return (
    <div className="w-full max-w-md animate-fade-in">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm text-text-muted transition hover:text-text"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </button>
      )}
      {title && (
        <h2 className="mb-6 text-center text-xl font-semibold text-text">{title}</h2>
      )}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-lg">
        {children}
      </div>
    </div>
  )
}
