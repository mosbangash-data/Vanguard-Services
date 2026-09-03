import { useEffect } from 'react'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'

// Le login interne de Vanguard Services est hébergé par admin-frontend.
// En production, il doit être fourni par VITE_ADMIN_URL. Sinon, on utilise un chemin
// relatif pour éviter tout lien caché vers un host de développement local.
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || '/admin/login'

export default function Agent() {
  const { t } = useLanguage()

  useEffect(() => {
    // Redirection automatique vers le login interne existant
    const timer = setTimeout(() => {
      window.location.href = ADMIN_URL
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="agent-page">
      <div className="container agent-content">
        <div className="agent-card">
          <div className="agent-icon">
            <ShieldCheck size={40} aria-hidden="true" />
          </div>
          <h1 className="agent-title display-title">{t('agent.title')}</h1>
          <p className="agent-message">{t('agent.message')}</p>
          <div className="loading-spinner" aria-hidden="true" />
          <a href={ADMIN_URL} className="btn btn-primary mt-6">
            {t('agent.button')}
            <ExternalLink size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  )
}