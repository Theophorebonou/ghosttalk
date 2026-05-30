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
      'bg-violet-600 text-white hover:bg-violet-500 disabled:bg-violet-900 disabled:text-violet-400',
    ghost:
      'bg-transparent text-zinc-300 hover:bg-zinc-800 border border-zinc-700',
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
