import { useState, useEffect, useMemo } from 'react'
import { LanguageContext } from './LanguageContext'
import { translations } from './translations'

const LANG_KEY = 'vanguard.lang'

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY)
      return saved === 'en' ? 'en' : 'fr'
    } catch {
      return 'fr'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      // Ignore storage write error
    }
  }, [lang])

  const value = useMemo(() => {
    const dict = translations[lang] || translations.fr
    return {
      lang,
      setLang,
      t: (key) => {
        const keys = key.split('.')
        let res = dict
        for (const k of keys) {
          if (res && res[k] !== undefined) {
            res = res[k]
          } else {
            return key
          }
        }
        return res
      },
    }
  }, [lang])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
