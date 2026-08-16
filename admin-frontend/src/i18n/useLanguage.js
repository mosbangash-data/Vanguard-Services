import { useContext } from 'react'
import { LanguageContext } from './LanguageContext'
import { translations } from './translations'

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    const dict = translations.fr
    return {
      lang: 'fr',
      setLang: () => {},
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
  }
  return ctx
}
