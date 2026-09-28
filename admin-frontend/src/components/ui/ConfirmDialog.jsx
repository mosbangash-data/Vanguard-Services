import React from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useLanguage } from '../../i18n/useLanguage'

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger', // 'danger', 'warning', 'primary'
  loading = false,
}) {
  const { t } = useLanguage()
  const Icon = variant === 'danger' || variant === 'warning' ? AlertTriangle : Info

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={!loading}>
      <div className="vanguard-confirm-content">
        <div className={`vanguard-confirm-icon-wrap vanguard-confirm-icon-wrap--${variant}`}>
          <Icon size={24} />
        </div>
        <div className="vanguard-confirm-text">
          <h4>{title || t('commonUi.confirmAction')}</h4>
          <p>{message || t('commonUi.confirmContinue')}</p>
        </div>
      </div>

      <div className="vanguard-confirm-actions">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelText || t('commonUi.cancel')}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmText || t('commonUi.confirm')}
        </Button>
      </div>
    </Modal>
  )
}
