import React, { useEffect, useId } from 'react'
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
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen && onClose) {
        onClose()
      }
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="vanguard-modal-overlay" onClick={onClose}>
      <div
        className={`vanguard-modal-dialog vanguard-modal-dialog--${size} ${className}`}
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby={title ? titleId : undefined}
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
