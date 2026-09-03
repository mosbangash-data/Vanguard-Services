import React from 'react'

export function Card({ children, className = '', hover = false, onClick, ...props }) {
  return (
    <div
      className={`vanguard-card ${hover ? 'vanguard-card--hover' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`vanguard-card-header ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={`vanguard-card-title ${className}`} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`vanguard-card-description ${className}`} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`vanguard-card-content ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={`vanguard-card-footer ${className}`} {...props}>
      {children}
    </div>
  )
}
