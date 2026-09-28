import { useState, useEffect, useMemo, useCallback } from 'react'
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

  const changeLanguage = useCallback((nextLang) => {
    if (nextLang === 'fr' || nextLang === 'en') setLang(nextLang)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
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
      setLang: changeLanguage,
      t: (key, values = {}) => {
        const keys = key.split('.')
        let res = dict
        for (const k of keys) {
          if (res && res[k] !== undefined) {
            res = res[k]
          } else {
            return key
          }
        }
        if (typeof res !== 'string') return res
        return res.replace(/\{(\w+)\}/g, (match, name) => values[name] === undefined ? match : String(values[name]))
      },
    }
  }, [lang, changeLanguage])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
