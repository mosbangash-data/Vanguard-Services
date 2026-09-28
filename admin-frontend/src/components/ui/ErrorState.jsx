import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { useLanguage } from '../../i18n/useLanguage'

export function ErrorState({
  title,
  message,
  onRetry,
  className = '',
}) {
  const { t } = useLanguage()
  return (
    <div className={`vanguard-error-state ${className}`}>
      <div className="vanguard-error-icon-wrap">
        <AlertTriangle size={32} />
      </div>
      <h3 className="vanguard-error-title">{title || t('commonUi.errorTitle')}</h3>
      <p className="vanguard-error-message">{message || t('commonUi.errorMessage')}</p>
      {onRetry && (
        <div className="vanguard-error-action">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            {t('commonUi.retry')}
          </Button>
        </div>
      )}
    </div>
  )
}
