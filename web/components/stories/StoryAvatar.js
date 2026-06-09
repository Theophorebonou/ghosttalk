'use client'

export function StoryAvatar({
  username,
  avatarUrl,
  hasUnviewed,
  isOwn,
  onClick,
  size = 'md',
}) {
  const dim = size === 'sm' ? 'h-12 w-12' : 'h-14 w-14'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-1"
      title={isOwn ? 'Votre statut' : `@${username}`}
    >
      <div
        className={`rounded-full p-[2px] ${
          hasUnviewed
            ? 'bg-gradient-to-tr from-violet-500 via-fuchsia-500 to-violet-300'
            : 'bg-border'
        }`}
      >
        <div className={`${dim} overflow-hidden rounded-full ring-2 ring-background`}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={username ?? ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-highlight text-sm font-bold text-primary">
              {username?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
      </div>
      <span className="max-w-[4.5rem] truncate text-[10px] text-text-muted">
        {isOwn ? 'Vous' : `@${username}`}
      </span>
    </button>
  )
}
