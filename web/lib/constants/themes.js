export const THEMES = {
  dark: {
    id: 'dark',
    name: 'Sombre',
    colors: {
      background: '#0b141a',
      surface: '#111b21',
      surfaceHighlight: '#202c33',
      border: '#2a3942',
      text: '#e9edef',
      textMuted: '#8696a0',
      primary: '#00a884',
      primaryHover: '#06cf9c',
      accent: '#00a884',
      success: '#00a884',
      error: '#ea4335',
      warning: '#f7c948',
    },
  },
  light: {
    id: 'light',
    name: 'Clair',
    colors: {
      background: '#efeae2',
      surface: '#ffffff',
      surfaceHighlight: '#f0f2f5',
      border: '#d1d7db',
      text: '#111b21',
      textMuted: '#667781',
      primary: '#00a884',
      primaryHover: '#06cf9c',
      accent: '#00a884',
      success: '#00a884',
      error: '#ea4335',
      warning: '#f7c948',
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Minuit',
    colors: {
      background: '#0a1014',
      surface: '#0d1418',
      surfaceHighlight: '#1a2328',
      border: '#243038',
      text: '#e9edef',
      textMuted: '#8696a0',
      primary: '#25d366',
      primaryHover: '#2ee379',
      accent: '#25d366',
      success: '#25d366',
      error: '#ea4335',
      warning: '#f7c948',
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      background: '#0a1628',
      surface: '#0f1f35',
      surfaceHighlight: '#1a2d47',
      border: '#2a4058',
      text: '#e9edef',
      textMuted: '#8696a0',
      primary: '#0088cc',
      primaryHover: '#00a8e8',
      accent: '#0088cc',
      success: '#00a884',
      error: '#ea4335',
      warning: '#f7c948',
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

  root.dataset.theme = themeId
}
