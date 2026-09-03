import React from 'react'
import { Card } from './Card'

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'primary', // 'primary', 'coach', 'auto', 'construction', 'revenue', 'warning', 'danger', 'neutral'
  trend,
  className = '',
  onClick,
}) {
  return (
    <Card
      className={`vanguard-stat-card vanguard-stat-card--${accent} ${onClick ? 'is-clickable' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="vanguard-stat-header">
        <span className="vanguard-stat-title">{title}</span>
        {Icon && (
          <div className="vanguard-stat-icon-wrap">
            <Icon size={18} className="vanguard-stat-icon" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="vanguard-stat-body">
        <div className="vanguard-stat-value">{value ?? '0'}</div>
        {subtitle && <div className="vanguard-stat-subtitle">{subtitle}</div>}
        {trend && (
          <div className={`vanguard-stat-trend vanguard-stat-trend--${trend.type || 'neutral'}`}>
            <span>{trend.text}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
