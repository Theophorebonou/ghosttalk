export function Spinner({ className = '' }) {
  return (
    <div
      className={`inline-block h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary ${className}`}
      role="status"
      aria-label="Chargement"
    />
  )
}
