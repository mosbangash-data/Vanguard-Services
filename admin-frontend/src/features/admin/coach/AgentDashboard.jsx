import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/authContext'
import { useLanguage } from '../../../i18n'
import { hasPermission } from '../../auth/permissions'
import { api } from '../../../services/api'
import { TicketScanner } from './TicketScanner'

export function AgentDashboard() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const [showScanner, setShowScanner] = useState(false)

  // Données trips pour l'agent
  const { data: tripsData, isPending: tripsPending, isError: tripsError } = useQuery({
    queryKey: ['agent-trips'],
    queryFn: async () => {
      const res = await api.get('/api/trips', { params: { department: 'VANGUARD_COACH' } })
      if (!res.data?.success) throw new Error('Erreur trips')
      return res.data.data?.items || res.data.data || []
    },
    enabled: !!user,
  })

  // Données reservations pour l'agent
  const { data: reservationsData, isPending: reservationsPending, isError: reservationsError } = useQuery({
    queryKey: ['agent-reservations'],
    queryFn: async () => {
      const res = await api.get('/api/reservations', { params: { department: 'VANGUARD_COACH' } })
      if (!res.data?.success) throw new Error('Erreur reservations')
      return res.data.data?.items || []
    },
    enabled: !!user,
  })

  // Données paiements si permission VIEW_PAYMENT
  const hasViewPayment = hasPermission(user, 'VIEW_PAYMENT')
  const { data: paymentsData, isPending: paymentsPending, isError: paymentsError } = useQuery({
    queryKey: ['agent-payments'],
    queryFn: async () => {
      if (!hasViewPayment) return { payments: [] }
      const res = await api.get('/api/reservation-payments', { params: { department: 'VANGUARD_COACH', status: 'PENDING' } })
      if (!res.data?.success) throw new Error('Erreur paiements')
      return res.data.data || { payments: [] }
    },
    enabled: !!user && hasViewPayment,
  })

  // Normalisation des listes
  const tripsList = Array.isArray(tripsData) ? tripsData : (tripsData?.items || [])
  const reservationsList = Array.isArray(reservationsData) ? reservationsData : (reservationsData?.items || [])
  const paymentsList = paymentsData?.payments || (Array.isArray(paymentsData) ? paymentsData : [])

  // États
  const emptyState = t('dashboard.emptyState') || 'Aucune donnée disponible'
  const errorState = t('dashboard.errorState') || 'Impossible de charger les données'

  const isPending = tripsPending || reservationsPending || (hasViewPayment && paymentsPending)
  const isError = tripsError || reservationsError || (hasViewPayment && paymentsError)

  if (isPending) return <section className="page"><p>{t('dashboard.loading')}…</p></section>
  if (isError) return <section className="page"><p className="error">{errorState}</p></section>
  if (!user) return null

  // Permissions Agent
  const hasViewTrip = hasPermission(user, 'VIEW_TRIP')
  const hasViewReservation = hasPermission(user, 'VIEW_RESERVATION')

  // Helper format status
  const formatStatus = (status) => t(`status.${status.toLowerCase()}`) || status

  // En-tête Agent
  const header = (
    <div className="agent-header">
      <h1>{t('agent.dashboardTitle')}</h1>
      {user?.firstName && <p>{t('agent.welcome', { name: user.firstName })}</p>}
    </div>
  )

  // Actions rapides
  const quickActions = (
    <div className="agent-actions">
      <h2>{t('agent.quickActions')}</h2>
      <div className="agent-actions__grid">
        <button type="button" className="button" onClick={() => setShowScanner(true)}>
          {t('agent.scanTicket')}
        </button>
        <a href="/transport/tickets" className="button secondary">
          {t('agent.viewTicket')}
        </a>
      </div>
    </div>
  )

  // Statistiques Agent - simples et utiles
  const indicatorsSection = tripsList ? (
    <div className="agent-indicators">
      <div className="indicator-card">
        <div className="indicator-icon">{t('icons.trips')}</div>
        <div>
          <strong>{t('agent.todayTrips')}</strong>
          <span>{tripsList.length}</span>
        </div>
      </div>
      <div className="indicator-card">
        <div className="indicator-icon">{t('icons.reservations')}</div>
        <div>
          <strong>{t('agent.todayReservations')}</strong>
          <span>{reservationsList.length}</span>
        </div>
      </div>
      <div className="indicator-card">
        <div className="indicator-icon">{t('icons.passengers')}</div>
        <div>
          <span>{reservationsList.length}</span>
        </div>
      </div>
      {hasViewPayment && (
        <div className="indicator-card">
          <div className="indicator-icon">{t('icons.payment')}</div>
          <div>
            <span>{t('agent.paymentsPending')}</span>
            <span>{paymentsList.length}</span>
          </div>
        </div>
      )}
    </div>
  ) : (
    <p>{emptyState}</p>
  )

  // Voyages du jour
  const tripsSection = hasViewTrip ? (
    tripsPending ? (
      <p>{t('dashboard.loading')}…</p>
    ) : tripsList.length === 0 ? (
      <p>{emptyState}</p>
    ) : (
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>{t('time')}</th>
              <th>{t('departure')}</th>
              <th>{t('destination')}</th>
              <th>{t('bus')}</th>
              <th>{t('seats')}</th>
              <th>{t('statusLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {tripsList.map((trip) => (
              <tr key={trip.id}>
                <td>{new Date(trip.departureAt).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR')}</td>
                <td>{trip.schedule?.route?.departureCity || trip.schedule?.departureTime || '—'}</td>
                <td>{trip.schedule?.route?.arrivalCity || '—'}</td>
                <td>{trip.schedule?.bus?.plateNumber || '—'}</td>
                <td>{trip.schedule?.bus?.seats || '—'}</td>
                <td>
                  <span className={`status-${(trip.status || '').toLowerCase()}`}>
                    {formatStatus(trip.status || 'SCHEDULED')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  ) : (
    <p>{t('dashboard.emptyState') || 'Accès refusé : permissions insuffisantes'}</p>
  )

  // Reservations à traiter
  const reservationsSection = hasViewReservation ? (
    reservationsPending ? (
      <p>{t('dashboard.loading')}…</p>
    ) : reservationsList.length === 0 ? (
      <p>{emptyState}</p>
    ) : (
      <div className="recent-reservations">
        {reservationsList.map((res) => (
          <div key={res.id} className="reservation-item">
            <span>{res.reservationCode || res.code || res.id}</span>
            <span>{t('passenger')}: {res.customerName || res.passengerName || '—'}</span>
            <span>{t('trip')}: {res.tripId || '—'}</span>
            <span>{t('date')}: {res.createdAt ? new Date(res.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR') : '—'}</span>
            <span>{t('seat')}: {res.seatNumber || '—'}</span>
            <span className={`status-${(res.status || '').toLowerCase()}`}>
              {formatStatus(res.status || 'PENDING')}
            </span>
          </div>
        ))}
      </div>
    )
  ) : (
    <p>{t('dashboard.emptyState') || 'Accès refusé : permissions insuffisantes'}</p>
  )

  // Paiements à traiter (uniquement si permission VIEW_PAYMENT)
  const paymentsSection = hasViewPayment ? (
    paymentsPending ? (
      <p>{t('dashboard.loading')}…</p>
    ) : paymentsList.length === 0 ? (
      <p>{emptyState}</p>
    ) : (
      <div className="payments-section">
        <h2>{t('agent.paymentsTitle')}</h2>
        {paymentsList.length > 0 ? (
          paymentsList.map((pay) => (
            <div key={pay.id} className="payment-item">
              <span>{t('amount')}: {pay.amount || '—'} {pay.currency || 'USD'}</span>
              <span>{t('reservation')}: {pay.reservation?.reservationCode || pay.reservationId || '—'}</span>
              <span>{t('passenger')}: {pay.reservation?.customerName || pay.passengerName || '—'}</span>
              <span className={`status-${(pay.status || '').toLowerCase()}`}>
                {formatStatus(pay.status || 'PENDING')}
              </span>
            </div>
          ))
        ) : (
          <p>{t('agent.noPayments')}</p>
        )}
      </div>
    )
  ) : null

  return (
    <section className="page">
      {header}
      {quickActions}
      {indicatorsSection}
      {tripsSection}
      {reservationsSection}
      {paymentsSection}
      {showScanner && <TicketScanner onClose={() => setShowScanner(false)} />}
    </section>
  )
}