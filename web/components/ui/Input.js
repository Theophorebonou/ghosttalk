export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 ${className}`}
      {...props}
    />
  )
}
