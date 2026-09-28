import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api } from '../services/api'
import { useLanguage } from '../i18n/useLanguage'
export function ForbiddenPage() { const { t } = useLanguage(); return <main className="center-page"><h1>403 — {t('publicUi.forbidden')}</h1><p>{t('publicUi.forbiddenMessage')}</p><Link to="/">{t('publicUi.back')}</Link></main> }
export function NotFoundPage() { const { t } = useLanguage(); return <main className="center-page"><h1>{t('publicUi.pageNotFound')}</h1><Link to="/">{t('publicUi.backHome')}</Link></main> }
export function PublicTicketPage() {
	const { t, lang } = useLanguage()
	const { ticketCode } = useParams()
	const { data, isPending, isError } = useQuery({
		queryKey: ['public-ticket', ticketCode],
		queryFn: async () => (await api.get(`/tickets/${ticketCode}`)).data?.data,
	})
	const ticket = data?.ticket
	const reservation = ticket?.reservation
	const trip = reservation?.trip
	const route = trip?.schedule?.route

	return (
		<main className="public-page">
			<h1>{t('publicUi.ticket')}</h1>
			{isPending ? <p>{t('publicUi.loading')}</p> : isError || !ticket ? <p>{t('publicUi.ticketNotFound')}</p> : (
				<section className="card" aria-label={t('publicUi.ticketInfo')}>
					<p><strong>{t('publicUi.ticketCode')}:</strong> {ticket.ticketCode || '—'}</p>
					<p><strong>{t('publicUi.status')}:</strong> {ticket.status ? t(`status.${String(ticket.status).toLowerCase()}`) : '—'}</p>
					<p><strong>{t('publicUi.passenger')}:</strong> {reservation?.customerName || '—'}</p>
					<p><strong>{t('publicUi.seat')}:</strong> {reservation?.seatNumber || '—'}</p>
					<p><strong>{t('publicUi.route')}:</strong> {route ? `${route.departureCity || '—'} → ${route.arrivalCity || '—'}` : '—'}</p>
					<p><strong>{t('publicUi.departure')}:</strong> {trip?.departureAt ? new Date(trip.departureAt).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR') : '—'}</p>
				</section>
			)}
		</main>
	)
}
