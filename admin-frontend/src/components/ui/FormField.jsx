import React from 'react'

export function FormField({
  label,
  error,
  helper,
  required = false,
  children,
  className = '',
  id,
}) {
  return (
    <div className={`vanguard-form-field ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="vanguard-form-label">
          <span>{label}</span>
          {required && <span className="vanguard-form-required" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="vanguard-form-control-wrap">{children}</div>
      {error && <p className="vanguard-form-error">{error}</p>}
      {!error && helper && <p className="vanguard-form-helper">{helper}</p>}
    </div>
  )
}

export function Input({ className = '', hasError = false, ...props }) {
  return (
    <input
      className={`vanguard-input ${hasError ? 'is-invalid' : ''} ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', hasError = false, children, ...props }) {
  return (
    <select
      className={`vanguard-select ${hasError ? 'is-invalid' : ''} ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ className = '', hasError = false, rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`vanguard-textarea ${hasError ? 'is-invalid' : ''} ${className}`}
      {...props}
    />
  )
}
