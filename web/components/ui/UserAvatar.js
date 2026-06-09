'use client'

const SIZES = {
  xs:  'h-7  w-7  text-xs',
  sm:  'h-9  w-9  text-sm',
  md:  'h-10 w-10 text-sm',
  lg:  'h-12 w-12 text-base',
  xl:  'h-16 w-16 text-xl',
}

export function UserAvatar({ username, avatarUrl, size = 'md', className = '' }) {
  const dim = SIZES[size] ?? SIZES.md

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username ?? ''}
        className={`${dim} shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-primary/20 font-semibold text-primary ${className}`}
    >
      {username?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  )
}
