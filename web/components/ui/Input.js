export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-xl border border-border bg-surface-highlight px-4 py-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 ${className}`}
      {...props}
    />
  )
}
