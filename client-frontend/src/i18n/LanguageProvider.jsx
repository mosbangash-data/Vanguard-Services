import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { translations } from './translations'

export const LanguageContext = createContext(null)

const STORAGE_KEY = 'vanguard.client.lang'

const getInitialLanguage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'fr' || stored === 'en' || stored === 'sw') return stored
  } catch {
    // ignore
  }
  const browserLang = typeof navigator !== 'undefined' ? navigator.language : 'fr'
  if (browserLang?.toLowerCase().startsWith('en')) return 'en'
  if (browserLang?.toLowerCase().startsWith('sw')) return 'sw'
  return 'fr'
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language)
    } catch {
      // ignore
    }
    document.documentElement.lang = language
  }, [language])

  const t = useCallback(
    (key) => {
      const keys = key.split('.')
      const resolve = (dictionary) => {
        let value = dictionary
        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) value = value[k]
          else return undefined
        }
        return value
      }
      const value = resolve(translations[language]) ?? resolve(translations.fr) ?? resolve(translations.en)
      return typeof value === 'string' ? value : key
    },
    [language]
  )

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isFrench: language === 'fr',
    }),
    [language, t]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
