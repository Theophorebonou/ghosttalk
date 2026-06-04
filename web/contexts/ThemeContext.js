'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { THEMES, DEFAULT_THEME, applyTheme, getTheme } from '@/lib/constants/themes'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(DEFAULT_THEME)

  useEffect(() => {
    const saved = localStorage.getItem('ghosttalk_theme')
    if (saved && THEMES[saved]) {
      setThemeId(saved)
      applyTheme(saved)
    } else {
      applyTheme(DEFAULT_THEME)
    }
  }, [])

  useEffect(() => {
    applyTheme(themeId)
    localStorage.setItem('ghosttalk_theme', themeId)
  }, [themeId])

  const setTheme = (newThemeId) => {
    if (THEMES[newThemeId]) {
      setThemeId(newThemeId)
    }
  }

  const theme = getTheme(themeId)

  return (
    <ThemeContext.Provider value={{ theme, themeId, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
