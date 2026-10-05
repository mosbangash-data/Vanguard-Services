import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { api } from '../../../services/api'
import { useLanguage } from '../../../i18n/useLanguage'
import { ErrorState, LoadingState, StatusBadge } from '../../../components/ui'
import { printTicket } from './ticketPrint'

const formatDate = (value, lang) => value
  ? new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
  : '—'

export function TicketDetailPage() {
  const { ticketCode } = useParams()
  const { lang, t } = useLanguage()
  const [format, setFormat] = useState('80mm')
  const [printError, setPrintError] = useState('')
  const [printing, setPrinting] = useState(false)
  const ticketQuery = useQuery({
    queryKey: ['agent-ticket-detail', ticketCode],
    queryFn: async () => (await api.get(`/api/tickets/${encodeURIComponent(ticketCode)}`)).data?.data?.ticket,
    enabled: Boolean(ticketCode),
  })

  if (ticketQuery.isPending) return <section className="page"><LoadingState message={t('ticket.loading')} /></section>
  if (ticketQuery.isError || !ticketQuery.data) {
    const status = ticketQuery.error?.response?.status
    const message = status === 403 ? t('ticket.accessDenied') : status === 404 ? t('ticket.notFound') : t('ticket.loadFailed')
    return <section className="page"><ErrorState title={t('ticket.title')} message={message} onRetry={ticketQuery.refetch} /></section>
  }

  const ticket = ticketQuery.data
  const reservation = ticket.reservation
  const trip = reservation?.trip
  const route = trip?.schedule?.route
  const paidPayment = reservation?.payments?.find((payment) => ['VERIFIED', 'COMPLETED'].includes(payment.status))
  return (
    <main className="page ticket-detail-page">
      <div className="ticket-detail-toolbar">
        <Link className="button secondary" to="/transport/tickets"><ArrowLeft size={16} />{t('ticket.backToTickets')}</Link>
        <label className="ticket-detail-format">{t('operations.printFormat')}
          <select value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="a4">A4</option><option value="58mm">58 mm</option><option value="80mm">80 mm</option><option value="110mm">110 mm</option>
          </select>
        </label>
        <button type="button" className="button" onClick={async () => {
          if (printing) return
          setPrinting(true)
          setPrintError('')
          try { await printTicket(ticket.ticketCode, format) } catch { setPrintError(t('ticket.printFailed')) } finally { setPrinting(false) }
        }} disabled={printing}><Printer size={16} />{printing ? t('ticket.printing') : t('ticket.print')}</button>
      </div>
      {printError && <p className="alert alert-danger" role="alert">{printError}</p>}
      <article className="ticket-detail-card">
        <header className="ticket-detail-brand">
          <img src={`${import.meta.env.BASE_URL}assets/logos/vanguard-admin-logo.svg`} alt={t('ticket.logoAlt')} />
          <div><strong>VANGUARD SERVICES</strong><span>VANGUARD COACH</span></div>
          <StatusBadge status={ticket.status} />
        </header>
        <h1>{t('ticket.title')} · <code>{ticket.ticketCode}</code></h1>
        <section className="ticket-detail-route" aria-label={t('ticket.route')}>
          <strong>{route?.departureCity || '—'}</strong><span aria-hidden="true">→</span><strong>{route?.arrivalCity || '—'}</strong>
        </section>
        <div className="ticket-detail-data">
          <p><strong>{t('ticket.passenger')}:</strong> {reservation?.customerName || '—'}</p>
          <p><strong>{t('ticket.phone')}:</strong> {reservation?.customerPhone || '—'}</p>
          <p><strong>{t('ticket.departure')}:</strong> {formatDate(trip?.departureAt, lang)}</p>
          <p><strong>{t('ticket.seat')}:</strong> {reservation?.seatNumber || '—'}</p>
          <p><strong>{t('ticket.reservationCode')}:</strong> {reservation?.reservationCode || '—'}</p>
          <p><strong>{t('ticket.amountPaid')}:</strong> {reservation?.totalAmount ?? '—'} {paidPayment?.currency || 'USD'}</p>
        </div>
        {ticket.qrDataUrl
          ? <figure className="ticket-detail-qr"><img src={ticket.qrDataUrl} alt={t('ticket.qrCode')} /><figcaption>{t('ticket.showQrAtBoarding')}</figcaption></figure>
          : <p className="alert alert-danger" role="alert">{t('ticket.qrUnavailable')}</p>}
        <footer>{t('ticket.keepTicketInfo')}</footer>
      </article>
    </main>
  )
}
