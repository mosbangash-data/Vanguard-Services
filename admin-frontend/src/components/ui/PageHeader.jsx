import React from 'react'

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  badge,
  actions,
  className = '',
  children,
}) {
  return (
    <header className={`vanguard-page-header ${className}`}>
      <div className="vanguard-page-header-content">
        {eyebrow && <span className="vanguard-page-eyebrow">{eyebrow}</span>}
        <div className="vanguard-page-header-title-row">
          <h1 className="vanguard-page-title">{title}</h1>
          {badge && <div className="vanguard-page-header-badge">{badge}</div>}
        </div>
        {subtitle && <p className="vanguard-page-subtitle">{subtitle}</p>}
        {children}
      </div>

      {actions && <div className="vanguard-page-header-actions">{actions}</div>}
    </header>
  )
}
