/**
 * Icône groupe sobre (pas d'emoji) — trois silhouettes.
 */
export function GroupIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="8.5" cy="9" r="3.25" className="fill-current opacity-90" />
      <circle cx="15.5" cy="9" r="3.25" className="fill-current opacity-90" />
      <path
        d="M5 18.5c0-2.2 2.2-3.5 5-3.5s5 1.3 5 3.5"
        className="stroke-current opacity-75"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 18.5c0-1.6 1.4-2.5 3.5-2.5"
        className="stroke-current opacity-50"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
