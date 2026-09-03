import React from 'react'

export function IconButton({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  title,
  ariaLabel,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      title={title || ariaLabel}
      aria-label={ariaLabel || title}
      className={`vanguard-icon-btn vanguard-icon-btn--${variant} vanguard-icon-btn--${size} ${className}`}
      {...props}
    >
      <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
    </button>
  )
}
