import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './ThemeContext'

const STORAGE_KEY = 'vanguard.theme'
const isTheme = (value) => ['light', 'dark', 'system'].includes(value)

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isTheme(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const setTheme = useCallback((nextTheme) => {
    if (isTheme(nextTheme)) setThemeState(nextTheme)
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return undefined
    const update = (event) => setSystemDark(event.matches)
    setSystemDark(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Theme remains usable when browser storage is unavailable.
    }
  }, [theme, resolvedTheme])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
