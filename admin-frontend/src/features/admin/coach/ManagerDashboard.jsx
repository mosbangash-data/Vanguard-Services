import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { useLanguage } from '../../i18n'
import { hasPermission } from '../auth/permissions'
import { api } from '../../services/api'

export function ManagerDashboard() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()

  // Données via API dashboard overview (accessible selon permissions)
  const { data: overviewData } = useQuery({
    queryKey: ['manager-dashboard-overview'],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/overview')
      if (!res.data?.success) throw new Error('Erreur dashboard')
      return res.data.data
    },
    enabled: !!user,
  })

  // Données trips pour le manager
  const { data: tripsData, isPending: tripsPending } = useQuery({
    queryKey: ['manager-trips'],
    queryFn: async () => {
      const res = await api.get('/api/trips', { params: { department: 'VANGUARD_COACH' } })
      if (!res.data?.success) throw new Error('Erreur trips')
      return res.data.data?.items || res.data.data || []
    },
    enabled: !!user,
  })

  // Données reservations pour le manager
  const { data: reservationsData, isPending: reservationsPending } = useQuery({
    queryKey: ['manager-reservations'],
    queryFn: async () => {
      const res = await api.get('/api/reservations', { params: { department: 'VANGUARD_COACH' } })
      if (!res.data?.success) throw new Error('Erreur reservations')
      return res.data.data?.items || []
    },
    enabled: !!user,
  })

  // États
  const emptyState = t('dashboard.emptyState') || 'Aucune donnée disponible'
  const errorState = t('dashboard.errorState') || 'Impossible de charger les données'

  if (isPending) return <section className="page"><p>{t('dashboard.loading')}…</p></section>
  if (isError) return <section className="page"><p className="error">{errorState}</p></section>
  if (!user) return null

  // Permissions Manager
  const hasViewTrip = hasPermission(user, 'VIEW_TRIP')
  const hasViewReservation = hasPermission(user, 'VIEW_RESERVATION')
  const hasViewPayment = hasPermission(user, 'VIEW_PAYMENT')
  const hasViewOccupancy = hasPermission(user, 'VIEW_OCCUPANCY')

  // Helper format status
  const formatStatus = (status) => t(`status.${status.toLowerCase()}`) || status

  // En-tête
  const header = (
    <div className="manager-header">
      <h1>{t('manager.dashboardTitle')}</h1>
      {user?.firstName && <p>{t('manager.welcome', { name: user.firstName })}</p>}
    </div>
  )

  // Cartes indicateurs principaux
  const indicatorsSection = overviewData ? (
    <div className="manager-indicators">
      <div className="indicator-card">
        <div className="indicator-icon">{t('icons.trips')}</div>
        <div>
          <strong>{t('manager.todayTrips')}</strong>
          <span>{overviewData?.todayTrips || (tripsData?.length || 0)}</span>
        </div>
      </div>
      <div className="indicator-card">
        <div className="indicator-icon">{t('icons.reservations')}</div>
        <div>
          <strong>{t('manager.todayReservations')}</strong>
          <span>{overviewData?.todayReservations || (reservationsData?.length || 0)}</span>
        </div>
      </div>
      <div className="indicator-card">
        <div className="indicator-icon">{t('icons.passengers')}</div>
        <div>
          <span>{overviewData?.totalPassengers || tripsData?.totalPassengers || 0}</span>
        </div>
      </div>
      <div className="indicator-card">
        <div className="indicator-icon">{t('icons.revenue')}</div>
        <div>
          <span>{overviewData?.revenueTotal || '—'} {overviewData?.currency || 'USD'}</span>
        </div>
      </div>
      <div className="indicator-card">
        <div className="indicator-icon">{t('icons.bus')}</div>
        <div>
          <span>{overviewData?.availableVehicles || '—'} véhicules</span>
        </div>
      </div>
      <div className="indicator-card">
        <div className="indicator-icon">{t('icons.percent')}</div>
        <div>
          <span>{overviewData?.occupancyRate || '—'} %</span>
        </div>
      </div>
    </div>
  ) : (
    <p>{emptyState}</p>
  )

  // Voyages du jour
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
              <th>{t('departure')}</th>
              <th>{t('destination')}</th>
              <th>{t('bus')}</th>
              <th>{t('driver')}</th>
              <th>{t('seats')}</th>
              <th>{t('occupied')}</th>
              <th>{t('occupancyRate')}</th>
              <th>{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {tripsData.map((trip) => (
              <tr key={trip.id}>
                <td>{new Date(trip.departureAt).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR')}</td>
                <td>{trip.schedule?.departureTime || '—'}</td>
                <td>{trip.schedule?.destination || '—'}</td>
                <td>{trip.schedule?.bus?.plateNumber || '—'}</td>
                <td>{trip.schedule?.driver?.name || '—'}</td>
                <td>{trip.seatsTotal || '—'}</td>
                <td>{trip.reservedSeats || 0}</td>
                <td>
                  {trip.seatsTotal > 0 ? Math.round((trip.reservedSeats / trip.seatsTotal) * 100) : 0}%
                </td>
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

  // Occupation des bus
  const occupancySection = hasViewOccupancy ? (
    overviewData ? (
      <div className="manager-occupancy">
        <h2>{t('manager.occupancyTitle')}</h2>
        <div className="occupancy-grid">
          {overviewData?.fleetStatus?.map((bus) => (
            <div key={bus.id} className="occupancy-item">
              <span>{bus.plateNumber || '—'}</span>
              <span>{bus.capacity || '—'}</span>
              <span>{bus.reservedSeats || 0}</span>
              <span>{bus.availableSeats || 0}</span>
              <span>{bus.occupancyRate || '—'}%</span>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <p>{emptyState}</p>
    )
  ) : (
    <p>{t('dashboard.emptyState') || 'Accès refusé : permissions insuffisantes'}</p>
  )

  // Réservations
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
            <span>{t('passenger')}: {res.passengerName || '—'}</span>
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

  // Paiements
  const paymentsSection = hasViewPayment ? (
    overviewData ? (
      <div className="manager-payments">
        <h2>{t('manager.paymentsTitle')}</h2>
        <div className="payments-summary">
          <div>
            <strong>{t('manager.todayRevenue')}</strong>
            <span>{overviewData?.revenueToday || 0} {overviewData?.currency || 'USD'}</span>
          </div>
          <div>
            <strong>{t('manager.paymentsConfirmed')}</strong>
            <span>{overviewData?.paidCount || 0}</span>
          </div>
          <div>
            <strong>{t('manager.paymentsPending')}</strong>
            <span>{overviewData?.pendingCount || 0}</span>
          </div>
        </div>
      </div>
    ) : (
      <p>{emptyState}</p>
    )
  ) : (
    <p>{t('dashboard.emptyState') || 'Accès refusé : permissions insuffisantes'}</p>
  )

  // Alertes points d'attention
  const alertsSection = overviewData ? (
    <div className="manager-alerts">
      <h2>{t('manager.alertsTitle')}</h2>
      <div className="alerts-list">
        {overviewData?.attentionItems?.length > 0 ? (
          overviewData.attentionItems.map((item) => (
            <div key={item.id} className="alert-item">
              <span className="alert-icon">{t('icons.warning')}</span>
              <span>{item.message || '—'}</span>
            </div>
          ))
        ) : null}
      </div>
    </div>
  ) : null

  return (
    <section className="page">
      {header}
      {indicatorsSection}
      {tripsSection}
      {occupancySection}
      {reservationsSection}
      {paymentsSection}
      {alertsSection}
    </section>
  )
}
