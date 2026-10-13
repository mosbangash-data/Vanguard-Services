import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight, BusFront, CalendarDays, CreditCard, Package, Users, Wallet, AlertTriangle, RotateCw, QrCode, UserRound, ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'
import { api } from '../../../services/api'
import { LoadingState } from '../../../components/ui/LoadingState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { EmptyState } from '../../../components/ui/EmptyState'
import { StatusBadge } from '../../../components/ui/StatusBadge'

const money = (amount, currency = 'USD', lang = 'fr') => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount || 0))
const dateTime = (value, lang = 'fr') => value ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const dashboardErrorMessage = (error, t) => {
  const status = error?.response?.status
  if (status === 401) return t('managerWorkspace.error401')
  if (status === 403) return t('managerWorkspace.error403')
  if (status === 404) return t('managerWorkspace.error404')
  if (status === 409) return t('managerWorkspace.error409')
  if (status === 422) return t('managerWorkspace.error422')
  if (status >= 500) return t('managerWorkspace.error500')
  return t('managerWorkspace.errorGeneric')
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return <section className={`dashboard-panel manager-panel ${className}`}><div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>
}

function Table({ headers, children }) {
  return <div className="table-responsive"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}

function DetailGroup({ title, count, children }) {
  return <details className="manager-details"><summary><span>{title}</span>{count !== undefined && <span className="manager-details-count">{count}</span>}</summary><div className="manager-details-content">{children}</div></details>
}

function currencyBreakdown(totals, lang, fallbackCurrency) {
  const entries = Object.entries(totals || {})
  return entries.length ? entries.map(([currency, amount]) => money(amount, currency, lang)).join(' · ') : money(0, fallbackCurrency || 'USD', lang)
}

export function ManagerDashboard() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const query = useQuery({
    queryKey: ['manager-dashboard', user?.id],
    queryFn: async () => {
      try {
        const response = await api.get('/api/manager/dashboard')
        if (!response.data?.success || !response.data.data?.scope || !response.data.data?.kpis) throw new Error('Invalid manager dashboard response shape')
        return response.data.data
      } catch (error) {
        console.error('[manager-dashboard] API request failed', { status: error?.response?.status, message: error?.response?.data?.message || error?.message })
        throw error
      }
    },
    enabled: Boolean(user?.id && ['MANAGER', 'SERVICE_ADMIN'].includes(user.role)),
    refetchInterval: 60000,
  })
  if (!user) return null
  if (query.isPending) return <section className="page manager-workspace"><LoadingState message={t('managerWorkspace.loading')} /></section>
  if (query.isError) return <section className="page manager-workspace"><ErrorState title={t('managerWorkspace.unavailable')} message={dashboardErrorMessage(query.error, t)} onRetry={query.refetch} /></section>

  const data = query.data
  const kpis = data.kpis
  const canTrip = hasPermission(user, 'VIEW_TRIP')
  const canReservation = hasPermission(user, 'VIEW_RESERVATION')
  const canPayment = hasPermission(user, 'VIEW_PAYMENT')
  const canOccupancy = hasPermission(user, 'VIEW_OCCUPANCY')
  const canParcel = hasPermission(user, 'VIEW_PARCEL')
  const canViewParcelPayments = hasPermission(user, 'VIEW_PARCEL_PAYMENT')
  const canViewAgents = hasPermission(user, 'VIEW_USER')
  const canViewScans = hasPermission(user, 'VIEW_TICKET_SCAN')
  const canScanTickets = hasPermission(user, 'SCAN_TICKET')
  const canCloseCash = hasPermission(user, 'APPROVE_DAILY_CASH_CLOSURE')
  const canManageStaff = user.role === 'MANAGER' && user.department?.type === 'VANGUARD_COACH'
  const trips = data.operations?.todayTrips || []
  const alertLinks = { payments: canPayment ? '/transport/operations' : canViewParcelPayments && canParcel ? '/transport/parcels' : null, reservations: canReservation && '/transport/reservations', parcels: canParcel && '/transport/parcels', 'low-occupancy': canTrip && '/transport/trips', 'near-departure': canTrip && '/transport/trips' }
  const actions = [
    canReservation && { id: 'reservations', label: t('managerWorkspace.openReservations'), to: '/transport/reservations', icon: CalendarDays, count: kpis.pendingReservations },
    canPayment && { id: 'payments', label: t('managerWorkspace.openPayments'), to: '/transport/operations', icon: CreditCard, count: kpis.pendingPayments },
    canParcel && { id: 'parcels', label: t('managerWorkspace.openParcels'), to: '/transport/parcels', icon: Package },
    canTrip && { id: 'trips', label: t('managerWorkspace.openTrips'), to: '/transport/trips', icon: BusFront },
    canManageStaff && { id: 'staff', label: t('managerWorkspace.openStaff'), to: '/transport/personnel', icon: UserRound },
    canCloseCash && { id: 'cash', label: t('managerWorkspace.openCashClosure'), to: '/transport/cash-closure', icon: ClipboardCheck },
    canViewScans && (canScanTickets
      ? { id: 'scanner', label: t('managerWorkspace.openScanner'), to: '/transport/scanner', icon: QrCode }
      : { id: 'tickets', label: t('managerWorkspace.openTickets'), to: '/transport/tickets', icon: QrCode }),
  ].filter(Boolean)
  const todayLabel = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'full' }).format(new Date())
  const activityLabel = (item) => {
    if (!item.eventKey) return item.label
    const params = { ...(item.params || {}) }
    if (params.status) params.status = t(`status.${String(params.status).toLowerCase()}`)
    if (params.result) params.result = t(`managerWorkspace.scan_${String(params.result).toLowerCase()}`)
    return t(`managerWorkspace.${item.eventKey}`, params)
  }
  const alertLabel = (alert) => alert.messageKey ? t(`managerWorkspace.${alert.messageKey}`, { count: alert.count }) : alert.message

  return <section className="page manager-workspace">
    <header className="manager-header">
      <div><p className="eyebrow">{t('managerWorkspace.eyebrow')}</p><h1>{t('managerWorkspace.greeting', { name: user.firstName })}</h1><p>{data.scope.departmentName}{data.scope.agencyName ? ` · ${data.scope.agencyName}` : ` · ${t('managerWorkspace.departmentScope')}`} · {todayLabel}</p></div>
      <button className="button secondary sm" onClick={() => query.refetch()} disabled={query.isFetching}><RotateCw size={15} aria-hidden="true" /> {query.isFetching ? t('managerWorkspace.refreshing') : t('dashboard.refresh')}</button>
    </header>

    <section className="manager-priority-grid" aria-label={t('managerWorkspace.priorityIndicators')}>
      {canPayment && <article className="manager-priority-card manager-priority-card--revenue"><span className="manager-kpi-icon"><Wallet size={18} /></span><span className="manager-kpi-label">{t('managerWorkspace.todayRevenue')}</span><strong>{currencyBreakdown(kpis.todayRevenue, lang, data.scope.currency)}</strong><small>{t('managerWorkspace.revenueSources', { reservations: currencyBreakdown(kpis.todayReservationRevenue, lang, data.scope.currency), parcels: currencyBreakdown(kpis.todayParcelRevenue, lang, data.scope.currency) })}</small></article>}
      {canReservation && <article className="manager-priority-card"><span className="manager-kpi-icon"><CalendarDays size={18} /></span><span className="manager-kpi-label">{t('managerWorkspace.reservationsToProcess')}</span><strong>{kpis.pendingReservations}</strong><small>{t('managerWorkspace.todayReservationBreakdown', { pending: kpis.todayPendingReservations || 0, confirmed: kpis.todayConfirmedReservations || 0, cancelled: kpis.todayCancelledReservations || 0, completed: kpis.todayCompletedReservations || 0 })}</small></article>}
      {canPayment && <article className="manager-priority-card"><span className="manager-kpi-icon"><CreditCard size={18} /></span><span className="manager-kpi-label">{t('managerWorkspace.pendingPayments')}</span><strong>{kpis.pendingPayments}</strong><small>{t('managerWorkspace.pendingPaymentBreakdown', { reservations: kpis.pendingReservationPayments, parcels: kpis.pendingParcelPayments })}</small></article>}
    </section>

    {actions.length > 0 && <nav className="manager-quick-actions" aria-label={t('managerWorkspace.quickActions')}>
      {actions.map(({ id, label, to, icon: Icon, count }) => <Link key={id} to={to} className="manager-quick-action"><Icon size={17} aria-hidden="true" /><span>{label}</span>{count > 0 && <strong>{count}</strong>}<ArrowRight size={15} aria-hidden="true" /></Link>)}
    </nav>}

    <div className="manager-secondary-stats">
      {canTrip && <span><BusFront size={15} /> {t('managerWorkspace.completedTrips')}: <strong>{kpis.completedTrips}</strong></span>}
      {canTrip && <span>{t('managerWorkspace.cancelledTrips')}: <strong>{kpis.cancelledTrips}</strong></span>}
      {canReservation && <span><Users size={15} /> {t('managerWorkspace.todayPassengers')}: <strong>{kpis.todayPassengers}</strong></span>}
      {canReservation && <span>{t('managerWorkspace.cancelledReservations')}: <strong>{kpis.cancelledReservations}</strong></span>}
      {canOccupancy && <span><Activity size={15} /> {t('managerWorkspace.occupancy')}: <strong>{kpis.occupancyRate}%</strong></span>}
      {canParcel && <span><Package size={15} /> {t('managerWorkspace.activeParcels')}: <strong>{kpis.activeParcels}</strong></span>}
      {canViewAgents && <span><Users size={15} /> {t('managerWorkspace.activeAgents')}: <strong>{data.agents?.active ?? 0}</strong> · {t('managerWorkspace.inactiveAgents')}: <strong>{data.agents?.inactive ?? 0}</strong></span>}
    </div>

    <div className="manager-content-grid">
      {canTrip && <Panel title={t('managerWorkspace.todayTrips')} subtitle={t('managerWorkspace.todayTripsSubtitle')} action={<Link className="button secondary sm" to="/transport/trips">{t('managerWorkspace.allTrips')}</Link>}>
        {trips.length ? <Table headers={[t('managerWorkspace.departure'), t('managerWorkspace.route'), t('managerWorkspace.bus'), ...(canOccupancy ? [t('managerWorkspace.seats'), t('managerWorkspace.occupancy')] : []), t('managerWorkspace.status')]}>
          {trips.map((trip) => <tr key={trip.id}><td>{dateTime(trip.departureAt, lang)}</td><td>{trip.route}</td><td>{trip.bus}</td>{canOccupancy && <><td>{trip.reservedSeats}/{trip.capacity}</td><td>{trip.occupancyRate}%</td></>}<td><StatusBadge status={trip.status} /></td></tr>)}
        </Table> : <EmptyState title={t('managerWorkspace.noTripsToday')} description={t('managerWorkspace.noTripsTodayDescription')} />}
      </Panel>}
      {canOccupancy && <Panel title={t('managerWorkspace.occupancy')} subtitle={t('managerWorkspace.seatsOccupancy')} className="manager-occupancy-panel"><strong className="manager-occupancy-value">{kpis.occupancyRate}%</strong><p>{t('managerWorkspace.occupancySummary', { booked: (data.occupancy || []).reduce((sum, trip) => sum + trip.reservedSeats, 0), capacity: (data.occupancy || []).reduce((sum, trip) => sum + trip.capacity, 0) })}</p></Panel>}
    </div>

    <div className="manager-content-grid">
      <Panel title={t('managerWorkspace.requiredActions')} subtitle={t('managerWorkspace.alertsSubtitle')} action={<AlertTriangle size={18} aria-hidden="true" />}>
        {data.alerts?.length ? <ul className="manager-alert-list">{data.alerts.map((alert) => <li key={alert.id}><span className={`manager-alert-dot ${alert.type}`} /><span>{alertLabel(alert)}</span><strong>{alert.count}</strong>{alertLinks[alert.id] && <Link className="manager-alert-action" to={alertLinks[alert.id]} aria-label={`${t('managerWorkspace.openRelated')}: ${alertLabel(alert)}`}><ArrowRight size={16} aria-hidden="true" /></Link>}</li>)}</ul> : <EmptyState title={t('managerWorkspace.noRequiredActions')} description={t('managerWorkspace.noOperationalIssue')} />}
      </Panel>
      <Panel title={t('managerWorkspace.agencyScopeTitle')} subtitle={t('managerWorkspace.agencyScopeDescription')}>
        {data.agencies?.length ? <div className="manager-agency-list">{data.agencies.map((agency) => <div key={agency.id}><span><strong>{agency.name}</strong><small>{agency.code} · {agency.city || t('managerWorkspace.cityMissing')} · {agency.isActive ? t('managerWorkspace.active') : t('managerWorkspace.inactive')}</small><span className="manager-agency-stats">{agency.trips !== undefined && <span>{t('managerWorkspace.trips')}: <strong>{agency.trips}</strong></span>}{agency.reservations !== undefined && <span>{t('managerWorkspace.reservations')}: <strong>{agency.reservations}</strong></span>}{agency.payments !== undefined && <span>{t('managerWorkspace.payments')}: <strong>{agency.payments}</strong></span>}{agency.parcels !== undefined && <span>{t('managerWorkspace.parcels')}: <strong>{agency.parcels}</strong></span>}{agency.agents && <span>{t('managerWorkspace.agents')}: <strong>{agency.agents.active} · {agency.agents.inactive}</strong></span>}{agency.revenue && <span>{t('managerWorkspace.revenue')}: <strong>{currencyBreakdown(agency.revenue, lang, data.scope.currency)}</strong></span>}</span></span></div>)}</div> : <EmptyState title={t('managerWorkspace.noAgency')} />}
      </Panel>
    </div>

    <section className="manager-detail-sections" aria-label={t('managerWorkspace.moreOperations')}>
      {canTrip && <DetailGroup title={t('managerWorkspace.upcomingTrips')} count={data.operations?.upcomingTrips?.length || 0}>{data.operations?.upcomingTrips?.length ? <Table headers={[t('managerWorkspace.departure'), t('managerWorkspace.route'), t('managerWorkspace.bus'), ...(canOccupancy ? [t('managerWorkspace.availableSeats'), t('managerWorkspace.occupancy')] : [])]}>{data.operations.upcomingTrips.map((trip) => <tr key={trip.id}><td>{dateTime(trip.departureAt, lang)}</td><td>{trip.route}</td><td>{trip.bus}</td>{canOccupancy && <><td>{trip.availableSeats}/{trip.capacity}</td><td>{trip.occupancyRate}%</td></>}</tr>)}</Table> : <EmptyState title={t('managerWorkspace.noUpcomingTrips')} description={t('managerWorkspace.noUpcomingTripsDescription')} />}</DetailGroup>}

      {canReservation && <DetailGroup title={t('managerWorkspace.reservationsToProcess')} count={kpis.pendingReservations}>{data.operations?.pendingReservations?.length ? <Table headers={[t('managerWorkspace.code'), t('managerWorkspace.client'), t('managerWorkspace.phone'), t('managerWorkspace.amount'), t('managerWorkspace.createdAt')]}>{data.operations.pendingReservations.map((reservation) => <tr key={reservation.id}><td>{reservation.reservationCode}</td><td>{reservation.customerName}</td><td>{reservation.customerPhone}</td><td>{money(reservation.totalAmount, reservation.payments?.[0]?.currency || data.scope.currency || 'USD', lang)}</td><td>{dateTime(reservation.createdAt, lang)}</td></tr>)}</Table> : <EmptyState title={t('managerWorkspace.noPendingReservations')} />}</DetailGroup>}

      {canReservation && <DetailGroup title={t('managerWorkspace.recentReservations')} count={data.reservations?.length || 0}>{data.reservations?.length ? <Table headers={[t('managerWorkspace.code'), t('managerWorkspace.client'), t('managerWorkspace.trip'), t('managerWorkspace.seat'), t('managerWorkspace.amount'), t('managerWorkspace.status')]}>{data.reservations.slice(0, 6).map((reservation) => <tr key={reservation.id}><td>{reservation.reservationCode}</td><td>{reservation.customerName}<small className="manager-cell-subtitle">{reservation.customerPhone}</small></td><td>{dateTime(reservation.trip?.departureAt, lang)}<small className="manager-cell-subtitle">{reservation.trip?.schedule?.route?.departureCity} – {reservation.trip?.schedule?.route?.arrivalCity}</small></td><td>{reservation.seatNumber}</td><td>{money(reservation.totalAmount, reservation.payments?.[0]?.currency || 'USD', lang)}</td><td><StatusBadge status={reservation.status} />{canPayment && <small className="manager-cell-subtitle">{t('managerWorkspace.paymentStatuses')}: {reservation.payments?.map((payment) => t(`status.${payment.status.toLowerCase()}`)).join(', ') || '—'}</small>}</td></tr>)}</Table> : <EmptyState title={t('managerWorkspace.noRecentReservations')} />}</DetailGroup>}

      {canPayment && <DetailGroup title={t('managerWorkspace.recentPayments')} count={data.payments?.length || 0}><div className="manager-payment-summary"><span>{t('managerWorkspace.cashToValidate')} <strong>{kpis.pendingCashToValidate}</strong></span><span>{t('managerWorkspace.onlinePending')} <strong>{kpis.pendingOnline}</strong></span><span>{t('managerWorkspace.reservationPaymentsPending')} <strong>{kpis.pendingReservationPayments} · {currencyBreakdown(kpis.pendingReservationPaymentAmount, lang, data.scope.currency)}</strong></span><span>{t('managerWorkspace.parcelPaymentsPending')} <strong>{kpis.pendingParcelPayments} · {currencyBreakdown(kpis.pendingParcelPaymentAmount, lang, data.scope.currency)}</strong></span><span>{t('managerWorkspace.agencyChannel')} <strong>{data.paymentSummary?.byChannel?.AGENCY || 0}</strong></span><span>{t('managerWorkspace.onlineChannel')} <strong>{data.paymentSummary?.byChannel?.ONLINE || 0}</strong></span>{['PENDING', 'PROCESSING', 'VERIFIED', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED', 'REFUNDED'].map((status) => <span key={status}>{t(`status.${status.toLowerCase()}`)} <strong>{data.paymentSummary?.byStatus?.[status] || 0}</strong></span>)}</div>{data.payments?.length ? <Table headers={[t('managerWorkspace.reference'), t('managerWorkspace.reservationOrParcel'), t('managerWorkspace.channel'), t('managerWorkspace.amount'), t('managerWorkspace.status'), t('managerWorkspace.validatedBy'), t('managerWorkspace.date')]}>{data.payments.slice(0, 6).map((payment) => <tr key={payment.id}><td>{payment.reference || '—'}</td><td>{payment.reservation?.reservationCode || payment.parcel?.trackingCode || '—'}<small className="manager-cell-subtitle">{payment.reservation?.customerName || payment.parcel?.recipientName || '—'}</small></td><td>{t(`managerWorkspace.channel_${String(payment.channel).toLowerCase()}`)} · {t(`managerWorkspace.method_${String(payment.method).toLowerCase()}`)}</td><td>{money(payment.amount, payment.currency, lang)}</td><td><StatusBadge status={payment.status} /></td><td>{payment.validatedBy ? `${payment.validatedBy.firstName} ${payment.validatedBy.lastName}` : '—'}</td><td>{dateTime(payment.validatedAt || payment.createdAt, lang)}</td></tr>)}</Table> : <EmptyState title={t('managerWorkspace.noRecentPayments')} />}</DetailGroup>}

      {canParcel && <DetailGroup title={t('managerWorkspace.parcels')} count={kpis.activeParcels}><p className="manager-detail-intro">{canViewParcelPayments ? t('managerWorkspace.pendingParcelPaymentsSummary', { count: kpis.pendingParcelPayments, amount: currencyBreakdown(kpis.pendingParcelPaymentAmount, lang, data.scope.currency) }) : t('managerWorkspace.parcelScope')}</p><div className="manager-parcel-grid">{Object.entries(data.parcels?.statuses || {}).map(([status, count]) => <div key={status}><span>{t(`status.${status.toLowerCase()}`)}</span><strong>{count}</strong></div>)}</div>{data.parcels?.recentAlerts?.length ? <Table headers={[t('managerWorkspace.tracking'), t('managerWorkspace.senderRecipient'), t('managerWorkspace.agencies'), t('managerWorkspace.status'), ...(canViewParcelPayments ? [t('managerWorkspace.paymentStatuses')] : []), t('managerWorkspace.updatedAt')]}>{data.parcels.recentAlerts.map((parcel) => <tr key={parcel.id}><td>{parcel.trackingCode}</td><td>{parcel.senderName}<small className="manager-cell-subtitle">{parcel.recipientName}</small></td><td>{parcel.originAgency?.name || '—'}<small className="manager-cell-subtitle">→ {parcel.destinationAgency?.name || '—'}</small></td><td><StatusBadge status={parcel.status} /></td>{canViewParcelPayments && <td>{parcel.payments?.map((payment) => t(`status.${payment.status.toLowerCase()}`)).join(', ') || '—'}</td>}<td>{dateTime(parcel.updatedAt, lang)}</td></tr>)}</Table> : <EmptyState title={t('managerWorkspace.noParcelAlerts')} />}</DetailGroup>}

      {canViewScans && <DetailGroup title={t('managerWorkspace.ticketsAndScans')} count={Object.values(data.tickets?.statuses || {}).reduce((sum, count) => sum + count, 0)}><div className="manager-detail-actions">{canScanTickets ? <Link className="button secondary sm" to="/transport/scanner"><QrCode size={15} /> {t('managerWorkspace.openScanner')}</Link> : <Link className="button secondary sm" to="/transport/tickets">{t('managerWorkspace.openTickets')}</Link>}</div><div className="manager-payment-summary">{Object.entries(data.tickets?.statuses || {}).map(([status, count]) => <span key={status}>{t(`status.${status.toLowerCase()}`)} <strong>{count}</strong></span>)}</div>{data.tickets?.recentScans?.length ? <Table headers={[t('managerWorkspace.ticket'), t('managerWorkspace.result'), t('managerWorkspace.status'), t('managerWorkspace.agent'), t('managerWorkspace.date')]}>{data.tickets.recentScans.map((scan) => <tr key={scan.id}><td>{scan.ticket.ticketCode}</td><td>{t(`managerWorkspace.scan_${String(scan.result).toLowerCase()}`)}</td><td><StatusBadge status={scan.ticket.status} /></td><td>{scan.scannedBy.firstName} {scan.scannedBy.lastName}</td><td>{dateTime(scan.scannedAt, lang)}</td></tr>)}</Table> : <EmptyState title={t('managerWorkspace.noRecentScans')} description={t('managerWorkspace.scansWillAppear')} />}</DetailGroup>}

      <DetailGroup title={t('managerWorkspace.recentActivity')} count={data.recentActivity?.length || 0}>{data.recentActivity?.length ? <ol className="manager-activity-list">{data.recentActivity.map((item) => <li key={item.id}><span className="manager-activity-icon"><Activity size={15} /></span><span>{activityLabel(item)}</span><time>{dateTime(item.at, lang)}</time></li>)}</ol> : <EmptyState title={t('managerWorkspace.noRecentActivity')} />}</DetailGroup>
    </section>
  </section>
}
