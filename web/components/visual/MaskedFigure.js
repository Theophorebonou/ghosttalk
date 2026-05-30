export function MaskedFigure({ className = '', idPrefix = 'mask', mirrored = false }) {
  const hood = `${idPrefix}-hood`
  const eyes = `${idPrefix}-eyes`
  const blur = `${idPrefix}-blur`

  return (
    <svg
      viewBox="0 0 320 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden
    >
      <defs>
        <linearGradient id={hood} x1="160" y1="40" x2="160" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#7c3aed" stopOpacity="0.45" />
          <stop offset="1" stopColor="#3f3f46" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient
          id={eyes}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(160 175) rotate(90) scale(45 65)"
        >
          <stop stopColor="#ede9fe" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.2" />
        </radialGradient>
        <filter id={blur} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <ellipse
        cx="160"
        cy="385"
        rx="85"
        ry="16"
        fill="#4c1d95"
        opacity="0.35"
        filter={`url(#${blur})`}
        className="ghost-shadow-pulse"
      />

      <path
        d="M60 200 C60 120 95 55 160 45 C225 55 260 120 260 200 L260 320 C260 360 215 395 160 395 C105 395 60 360 60 320 Z"
        fill={`url(#${hood})`}
        stroke="#c4b5fd"
        strokeWidth="1.2"
        strokeOpacity="0.35"
      />

      <path
        d="M95 175 C95 128 125 92 160 88 C195 92 225 128 225 175 C225 212 195 238 160 241 C125 238 95 212 95 175 Z"
        fill="#3f3f46"
        stroke="#a78bfa"
        strokeWidth="1"
        strokeOpacity="0.4"
      />

      <ellipse cx="160" cy="175" rx="52" ry="58" fill={`url(#${eyes})`} opacity="0.45" className="ghost-eye-glow" />

      <ellipse cx="130" cy="172" rx="11" ry="7" fill="#ede9fe" className="ghost-eye-glow" />
      <ellipse cx="190" cy="172" rx="11" ry="7" fill="#ede9fe" className="ghost-eye-glow" />

      <path
        d="M112 220 Q160 252 208 220"
        stroke="#a1a1aa"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  )
}
