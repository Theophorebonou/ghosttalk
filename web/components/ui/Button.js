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
      'bg-primary text-white hover:bg-primary-hover disabled:opacity-40',
    ghost:
      'bg-transparent text-text hover:bg-surface-highlight',
    secondary:
      'bg-surface-highlight text-text hover:bg-surface',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
