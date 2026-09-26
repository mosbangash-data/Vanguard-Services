import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { Printer, ArrowLeft } from 'lucide-react'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState } from '../components/StateView'
import { translateError } from '../utils/errors'
import { useLanguage } from '../i18n/LanguageProvider'
import './Ticket.css'

const isPaid = (payments = []) => payments.some((payment) =>
  ['VERIFIED', 'COMPLETED'].includes(payment.status))

export default function Ticket() {
  const { ticketCode } = useParams()
  const { t } = useLanguage()
  const { data, loading, error, execute } = useFetch(() => api.getTicket(ticketCode), { deps: [ticketCode] })
  const [qrImage, setQrImage] = useState('')
  const ticket = data?.ticket
  const reservation = ticket?.reservation
  const trip = reservation?.trip
  const schedule = trip?.schedule
  const route = schedule?.route
  const paid = isPaid(reservation?.payments)

  useEffect(() => {
    let active = true
    if (!ticket?.qrCode) {
      setQrImage('')
      return () => { active = false }
    }
    QRCode.toDataURL(ticket.qrCode, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#10233f', light: '#ffffff' },
    }).then((image) => { if (active) setQrImage(image) })
      .catch(() => { if (active) setQrImage('') })
    return () => { active = false }
  }, [ticket?.qrCode])

  const formatDate = (date) => date
    ? new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : '—'

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={translateError(error, t)} onRetry={execute} />
  if (!ticket) return <ErrorState message={t('ticket.notFoundMessage')} onRetry={execute} />

  return (
    <main className="ticket-page">
      <div className="ticket-page-actions">
        <Link to="/transport" className="ticket-back"><ArrowLeft size={16} /> Retour aux réservations</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={18} /> Imprimer le billet
        </button>
      </div>

      <article className="ticket-printable" aria-label="Billet de voyage Vanguard Coach">
        <header className="ticket-print-header">
          <img src="/assets/logos/vanguard-mark.svg" alt="" width="38" height="38" />
          <div><strong>VANGUARD SERVICES</strong><span>COACH</span></div>
          <span className={`ticket-payment-status ${paid ? 'is-paid' : 'is-pending'}`}>{paid ? 'PAYÉ' : 'EN ATTENTE'}</span>
        </header>

        <section className="ticket-print-route">
          <div><span>DÉPART</span><strong>{route?.departureCity || '—'}</strong></div>
          <span className="ticket-route-arrow" aria-hidden="true">→</span>
          <div><span>DESTINATION</span><strong>{route?.arrivalCity || '—'}</strong></div>
        </section>
        <section className="ticket-print-times">
          <div><span>DATE DU VOYAGE</span><strong>{formatDate(trip?.departureAt)}</strong></div>
          <div><span>DÉPART</span><strong>{schedule?.departureTime || '—'}</strong></div>
        </section>

        <section className="ticket-print-passenger">
          <span>PASSAGER</span><strong>{reservation?.customerName || '—'}</strong>
          {reservation?.customerPhone && <small>{reservation.customerPhone}</small>}
        </section>

        <section className="ticket-print-details">
          <div><span>SIÈGE</span><strong>{reservation?.seatNumber || '—'}</strong></div>
          <div><span>RÉSERVATION</span><strong>{reservation?.reservationCode || '—'}</strong></div>
          <div><span>BILLET</span><strong>{ticket.ticketCode}</strong></div>
        </section>

        <section className="ticket-print-qr" aria-label="QR code du billet">
          {qrImage ? <img src={qrImage} alt={`QR code pour ${ticket.ticketCode}`} /> : <span>QR indisponible</span>}
          <small>Présentez ce code à l’agent au départ</small>
        </section>

        <footer className="ticket-print-footer">
          {ticket.issuedAt && <span>ÉMIS LE {formatDate(ticket.issuedAt)}</span>}
          <strong>{paid ? 'PAIEMENT VALIDÉ' : 'PAIEMENT EN ATTENTE'}</strong>
          {schedule?.bus?.plateNumber && <span>{schedule.bus.plateNumber}</span>}
        </footer>
      </article>
    </main>
  )
}
