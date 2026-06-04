'use client'

import { useTheme } from '@/contexts/ThemeContext'

export function ThemeSelector() {
  const { theme, themeId, setTheme, themes } = useTheme()

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Thème
      </label>
      <div className="grid grid-cols-5 gap-2">
        {Object.values(themes).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            className={`relative h-10 rounded-lg border-2 transition-all ${
              themeId === t.id
                ? 'border-primary scale-105'
                : 'border-transparent hover:border-zinc-600'
            }`}
            style={{
              backgroundColor: t.colors.surface,
              borderColor: themeId === t.id ? t.colors.primary : 'transparent',
            }}
            title={t.name}
          >
            <div
              className="absolute inset-1 rounded"
              style={{ backgroundColor: t.colors.background }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: t.colors.primary }}
              />
            </div>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-zinc-500 text-center">{theme.name}</p>
    </div>
  )
}
