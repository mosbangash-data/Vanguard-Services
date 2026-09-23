import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, CreditCard, Package, QrCode, Ticket, UserRoundPlus } from 'lucide-react'
import { useAuth } from '../../auth/authContext'
import { useLanguage } from '../../../i18n/useLanguage'
import { hasPermission } from '../../auth/permissions'
import { api } from '../../../services/api'
import { TicketScanner } from './TicketScanner'

export function AgentDashboard() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const [showScanner, setShowScanner] = useState(false)

  const canViewTrips = hasPermission(user, 'VIEW_TRIP')
  const canViewReservations = hasPermission(user, 'VIEW_RESERVATION')
  const canViewPayments = hasPermission(user, 'VIEW_PAYMENT')
  const canCreateReservations = hasPermission(user, 'CREATE_RESERVATION')
  const canCreateParcels = hasPermission(user, 'CREATE_PARCEL')
  const canViewParcels = hasPermission(user, 'VIEW_PARCEL')
  const canScanTickets = hasPermission(user, 'SCAN_TICKET')

  const tripsQuery = useQuery({
    queryKey: ['agent-workspace-trips', user?.id],
    queryFn: async () => {
      const res = await api.get('/api/trips', { params: { page: 1, limit: 100 } })
      if (!res.data?.success) throw new Error('Erreur trips')
      return res.data.data?.items || res.data.data || []
    },
    enabled: !!user && canViewTrips,
  })

  const reservationsQuery = useQuery({
    queryKey: ['agent-workspace-reservations', user?.id],
    queryFn: async () => {
      const res = await api.get('/api/reservations', { params: { page: 1, limit: 100 } })
      if (!res.data?.success) throw new Error('Erreur reservations')
      return res.data.data?.items || []
    },
    enabled: !!user && canViewReservations,
  })

  const paymentsQuery = useQuery({
    queryKey: ['agent-workspace-payments', user?.id],
    queryFn: async () => {
      const res = await api.get('/api/reservation-payments', { params: { status: 'PENDING', page: 1, limit: 100 } })
      if (!res.data?.success) throw new Error('Erreur paiements')
      return res.data.data || { payments: [] }
    },
    enabled: !!user && canViewPayments,
  })

  const trips = tripsQuery.data || []
  const reservations = reservationsQuery.data || []
  const payments = paymentsQuery.data?.payments || []
  const today = new Date()
  const todayTrips = useMemo(() => trips.filter((trip) => {
    const date = new Date(trip.departureAt)
    return date.toDateString() === today.toDateString()
  }).sort((left, right) => new Date(left.departureAt) - new Date(right.departureAt)), [trips])
  const pendingReservations = reservations.filter((reservation) => reservation.status === 'PENDING')
  const nextTrip = todayTrips.find((trip) => new Date(trip.departureAt) >= new Date())
  const formatTime = (value) => new Date(value).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })
  const formatStatus = (status) => t(`status.${String(status || '').toLowerCase()}`) || status
  const isLoading = (canViewTrips && tripsQuery.isPending)
    || (canViewReservations && reservationsQuery.isPending)
    || (canViewPayments && paymentsQuery.isPending)
  const hasError = (canViewTrips && tripsQuery.isError)
    || (canViewReservations && reservationsQuery.isError)
    || (canViewPayments && paymentsQuery.isError)

  const quickActions = [
    canScanTickets && { label: t('agent.scanTicket'), icon: QrCode, action: () => setShowScanner(true) },
    canCreateReservations && { label: t('agent.newReservation'), icon: UserRoundPlus, to: '/transport/reservations' },
    canViewPayments && { label: t('agent.processPayments'), icon: CreditCard, to: '/transport/operations' },
    canCreateParcels && { label: t('agent.registerParcel'), icon: Package, to: '/transport/parcels' },
    canViewReservations && { label: t('agent.searchReservation'), icon: Ticket, to: '/transport/reservations' },
    canViewReservations && { label: t('agent.searchTicket'), icon: Ticket, to: '/transport/operations' },
  ].filter(Boolean)

  if (!user) return null
  return (
    <section className="page agent-workspace">
      <div className="agent-header">
        <div>
          <p className="eyebrow">{t('agent.workspaceEyebrow')}</p>
          <h1>{t('agent.dashboardTitle')}</h1>
          <p>{t('agent.welcome', { name: user.firstName })} · {t('agent.workspaceIntro')}</p>
        </div>
        <span className="badge active">{t('agent.active')}</span>
      </div>

      <section className="agent-actions">
        <div className="section-heading"><div><h2>{t('agent.quickActions')}</h2><p>{t('agent.frequentTasks')}</p></div></div>
        <div className="agent-actions__grid">
          {quickActions.map(({ label, icon: Icon, to, action }) => to ? <Link key={label} to={to} className="button"><Icon size={16} />{label}</Link> : <button key={label} type="button" className="button" onClick={action}><Icon size={16} />{label}</button>)}
        </div>
      </section>

      {isLoading && <div className="state-container">{t('agent.loadingWorkspace')}</div>}
      {hasError && <div className="state-container"><p className="error">{t('agent.workspaceError')}</p></div>}

      {!isLoading && !hasError && <>
        <div className="dashboard-stats-grid">
          <article className="stat-card"><CalendarDays size={22} /><div><span>{t('agent.todayTripsLabel')}</span><strong>{todayTrips.length}</strong></div></article>
          <article className="stat-card"><Ticket size={22} /><div><span>{t('agent.reservationsToProcess')}</span><strong>{pendingReservations.length}</strong></div></article>
          <article className="stat-card"><CreditCard size={22} /><div><span>{t('agent.paymentsPending')}</span><strong>{payments.length}</strong></div></article>
          <article className="stat-card"><CheckCircle2 size={22} /><div><span>{t('agent.nextDeparture')}</span><strong>{nextTrip ? formatTime(nextTrip.departureAt) : '—'}</strong></div></article>
        </div>

        <div className="dashboard-content-grid">
          <section className="dashboard-panel">
            <div className="section-heading"><div><h2>{t('agent.upcomingDepartures')}</h2><p>{t('agent.prepareBoarding')}</p></div><Link to="/transport/trips" className="button secondary sm">{t('agent.viewTrips')}</Link></div>
            {todayTrips.length === 0 ? <p className="empty">{t('agent.noDepartures')}</p> : <div className="table-responsive"><table className="data-table"><thead><tr><th>Heure</th><th>Trajet</th><th>Bus</th><th>Occupation</th><th>Statut</th></tr></thead><tbody>{todayTrips.slice(0, 6).map((trip) => { const occupied = reservations.filter((reservation) => reservation.tripId === trip.id && reservation.status !== 'CANCELLED').length; const seats = trip.schedule?.bus?.seats || 0; return <tr key={trip.id}><td><strong>{formatTime(trip.departureAt)}</strong></td><td>{trip.schedule?.route?.departureCity || '—'} → {trip.schedule?.route?.arrivalCity || '—'}</td><td>{trip.schedule?.bus?.plateNumber || '—'}</td><td>{occupied}/{seats || '—'} places</td><td><span className={`badge ${trip.status === 'IN_PROGRESS' ? 'warning' : 'info'}`}>{formatStatus(trip.status)}</span></td></tr> })}</tbody></table></div>}
          </section>
          <section className="dashboard-panel">
            <div className="section-heading"><div><h2>{t('agent.processNow')}</h2><p>{t('agent.agencyPriorities')}</p></div></div>
            <div className="agent-task-list">
              {canViewPayments && <Link to="/transport/operations" className="agent-task"><CreditCard size={18} /><span><strong>{t('agent.paymentCount', { count: payments.length })}</strong><small>{t('agent.paymentHint')}</small></span><span className="task-arrow">→</span></Link>}
              {canViewReservations && <Link to="/transport/reservations" className="agent-task"><Ticket size={18} /><span><strong>{t('agent.reservationCount', { count: pendingReservations.length })}</strong><small>{t('agent.reservationHint')}</small></span><span className="task-arrow">→</span></Link>}
              {canViewParcels && <Link to="/transport/parcels" className="agent-task"><Package size={18} /><span><strong>{t('agent.parcelManagement')}</strong><small>{t('agent.parcelHint')}</small></span><span className="task-arrow">→</span></Link>}
              {!canViewPayments && !canViewReservations && !canViewParcels && <p className="empty">{t('agent.noActions')}</p>}
            </div>
          </section>
        </div>
      </>}
      {showScanner && <TicketScanner onClose={() => setShowScanner(false)} />}
    </section>
  )
}