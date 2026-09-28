import React from 'react'
import { useLanguage } from '../../i18n/useLanguage'

const STATUS_CONFIGS = {
  // Vehicle / General statuses
  AVAILABLE: { label: 'Disponible', variant: 'success' },
  RESERVED: { label: 'Réservé', variant: 'warning' },
  SOLD: { label: 'Vendu', variant: 'neutral' },
  IN_MAINTENANCE: { label: 'En maintenance', variant: 'warning' },

  // Transport / Reservations / Tickets
  ACTIVE: { label: 'Actif', variant: 'success' },
  INACTIVE: { label: 'Inactif', variant: 'neutral' },
  SUSPENDED: { label: 'Suspendu', variant: 'danger' },
  PENDING: { label: 'En attente', variant: 'warning' },
  CONFIRMED: { label: 'Confirmé', variant: 'success' },
  CANCELLED: { label: 'Annulé', variant: 'danger' },
  VALID: { label: 'Valide', variant: 'success' },
  USED: { label: 'Utilisé', variant: 'neutral' },
  VERIFIED: { label: 'Vérifié', variant: 'success' },
  REJECTED: { label: 'Rejeté', variant: 'danger' },

  // Construction
  DRAFT: { label: 'Brouillon', variant: 'neutral' },
  PUBLISHED: { label: 'Publié', variant: 'success' },
  ARCHIVED: { label: 'Archivé', variant: 'neutral' },
  IN_PROGRESS: { label: 'En cours', variant: 'primary' },
  COMPLETED: { label: 'Terminé', variant: 'success' },
  SCHEDULED: { label: 'Planifié', variant: 'info' },
  WAITING_FOR_CLIENT: { label: 'Attente client', variant: 'warning' },
  WAITING_CLIENT: { label: 'Attente client', variant: 'warning' },
  RESOLVED: { label: 'Résolu', variant: 'success' },
  EXPIRED: { label: 'Expiré', variant: 'danger' },
  OPEN: { label: 'Ouvert', variant: 'info' },
  CLOSED: { label: 'Fermé', variant: 'neutral' },

  // AutoSales Inquiries
  NEW: { label: 'Nouveau', variant: 'info' },
  CONTACTED: { label: 'Contacté', variant: 'primary' },
  CONVERTED: { label: 'Converti', variant: 'success' },

  // Parcels & Payments
  REGISTERED: { label: 'Enregistré', variant: 'info' },
  IN_TRANSIT: { label: 'En transit', variant: 'primary' },
  ARRIVED_AT_AGENCY: { label: 'Arrivé à l’agence', variant: 'warning' },
  READY_FOR_PICKUP: { label: 'Prêt à retirer', variant: 'success' },
  COLLECTED: { label: 'Retiré', variant: 'neutral' },
  RETURNED: { label: 'Retourné', variant: 'danger' },
  PAYMENT_PENDING: { label: 'Paiement en attente', variant: 'warning' },
  PROCESSING: { label: 'Traitement', variant: 'warning' },
  FAILED: { label: 'Échoué', variant: 'danger' },
  REFUNDED: { label: 'Remboursé', variant: 'info' },
  MAINTENANCE: { label: 'En maintenance', variant: 'warning' },
  OUT_OF_SERVICE: { label: 'Hors service', variant: 'danger' },
}

export function StatusBadge({ status, label, variant, dot = true, className = '' }) {
  const { t } = useLanguage()
  const normalized = String(status || '').toUpperCase()
  const config = STATUS_CONFIGS[normalized] || {
    label: label || status || '—',
    variant: variant || 'neutral',
  }

  const finalVariant = variant || config.variant || 'neutral'
  const translatedStatus = t(`status.${normalized.toLowerCase()}`)
  const displayLabel = label || (translatedStatus.startsWith('status.') ? config.label : translatedStatus) || normalized

  return (
    <span className={`vanguard-badge vanguard-badge--${finalVariant} ${className}`}>
      {dot && <span className="vanguard-badge-dot" aria-hidden="true" />}
      <span className="vanguard-badge-text">{displayLabel}</span>
    </span>
  )
}
