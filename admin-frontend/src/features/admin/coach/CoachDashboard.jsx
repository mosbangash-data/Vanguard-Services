import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { useLanguage } from '../../i18n'
import { hasPermission } from '../auth/permissions'
import { api } from '../../services/api'

export function CoachDashboard() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()

  // Données spécifiques Transport via API trips
  const { data: tripsData, isPending: tripsPending } = useQuery({
    queryKey: ['coach-trips'],
    queryFn: async () => {
      const res = await api.get('/api/trips', { params: { department: 'VANGUARD_COACH' } })
      if (!res.data?.success) throw new Error('Erreur trips')
      return res.data.data?.items || res.data.data || []
    },
    enabled: !!user,
  })

  const { data: reservationsData, isPending: reservationsPending } = useQuery({
    queryKey: ['coach-reservations-today'],
    queryFn: async () => {
      const res = await api.get('/api/reservations', { params: { department: 'VANGUARD_COACH', today: true } })
      if (!res.data?.success) throw new Error('Erreur reservations')
      return res.data.data?.items || []
    },
    enabled: !!user,
  })

  const { data: paymentsData, isPending: paymentsPending } = useQuery({
    queryKey: ['coach-payments'],
    queryFn: async () => {
      const res = await api.get('/api/reservation-payments', { params: { department: 'VANGUARD_COACH' } })
      if (!res.data?.success) throw new Error('Erreur paiements')
      return res.data.data || []
    },
    enabled: !!user,
  })

  // États
  const emptyState = t('dashboard.emptyState') || 'Aucune donnée disponible'
  const errorState = t('dashboard.errorState') || 'Impossible de charger les données'

  if (isPending) return <section className="page"><p>{t('dashboard.loading')}…</p></section>
  if (isError) return <section className="page"><p className="error">{errorState}</p></section>
  if (!user) return null

  // Vérification des permissions
  const hasViewTrip = hasPermission(user, 'VIEW_TRIP')
  const hasViewReservation = hasPermission(user, 'VIEW_RESERVATION')
  const hasViewPayment = hasPermission(user, 'VIEW_PAYMENT')

  // Helper pour formater les statuts
  const formatStatus = (status) => t(`status.${status.toLowerCase()}`) || status

  // Section Statistiques - responsive avec grid mobile/desktop
  const statsSection = (
    <div className="stats-grid">
      <article className="stat-card">
        <div className="stat-icon">{t('icons.trips')}</div>
        <div>
          <strong>{t('coach.todayTrips')}</strong>
          <span>{tripsData?.todayCount || 0}</span>
        </div>
      </article>
      <article className="stat-card">
        <div className="stat-icon">{t('icons.reservations')}</div>
        <div>
          <strong>{t('coach.todayReservations')}</strong>
          <span>{reservationsData?.length || 0}</span>
        </div>
      </article>
      <article className="stat-card">
        <div className="stat-icon">{t('icons.passengers')}</div>
        <div>
          <span>{tripsData?.totalPassengers || 0}</span>
        </div>
      </article>
      <article className="stat-card">
        <div className="stat-icon">{t('icons.revenue')}</div>
        <div>
          <span>{paymentsData?.revenueTotal || 0} {paymentsData?.currency || 'USD'}</span>
        </div>
      </article>
    </div>
  )

  // Section Voyages du jour
  const tripsSection = hasViewTrip ? (
    tripsPending ? (
      <p>{t('dashboard.loading')}…</p>
    ) : tripsData?.length === 0 ? (
      <p>{emptyState}</p>
    ) : (
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>{t('time')}</th>
              <th>{t('route')}</th>
              <th>{t('bus')}</th>
              <th>{t('driver')}</th>
              <th>{t('seatsReserved')}</th>
              <th>{t('seatsAvailable')}</th>
              <th>{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {tripsData.map((trip) => (
              <tr key={trip.id}>
                <td>{new Date(trip.departureAt).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR')}</td>
                <td>{trip.schedule?.route || '—'}</td>
                <td>{trip.schedule?.bus?.plateNumber || '—'}</td>
                <td>{trip.schedule?.driver?.name || '—'}</td>
                <td>{trip.reservedSeats || 0}</td>
                <td>{trip.availableSeats || 0}</td>
                <td>
                  <span className={`status-${trip.status.toLowerCase()}`}>
                    {formatStatus(trip.status)}
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

  // Section Réservations récentes
  const reservationsSection = hasViewReservation ? (
    reservationsPending ? (
      <p>{t('dashboard.loading')}…</p>
    ) : reservationsData?.length === 0 ? (
      <p>{emptyState}</p>
    ) : (
      <div className="recent-reservations">
        {reservationsData.map((res) => (
          <div key={res.id} className="reservation-item">
            <span>{res.code || res.id}</span>
            <span>{res.passengerName || '—'}</span>
            <span>{t('trip')}: {res.tripId || '—'}</span>
            <span>{t('date')}: {res.createdAt ? new Date(res.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR') : '—'}</span>
            <span>{t('seat')}: {res.seatNumber || '—'}</span>
            <span className={`status-${res.status.toLowerCase()}`}>
              {formatStatus(res.status)}
            </span>
          </div>
        ))}
      </div>
    )
  ) : (
    <p>{t('dashboard.emptyState') || 'Accès refusé : permissions insuffisantes'}</p>
  )

  // Section Paiements
  const paymentsSection = hasViewPayment ? (
    paymentsPending ? (
      <p>{t('dashboard.loading')}…</p>
    ) : paymentsData?.length === 0 ? (
      <p>{emptyState}</p>
    ) : (
      <div>
        <p>{t('coach.todayRevenue')}: {paymentsData?.revenueToday || 0} {paymentsData?.currency || 'USD'}</p>
        <p>{t('coach.paymentsPaid')}: {paymentsData?.paidCount || 0}</p>
        <p>{t('coach.paymentsPending')}: {paymentsData?.pendingCount || 0}</p>
      </div>
    )
  ) : (
    <p>{t('dashboard.emptyState') || 'Accès refusé : permissions insuffisantes'}</p>
  )

  return (
    <section className="page">
      <h1>{t('coach.dashboardTitle')} {user?.firstName}</h1>
      {statsSection}
      {tripsSection}
      {reservationsSection}
      {paymentsSection}
    </section>
  )
}
