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
    const normalized = String(nextLang || '').toLowerCase().startsWith('en') ? 'en' : 'fr'
    setLang(normalized)
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
    const fallbackDict = translations.fr

    const resolveValue = (primary, secondary, keyPath) => {
      let currentPrimary = primary
      let foundInPrimary = true
      for (const k of keyPath) {
        if (currentPrimary && currentPrimary[k] !== undefined) {
          currentPrimary = currentPrimary[k]
        } else {
          foundInPrimary = false
          break
        }
      }
      if (foundInPrimary && currentPrimary !== undefined) {
        return currentPrimary
      }

      let currentSecondary = secondary
      for (const k of keyPath) {
        if (currentSecondary && currentSecondary[k] !== undefined) {
          currentSecondary = currentSecondary[k]
        } else {
          return undefined
        }
      }
      return currentSecondary
    }

    const t = (key, values = {}, defaultText = '') => {
      if (!key) return defaultText || ''
      const keys = String(key).split('.')
      const res = resolveValue(dict, fallbackDict, keys)
      if (res === undefined) {
        return defaultText || key
      }
      if (typeof res !== 'string') return res
      return res.replace(/\{(\w+)\}/g, (match, name) => values[name] === undefined ? match : String(values[name]))
    }

    return {
      lang,
      language: lang,
      setLang: changeLanguage,
      setLanguage: changeLanguage,
      isFrench: lang === 'fr',
      isEnglish: lang === 'en',
      t,
    }
  }, [lang, changeLanguage])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
