import React from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmer l’action',
  message = 'Êtes-vous sûr de vouloir continuer ?',
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'danger', // 'danger', 'warning', 'primary'
  loading = false,
}) {
  const Icon = variant === 'danger' || variant === 'warning' ? AlertTriangle : Info

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={!loading}>
      <div className="vanguard-confirm-content">
        <div className={`vanguard-confirm-icon-wrap vanguard-confirm-icon-wrap--${variant}`}>
          <Icon size={24} />
        </div>
        <div className="vanguard-confirm-text">
          <h4>{title}</h4>
          <p>{message}</p>
        </div>
      </div>

      <div className="vanguard-confirm-actions">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}
