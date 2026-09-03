import React from 'react'
import { Loader2 } from 'lucide-react'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  type = 'button',
  ...props
}) {
  const baseClass = 'vanguard-btn'
  const variantClass = `vanguard-btn--${variant}`
  const sizeClass = `vanguard-btn--${size}`
  const loadingClass = loading ? 'is-loading' : ''

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseClass} ${variantClass} ${sizeClass} ${loadingClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="btn-spinner animate-spin" size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : Icon ? (
        <Icon className="btn-icon" size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />
      ) : null}
      {children && <span className="btn-text">{children}</span>}
    </button>
  )
}
