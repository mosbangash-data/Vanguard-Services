import { Languages } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()

  return <label className="lang-switcher">
    <Languages size={16} aria-hidden="true" />
    <span className="sr-only">{t('common.language')}</span>
    <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t('common.language')}>
      <option value="fr">Français</option>
      <option value="en">English</option>
      <option value="sw">Kiswahili</option>
    </select>
  </label>
}
