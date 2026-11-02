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

  const pad2 = (n) => String(n).padStart(2, '0')
  const formatTravelDate = (dateVal) => {
    if (!dateVal) return '—'
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return '—'
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
  }
  const formatDateTime = (dateVal) => {
    if (!dateVal) return '—'
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return '—'
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }
  const busLabel = schedule?.bus?.plateNumber || (schedule?.bus?.brand ? `${schedule.bus.brand} ${schedule.bus.model || ''}`.trim() : '')
  const currency = reservation?.payments?.[0]?.currency || 'USD'
  const travelDateFormatted = formatTravelDate(trip?.departureAt)
  const issuedDateFormatted = formatDateTime(ticket?.issuedAt || ticket?.createdAt)

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
        {/* Logo Vanguard Coach */}
        <header className="ticket-logo-header">
          <img src="/assets/transport/logo.png" alt="Vanguard Coach" className="ticket-logo-img" />
        </header>

        <div className="ticket-dashed-divider"></div>

        {/* Bannière Billet de Transport */}
        <div className="ticket-title-banner">BILLET DE TRANSPORT</div>
        <div className="ticket-number">N° {ticket.ticketCode}</div>

        <div className="ticket-dashed-divider"></div>

        {/* Section Trajet */}
        <section className="ticket-route-section" aria-label="Trajet">
          <div className="ticket-city ticket-city--departure">{route?.departureCity || '—'}</div>
          <div className="ticket-route-arrow" aria-hidden="true">&#9660;</div>
          <div className="ticket-city ticket-city--arrival">{route?.arrivalCity || '—'}</div>
        </section>

        <div className="ticket-dashed-divider"></div>

        {/* Détails du voyage */}
        <section className="ticket-details-table" aria-label="Détails du voyage">
          <div className="ticket-detail-row">
            <span className="ticket-detail-label">Date</span>
            <span className="ticket-detail-value">{travelDateFormatted}</span>
          </div>
          <div className="ticket-detail-row">
            <span className="ticket-detail-label">Départ</span>
            <span className="ticket-detail-value">{schedule?.departureTime || '—'}</span>
          </div>
          <div className="ticket-detail-row">
            <span className="ticket-detail-label">Siège</span>
            <span className="ticket-detail-value">{reservation?.seatNumber || '—'}</span>
          </div>
          {busLabel && (
            <div className="ticket-detail-row">
              <span className="ticket-detail-label">Bus</span>
              <span className="ticket-detail-value">{busLabel}</span>
            </div>
          )}
          {ticket.class && (
            <div className="ticket-detail-row">
              <span className="ticket-detail-label">Classe</span>
              <span className="ticket-detail-value">{ticket.class}</span>
            </div>
          )}
          <div className="ticket-passenger-block">
            <span className="ticket-detail-label">Passager</span>
            <div className="ticket-passenger-name">{reservation?.customerName || '—'}</div>
            {reservation?.customerPhone && (
              <div className="ticket-passenger-phone">{reservation.customerPhone}</div>
            )}
          </div>
        </section>

        {/* Cadre Prix */}
        <section className="ticket-price-box" aria-label="Prix du billet">
          <span className="ticket-price-label">PRIX</span>
          <span className="ticket-price-value">{reservation?.totalAmount != null ? reservation.totalAmount : '—'} {currency}</span>
        </section>

        {/* Instruction QR */}
        <div className="ticket-qr-instruction">SCANNEZ À L'EMBARQUEMENT</div>

        {/* QR Code */}
        <div className="ticket-qr" role="img" aria-label="QR code du billet">
          {qrImage ? <img src={qrImage} alt={`QR code pour ${ticket.ticketCode}`} /> : <span>QR indisponible</span>}
        </div>

        {/* Mentions légales / consignes */}
        <div className="ticket-notes">
          <div>Présentez ce billet au contrôleur.</div>
          <div>Non remboursable · Non échangeable</div>
          <div>Bagages sous la responsabilité du voyageur</div>
        </div>

        <div className="ticket-dashed-divider"></div>

        {/* Pied de billet */}
        <footer className="ticket-footer">
          <div>Merci de voyager avec</div>
          <div className="ticket-footer-brand">VANGUARD COACH</div>
          {issuedDateFormatted !== '—' && (
            <div className="ticket-footer-issued">Émis le {issuedDateFormatted}</div>
          )}
        </footer>
      </article>
    </main>
  )
}
