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
  const [printFormat, setPrintFormat] = useState('80mm')
  const [printError, setPrintError] = useState('')
  const ticket = data?.ticket
  const reservation = ticket?.reservation
  const trip = reservation?.trip
  const schedule = trip?.schedule
  const route = schedule?.route
  const paid = ticket?.isPaid === true || isPaid(reservation?.payments)
  const ticketStatus = ticket?.status === 'USED' ? 'UTILISÉ' : ticket?.status === 'CANCELLED' ? 'ANNULÉ' : paid ? 'PAYÉ / VALIDE' : 'EN ATTENTE'

  const printTicket = async () => {
    setPrintError('')
    try {
      await api.recordTicketPrint(ticketCode, { format: printFormat })
      document.body.dataset.ticketFormat = printFormat
      window.print()
    } catch {
      setPrintError(t('ticket.printUnavailable'))
    }
  }

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
        <div className="ticket-print-controls">
          <label htmlFor="ticket-print-format">Format</label>
          <select id="ticket-print-format" value={printFormat} onChange={(event) => setPrintFormat(event.target.value)}>
            <option value="58mm">Thermique 58 mm</option>
            <option value="80mm">Thermique 80 mm</option>
            <option value="110mm">Thermique 110 mm</option>
            <option value="a4">A4</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={printTicket}>
            <Printer size={18} /> Imprimer le billet
          </button>
          <small>Utilisez le service d’impression de l’appareil pour une imprimante Bluetooth ou intégrée.</small>
        </div>
        {printError && <p role="alert" className="ticket-print-error">{printError}</p>}
      </div>

      <article className={`ticket-printable ticket--${printFormat}`} aria-label="Billet de voyage Vanguard Coach">
        <header className="ticket-print-header">
          <img src="/assets/transport/logo.jpeg" alt="Logo Vanguard Services" />
          <div><strong>VANGUARD SERVICES</strong><span>VANGUARD COACH</span></div>
          <span className={`ticket-payment-status ${ticket?.status === 'VALID' && paid ? 'is-paid' : 'is-pending'}`}>{ticketStatus}</span>
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

        {(reservation?.customerName || reservation?.customerPhone) && <section className="ticket-print-passenger">
          <span>PASSAGER</span><strong>{reservation?.customerName || '—'}</strong>
          {reservation?.customerPhone && <small>{reservation.customerPhone}</small>}
        </section>}

        <section className="ticket-print-details">
          <div><span>SIÈGE</span><strong>{reservation?.seatNumber || '—'}</strong></div>
          <div><span>BILLET</span><strong>{ticket.ticketCode}</strong></div>
        </section>

        <section className="ticket-print-qr" aria-label="QR code du billet">
          {qrImage ? <img src={qrImage} alt={`QR code pour ${ticket.ticketCode}`} /> : <span>QR indisponible</span>}
          <small>Présentez ce code à l’agent au départ</small>
        </section>

        <footer className="ticket-print-footer">
          {ticket.issuedAt && <span>ÉMIS LE {formatDate(ticket.issuedAt)}</span>}
          <strong>{ticketStatus}</strong>
          {schedule?.bus?.plateNumber && <span>{schedule.bus.plateNumber}</span>}
        </footer>
      </article>
    </main>
  )
}
