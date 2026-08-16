import { Link, useParams } from 'react-router-dom'
import { Printer, ArrowLeft, Bus, User, Calendar, Armchair, CreditCard, Ticket as TicketIcon, QrCode } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState } from '../components/StateView'
import { translateError } from '../utils/errors'

const STATUS_LABELS = {
  VALID: 'valid',
  USED: 'used',
  CANCELLED: 'cancelled',
}

export default function Ticket() {
  const { ticketCode } = useParams()
  const { t } = useLanguage()
  const { data, loading, error, execute } = useFetch(() => api.getTicket(ticketCode), { deps: [ticketCode] })

  const ticket = data?.ticket

  const getStatusLabel = (s) => (STATUS_LABELS[s] ? t(`ticket.${STATUS_LABELS[s]}`) : s)
  const getStatusClass = (s) => {
    if (s === 'VALID') return 'badge-success'
    if (s === 'USED') return 'badge-warning'
    return 'badge-danger'
  }

  const formatDate = (date) => {
    if (!date) return '—'
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return date
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const formatTime = (time) => time || '—'
  const formatAmount = (amount) => new Intl.NumberFormat('fr-FR').format(Number(amount))

  const reservation = ticket?.reservation
  const trip = reservation?.trip
  const schedule = trip?.schedule
  const route = schedule?.route
  const bus = schedule?.bus

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={translateError(error, t)} onRetry={execute} />
  if (!ticket) return <ErrorState message={t('ticket.notFoundMessage')} onRetry={execute} />

  return (
    <div className="ticket-page">
      <section className="section">
        <div className="container">
          <Link to="/" className="ticket-back">
            <ArrowLeft size={16} aria-hidden="true" />
            {t('ticket.backHome')}
          </Link>

          <div className="ticket-card">
            {/* En-tête */}
            <div className="ticket-header">
              <div className="ticket-brand">
                <img src="/assets/logos/vanguard-mark.svg" alt="Vanguard Services" width="44" height="44" />
                <div>
                  <span className="ticket-brand-name">VANGUARD</span>
                  <span className="ticket-brand-sub">COACH</span>
                </div>
              </div>
              <span className={`badge ${getStatusClass(ticket.status)}`}>
                {getStatusLabel(ticket.status)}
              </span>
            </div>

            {/* Corps */}
            <div className="ticket-body">
              <div className="ticket-route">
                <div className="ticket-city">
                  <span className="ticket-city-name">{route?.departureCity || '—'}</span>
                  <span className="ticket-city-time">{formatTime(schedule?.departureTime)}</span>
                </div>
                <div className="ticket-route-line">
                  <span className="ticket-route-dot" />
                  <span className="ticket-route-bar" />
                  <Bus size={22} aria-hidden="true" />
                  <span className="ticket-route-bar" />
                  <span className="ticket-route-dot" />
                </div>
                <div className="ticket-city">
                  <span className="ticket-city-name">{route?.arrivalCity || '—'}</span>
                  <span className="ticket-city-time">{formatTime(schedule?.returnTime)}</span>
                </div>
              </div>

              <div className="ticket-info-grid">
                <div className="ticket-info-item">
                  <User size={16} aria-hidden="true" />
                  <span>
                    <strong>{t('ticket.passenger')}</strong>
                    {reservation?.customerName || '—'}
                  </span>
                </div>
                <div className="ticket-info-item">
                  <Calendar size={16} aria-hidden="true" />
                  <span>
                    <strong>{t('ticket.date')}</strong>
                    {formatDate(trip?.departureAt)}
                  </span>
                </div>
                <div className="ticket-info-item">
                  <Armchair size={16} aria-hidden="true" />
                  <span>
                    <strong>{t('ticket.seat')}</strong>
                    {reservation?.seatNumber || '—'}
                  </span>
                </div>
                <div className="ticket-info-item">
                  <CreditCard size={16} aria-hidden="true" />
                  <span>
                    <strong>{t('ticket.amount')}</strong>
                    {formatAmount(reservation?.totalAmount)} {t('common.currency')}
                  </span>
                </div>
                {reservation?.reservationCode && (
                  <div className="ticket-info-item">
                    <TicketIcon size={16} aria-hidden="true" />
                    <span>
                      <strong>{t('ticket.reservationCode')}</strong>
                      {reservation.reservationCode}
                    </span>
                  </div>
                )}
                {bus && (
                  <div className="ticket-info-item">
                    <Bus size={16} aria-hidden="true" />
                    <span>
                      <strong>{t('ticket.bus')}</strong>
                      {bus.brand} {bus.model} — {bus.plateNumber}
                    </span>
                  </div>
                )}
                <div className="ticket-info-item">
                  <TicketIcon size={16} aria-hidden="true" />
                  <span>
                    <strong>{t('ticket.ticketCode')}</strong>
                    {ticket.ticketCode}
                  </span>
                </div>
                {ticket.serialNumber && (
                  <div className="ticket-info-item">
                    <TicketIcon size={16} aria-hidden="true" />
                    <span>
                      <strong>{t('ticket.serialNumber')}</strong>
                      {ticket.serialNumber}
                    </span>
                  </div>
                )}
                {ticket.issuedAt && (
                  <div className="ticket-info-item">
                    <Calendar size={16} aria-hidden="true" />
                    <span>
                      <strong>{t('ticket.issuedAt')}</strong>
                      {formatDate(ticket.issuedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* QR Code & Code de validation */}
              <div className="ticket-qr-section">
                <div className="ticket-qr-info">
                  <strong>{t('ticket.qrCode')}</strong>
                  <div className="ticket-qr-code">{ticket.ticketCode}</div>
                </div>
                <QrCode size={48} aria-hidden="true" className="ticket-qr-icon" />
              </div>

              {/* Action Impression */}
              <div className="ticket-actions">
                <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                  <Printer size={18} aria-hidden="true" />
                  {t('ticket.print')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}