import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'

export function LoadingState({ message }) {
  const { t } = useLanguage()
  return (
    <div className="state-container" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <p className="state-message mt-4">{message || t('states.loading')}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  const { t } = useLanguage()
  return (
    <div className="state-container" role="alert">
      <div className="state-icon">
        <AlertCircle size={28} aria-hidden="true" />
      </div>
      <h3 className="state-title">{t('states.error')}</h3>
      <p className="state-message">{message || t('states.error')}</p>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          {t('states.retry')}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }) {
  const { t } = useLanguage()
  return (
    <div className="state-container">
      <div className="state-icon">
        <Inbox size={28} aria-hidden="true" />
      </div>
      <h3 className="state-title">{t('states.empty')}</h3>
      <p className="state-message">{message || t('states.empty')}</p>
    </div>
  )
}