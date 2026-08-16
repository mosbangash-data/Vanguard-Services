import { Languages } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  const toggle = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr')
  }

  return (
    <button
      type="button"
      className="lang-switcher"
      onClick={toggle}
      aria-label={t('common.language')}
      title={t('common.language')}
    >
      <Languages size={16} aria-hidden="true" />
      <span className="lang-switcher-label">{language === 'fr' ? 'FR' : 'EN'}</span>
    </button>
  )
}