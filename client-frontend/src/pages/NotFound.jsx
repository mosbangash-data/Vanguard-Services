import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'

export default function NotFound() {
  const { t } = useLanguage()
  return (
    <div className="not-found">
      <div className="container not-found-content">
        <span className="not-found-code">404</span>
        <h1 className="not-found-title display-title">{t('ticket.notFound')}</h1>
        <p className="not-found-message">{t('ticket.notFoundMessage')}</p>
        <Link to="/" className="btn btn-primary">
          <ArrowLeft size={18} aria-hidden="true" />
          {t('ticket.backHome')}
        </Link>
      </div>
    </div>
  )
}