export const THEMES = {
  dark: {
    id: 'dark',
    name: 'Sombre',
    colors: {
      background: '#1a1a2e',
      surface: '#16213e',
      surfaceHighlight: '#2a2838',
      border: '#4a4e69',
      text: '#e2e8f0',
      textMuted: '#94a3b8',
      primary: '#8b5cf6',
      primaryHover: '#7c3aed',
      accent: '#06b6d4',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
    },
  },
  light: {
    id: 'light',
    name: 'Clair',
    colors: {
      background: '#f8fafc',
      surface: '#ffffff',
      surfaceHighlight: '#f1f5f9',
      border: '#e2e8f0',
      text: '#1e293b',
      textMuted: '#64748b',
      primary: '#8b5cf6',
      primaryHover: '#7c3aed',
      accent: '#06b6d4',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
    },
  },
  cyber: {
    id: 'cyber',
    name: 'Cyberpunk',
    colors: {
      background: '#0a0a0f',
      surface: '#12121a',
      surfaceHighlight: '#1a1a2e',
      border: '#00ff9f',
      text: '#00ff9f',
      textMuted: '#00d4aa',
      primary: '#ff00ff',
      primaryHover: '#ff00aa',
      accent: '#00ffff',
      success: '#00ff9f',
      error: '#ff0055',
      warning: '#ffaa00',
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Minuit',
    colors: {
      background: '#0f172a',
      surface: '#1e293b',
      surfaceHighlight: '#334155',
      border: '#475569',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      accent: '#06b6d4',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
    },
  },
  forest: {
    id: 'forest',
    name: 'Forêt',
    colors: {
      background: '#1a2f1a',
      surface: '#2d4a2d',
      surfaceHighlight: '#3d5a3d',
      border: '#4a6b4a',
      text: '#e8f5e8',
      textMuted: '#a8d4a8',
      primary: '#22c55e',
      primaryHover: '#16a34a',
      accent: '#84cc16',
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b',
    },
  },
}

export const DEFAULT_THEME = 'dark'

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME]
}

export function applyTheme(themeId) {
  const theme = getTheme(themeId)
  const root = document.documentElement

  root.style.setProperty('--background', theme.colors.background)
  root.style.setProperty('--foreground', theme.colors.text)
  root.style.setProperty('--surface', theme.colors.surface)
  root.style.setProperty('--surface-highlight', theme.colors.surfaceHighlight)
  root.style.setProperty('--border', theme.colors.border)
  root.style.setProperty('--text', theme.colors.text)
  root.style.setProperty('--text-muted', theme.colors.textMuted)
  root.style.setProperty('--primary', theme.colors.primary)
  root.style.setProperty('--primary-hover', theme.colors.primaryHover)
  root.style.setProperty('--accent', theme.colors.accent)
  root.style.setProperty('--success', theme.colors.success)
  root.style.setProperty('--error', theme.colors.error)
  root.style.setProperty('--warning', theme.colors.warning)

  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value)
  })
}
