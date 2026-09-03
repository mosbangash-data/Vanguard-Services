import React from 'react'
import { Loader2 } from 'lucide-react'

export function LoadingState({
  message = 'Chargement des données en cours…',
  type = 'skeleton', // 'skeleton', 'spinner', 'cards'
  cardCount = 4,
  className = '',
}) {
  if (type === 'spinner') {
    return (
      <div className={`vanguard-loading-spinner-wrap ${className}`}>
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="vanguard-loading-text">{message}</p>
      </div>
    )
  }

  if (type === 'cards') {
    return (
      <div className={`vanguard-stats-grid ${className}`}>
        {Array.from({ length: cardCount }).map((_, i) => (
          <div key={i} className="vanguard-stat-card skeleton-card">
            <div className="skeleton-line" style={{ width: '40%', height: '14px' }} />
            <div className="skeleton-line" style={{ width: '60%', height: '28px', margin: '14px 0 8px' }} />
            <div className="skeleton-line" style={{ width: '75%', height: '12px' }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`vanguard-loading-state ${className}`}>
      <div className="skeleton-pulse-block" style={{ height: '48px', width: '100%', marginBottom: '16px' }} />
      <div className="skeleton-pulse-block" style={{ height: '220px', width: '100%' }} />
    </div>
  )
}
