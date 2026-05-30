export function Spinner({ className = '' }) {
  return (
    <div
      className={`inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-500 ${className}`}
      role="status"
      aria-label="Chargement"
    />
  )
}
