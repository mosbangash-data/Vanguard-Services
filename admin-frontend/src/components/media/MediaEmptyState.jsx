import React from 'react'
import { Image as ImageIcon } from 'lucide-react'

export function MediaEmptyState({
  icon: Icon = ImageIcon,
  title = 'Aucune image',
  description,
  size = 'md',
  style = {},
  className = '',
  onClick,
}) {
  const isCompact = size === 'sm'
  const isLarge = size === 'lg'

  const iconSize = isCompact ? 18 : isLarge ? 40 : 28

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        width: '100%',
        height: '100%',
        minHeight: isCompact ? '40px' : isLarge ? '200px' : '100px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8FAFC',
        color: '#64748B',
        borderRadius: '8px',
        padding: isCompact ? '4px' : '16px',
        textAlign: 'center',
        userSelect: 'none',
        ...style,
      }}
    >
      <Icon size={iconSize} style={{ color: '#94A3B8', marginBottom: isCompact ? 0 : '6px' }} />
      {!isCompact && title && (
        <span style={{ fontSize: isLarge ? '0.95rem' : '0.8125rem', fontWeight: 600, color: '#475569' }}>
          {title}
        </span>
      )}
      {!isCompact && description && (
        <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
          {description}
        </span>
      )}
    </div>
  )
}
