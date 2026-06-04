'use client'

import { useTheme } from '@/contexts/ThemeContext'

const THEME_HINTS = {
  dark: 'Violet classique',
  light: 'Fond clair',
  cyber: 'Néon vert & rose',
  midnight: 'Bleu nuit',
  forest: 'Verts naturels',
}

export function ThemeSelector({ variant = 'settings' }) {
  const { theme, themeId, setTheme, themes } = useTheme()

  if (variant === 'compact') {
    return (
      <p className="text-xs text-text-muted">
        Thème actuel : <span className="text-text">{theme.name}</span> — ouvrez Paramètres pour changer.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2" role="listbox" aria-label="Choisir un thème">
      {Object.values(themes).map((t) => {
        const selected = themeId === t.id
        return (
          <li key={t.id}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => setTheme(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                selected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                  : 'border-border bg-surface-highlight/50 hover:border-primary/40 hover:bg-surface-highlight'
              }`}
            >
              <span
                className="flex h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border"
                aria-hidden
              >
                <span className="h-1/2 w-full" style={{ background: t.colors.primary }} />
                <span className="flex h-1/2 w-full">
                  <span className="w-1/2" style={{ background: t.colors.background }} />
                  <span className="w-1/2" style={{ background: t.colors.surface }} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">{t.name}</span>
                <span className="block text-xs text-text-muted">
                  {THEME_HINTS[t.id] ?? ''}
                </span>
              </span>
              {selected && (
                <span className="shrink-0 text-primary" aria-hidden>
                  ✓
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
