import React, { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md', // 'sm', 'md', 'lg', 'xl'
  showClose = true,
  className = '',
}) {
  const { t } = useLanguage()
  const titleId = useId()
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!isOpen) return undefined

    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onClose) {
        onClose()
        return
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]',
        )].filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')

        if (focusable.length === 0) {
          event.preventDefault()
          dialogRef.current.focus()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    const initialFocus = dialogRef.current?.querySelector(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    )
    ;(initialFocus || dialogRef.current)?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="vanguard-modal-overlay" onClick={(event) => {
      if (event.target === event.currentTarget) onClose?.()
    }}>
      <div
        ref={dialogRef}
        className={`vanguard-modal-dialog vanguard-modal-dialog--${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : t('commonUi.confirmAction')}
        tabIndex={-1}
      >
        <div className="vanguard-modal-header">
          <div className="vanguard-modal-header-text">
            {title && <h3 id={titleId} className="vanguard-modal-title">{title}</h3>}
            {subtitle && <p className="vanguard-modal-subtitle">{subtitle}</p>}
          </div>
          {showClose && (
            <button
              type="button"
              className="vanguard-modal-close"
              onClick={onClose}
              aria-label={t('commonUi.close')}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="vanguard-modal-body">{children}</div>
      </div>
    </div>
  )
}
