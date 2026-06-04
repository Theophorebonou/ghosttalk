export function Button({
  children,
  className = '',
  variant = 'primary',
  disabled = false,
  type = 'button',
  ...props
}) {
  const variants = {
    primary:
      'bg-primary text-white hover:opacity-90 disabled:opacity-40',
    ghost:
      'bg-transparent text-text border border-border hover:bg-surface-highlight',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
