import React from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from './Button'

export function EmptyState({
  title = 'Aucune donnée disponible',
  description = 'Il n’y a aucun élément à afficher pour le moment.',
  icon: Icon = FolderOpen,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) {
  return (
    <div className={`vanguard-empty-state ${className}`}>
      <div className="vanguard-empty-state-icon">
        <Icon size={32} aria-hidden="true" />
      </div>
      <h3 className="vanguard-empty-state-title">{title}</h3>
      {description && <p className="vanguard-empty-state-description">{description}</p>}
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
