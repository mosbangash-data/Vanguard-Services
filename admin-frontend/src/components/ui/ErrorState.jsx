import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './Button'

export function ErrorState({
  title = 'Impossible de charger les données',
  message = 'Une erreur est survenue lors de la communication avec le serveur.',
  onRetry,
  className = '',
}) {
  return (
    <div className={`vanguard-error-state ${className}`}>
      <div className="vanguard-error-icon-wrap">
        <AlertTriangle size={32} />
      </div>
      <h3 className="vanguard-error-title">{title}</h3>
      <p className="vanguard-error-message">{message}</p>
      {onRetry && (
        <div className="vanguard-error-action">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      )}
    </div>
  )
}
