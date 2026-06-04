export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary/30 transition ${className}`}
      {...props}
    />
  )
}
