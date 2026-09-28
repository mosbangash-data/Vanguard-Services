import React from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from './Button'
import { useLanguage } from '../../i18n/useLanguage'

export function EmptyState({
  title,
  description,
  icon: Icon = FolderOpen,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) {
  const { t } = useLanguage()
  return (
    <div className={`vanguard-empty-state ${className}`}>
      <div className="vanguard-empty-state-icon">
        <Icon size={32} aria-hidden="true" />
      </div>
      <h3 className="vanguard-empty-state-title">{title || t('commonUi.emptyTitle')}</h3>
      {description !== null && <p className="vanguard-empty-state-description">{description ?? t('commonUi.emptyDescription')}</p>}
      {actionLabel && onAction && (
        <div className="vanguard-empty-state-action">
          <Button variant="primary" size="sm" icon={actionIcon} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
