import { MaskedFigure } from './MaskedFigure'

const AUTH_FIGURES = [
  {
    id: 'center',
    className: 'left-1/2 top-[2%] h-[min(48vh,360px)] -translate-x-1/2 opacity-50 sm:opacity-55',
    delay: '0s',
  },
  {
    id: 'left',
    className: 'left-[-8%] top-[18%] h-[min(38vh,280px)] opacity-35 sm:left-[-2%] sm:opacity-40',
    delay: '-2s',
    mirrored: false,
  },
  {
    id: 'right',
    className: 'right-[-8%] top-[22%] h-[min(36vh,260px)] opacity-35 sm:right-[-2%] sm:opacity-40',
    delay: '-4s',
    mirrored: true,
  },
  {
    id: 'back',
    className: 'left-[18%] bottom-[5%] h-[min(28vh,200px)] opacity-25 sm:opacity-30',
    delay: '-1.5s',
    mirrored: true,
  },
  {
    id: 'back2',
    className: 'right-[15%] bottom-[8%] h-[min(26vh,190px)] opacity-25 sm:opacity-30',
    delay: '-3s',
  },
]

const CHAT_FIGURES = [
  {
    id: 'main',
    className: 'right-[-2%] bottom-[-4%] h-[min(55vh,400px)] opacity-30 sm:right-[4%] sm:opacity-35',
    delay: '0s',
  },
  {
    id: 'left',
    className: 'left-[-6%] bottom-[10%] h-[min(32vh,240px)] opacity-22 sm:left-[2%] sm:opacity-26',
    delay: '-2.5s',
    mirrored: true,
  },
  {
    id: 'top',
    className: 'right-[20%] top-[8%] h-[min(22vh,160px)] opacity-18 sm:opacity-22',
    delay: '-4s',
    mirrored: true,
  },
]

function FigureLayer({ figures }) {
  return (
    <>
      {figures.map((fig) => (
        <div
          key={fig.id}
          className={`ghost-figure-float absolute w-auto ${fig.className}`}
          style={{ animationDelay: fig.delay }}
        >
          <MaskedFigure
            idPrefix={`fig-${fig.id}`}
            mirrored={fig.mirrored}
            className="h-full w-auto"
          />
        </div>
      ))}
    </>
  )
}

export function GhostBackdrop({ variant = 'auth' }) {
  const isAuth = variant === 'auth'
  const figures = isAuth ? AUTH_FIGURES : CHAT_FIGURES

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className={`absolute inset-0 ${
          isAuth
            ? 'bg-[#1e1c2e]'
            : 'bg-[#1a1928]'
        }`}
      />

      <div className="ghost-mist ghost-mist-a" />
      <div className="ghost-mist ghost-mist-b" />
      <div className="ghost-mist ghost-mist-c" />

      <div
        className={`absolute inset-0 ${
          isAuth
            ? 'bg-[radial-gradient(ellipse_90%_70%_at_50%_20%,rgba(139,92,246,0.22),transparent_55%)]'
            : 'bg-[radial-gradient(ellipse_60%_70%_at_75%_80%,rgba(139,92,246,0.16),transparent_50%)]'
        }`}
      />

      <FigureLayer figures={figures} />

      <div className="ghost-particles">
        {Array.from({ length: isAuth ? 20 : 12 }).map((_, i) => (
          <span
            key={i}
            className="ghost-particle"
            style={{
              left: `${(i * 17 + 7) % 100}%`,
              top: `${(i * 23 + 11) % 100}%`,
              animationDelay: `${(i % 7) * 0.7}s`,
              animationDuration: `${4 + (i % 5)}s`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-[#2a2640]/30 via-transparent to-[#1e1c2e]/50" />
    </div>
  )
}
