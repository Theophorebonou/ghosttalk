'use client'

export function StoryAvatar({
  username,
  hasUnviewed,
  isOwn,
  onClick,
  size = 'md',
}) {
  const dim = size === 'sm' ? 'h-12 w-12' : 'h-14 w-14'
  const letter = username?.charAt(0)?.toUpperCase() ?? '?'

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
            : 'bg-zinc-600'
        }`}
      >
        <div
          className={`${dim} flex items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-violet-300 ring-2 ring-[#2a2838]`}
        >
          {letter}
        </div>
      </div>
      <span className="max-w-[4.5rem] truncate text-[10px] text-zinc-400">
        {isOwn ? 'Vous' : `@${username}`}
      </span>
    </button>
  )
}
