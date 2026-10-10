import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, Armchair, Bus, CalendarDays, CheckCircle2, Clock3, CreditCard, Package, QrCode, Search, Ticket, UserRoundPlus } from 'lucide-react'
import { useAuth } from '../../auth/authContext'
import { useLanguage } from '../../../i18n/useLanguage'
import { hasPermission } from '../../auth/permissions'
import { api } from '../../../services/api'
import { Button, EmptyState, ErrorState, LoadingState, StatCard, StatusBadge } from '../../../components/ui'
import { TicketScanner } from './TicketScanner'
import { printTicket as printTicketDocument } from './ticketPrint'

const queryKey = (id, date) => ['agent-dashboard', id, date]
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const errorMessage = (error, t) => {
  if (error?.response?.status === 401) return t('agent.sessionExpired')
  if (error?.response?.status === 403) return t('agent.accessDenied')
  return t('agent.workspaceError')
}
const dateTime = (value, lang) => new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const time = (value, lang) => new Date(value).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })
const money = (value, currency, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: currency || 'USD' }).format(Number(value || 0))
const route = (item) => item?.trip?.schedule?.route ? `${item.trip.schedule.route.departureCity} -> ${item.trip.schedule.route.arrivalCity}` : '-'

export function AgentOverview({ data, user }) {
  const { t } = useLanguage()
  return <section className="agent-section"><div className="section-heading"><div><h2>{t('agent.overview')}</h2><p>{t('agent.agencyActivity')}</p></div></div><div className="dashboard-stats-grid">
    {hasPermission(user, 'VIEW_TRIP') && <StatCard icon={CalendarDays} title={t('agent.departuresToday')} value={data.overview.todayTrips} />}
    {hasPermission(user, 'VIEW_RESERVATION') && <StatCard icon={Ticket} title={t('agent.reservationsTodayCard')} value={data.overview.todayReservations} />}
    {hasPermission(user, 'VIEW_PAYMENT') && <StatCard icon={CreditCard} title={t('agent.paymentsToProcess')} value={data.overview.pendingPayments} />}
    {hasPermission(user, 'VIEW_RESERVATION') && <StatCard icon={CheckCircle2} title={t('agent.ticketsToControl')} value={data.overview.ticketsToControl} />}
  </div></section>
}

export function AgentQuickActions({ user, onScan }) {
  const { t } = useLanguage()
  const actions = [
    hasPermission(user, 'CREATE_RESERVATION') && [t('agent.newReservation'), UserRoundPlus, '/transport/reservations'],
    hasPermission(user, 'VIEW_RESERVATION') && [t('agent.manageReservations'), Ticket, '/transport/reservations'],
    hasPermission(user, 'VIEW_PAYMENT') && [t('agent.processPayments'), CreditCard, '/transport/operations'],
    hasPermission(user, 'SCAN_TICKET') && [t('agent.scanTicket'), QrCode, null],
    hasPermission(user, 'VIEW_RESERVATION') && [t('agent.searchCustomer'), Search, '/transport/reservations'],
    hasPermission(user, 'CREATE_PARCEL') && [t('agent.registerParcel'), Package, '/transport/parcels'],
  ].filter(Boolean)
  return <section className="agent-section agent-actions"><div className="section-heading"><div><h2>{t('agent.quickActions')}</h2><p>{t('agent.operationsAvailable')}</p></div></div><div className="agent-actions__grid">
    {actions.map(([label, Icon, to]) => to ? <Link key={label} to={to} className="button"><Icon size={16} />{label}</Link> : <button key={label} type="button" className="button" onClick={onScan}><Icon size={16} />{label}</button>)}
    {!actions.length && <p className="empty">{t('agent.noAuthorizedActions')}</p>}
  </div></section>
}

export function AgentDepartures({ data, lang }) {
  const { t } = useLanguage()
  const departures = data.departures?.upcoming || []
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>{t('agent.nextDepartures')}</h2><p>{t('agent.authorizedScope')}</p></div><Link to="/transport/trips" className="button secondary sm">{t('agent.viewTripsLink')}</Link></div>
    {!departures.length ? <EmptyState title={t('agent.noUpcomingDepartures')} description={t('agent.noAgencyTrips')} /> : <div className="table-responsive"><table className="data-table"><thead><tr><th>{t('agent.time')}</th><th>{t('agent.routeLabel')}</th><th>{t('agent.bus')}</th><th>{t('agent.seats')}</th><th>{t('agent.reserved')}</th><th>{t('agent.available')}</th><th>{t('agent.statusLabel')}</th></tr></thead><tbody>{departures.map((trip) => <tr key={trip.id}><td><strong>{time(trip.departureAt, lang)}</strong><br /><small>{dateTime(trip.departureAt, lang)}</small></td><td>{trip.schedule?.route ? `${trip.schedule.route.departureCity} -> ${trip.schedule.route.arrivalCity}` : '-'}</td><td>{trip.schedule?.bus?.plateNumber || '-'}</td><td>{trip.schedule?.bus?.seats ?? '-'}</td><td>{trip.seatsReserved}</td><td>{trip.seatsRemaining}</td><td><StatusBadge status={trip.status} /></td></tr>)}</tbody></table></div>}
  </section>
}

export function AgentReservations({ reservations, lang, user }) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [printFormat, setPrintFormat] = useState('80mm')
  const [ticketError, setTicketError] = useState(null)
  const [printingTicketCode, setPrintingTicketCode] = useState(null)
  const term = search.trim().toLowerCase()
  const visible = reservations.filter((item) => !term || [item.reservationCode, item.customerName, item.customerPhone].some((value) => String(value || '').toLowerCase().includes(term)))
  const printTicket = async (ticketCode) => {
    if (printingTicketCode) return
    setPrintingTicketCode(ticketCode)
    try {
      setTicketError(null)
      await printTicketDocument(ticketCode, printFormat)
    } catch (error) {
      setTicketError(errorMessage(error, t))
    } finally {
      setPrintingTicketCode(null)
    }
  }
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>{t('agent.reservations')}</h2><p>{t('agent.reservationWork')}</p></div><div className="agent-header-actions"><label>{t('operations.printFormat')} <select value={printFormat} onChange={(event) => setPrintFormat(event.target.value)}><option value="a4">A4</option><option value="58mm">58 mm</option><option value="80mm">80 mm</option><option value="110mm">110 mm</option></select></label><Link to="/transport/reservations" className="button secondary sm">{t('agent.openManagement')}</Link></div></div><div className="agent-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('agent.reservationSearchPlaceholder')} aria-label={t('agent.searchReservationLabel')} /></div>{ticketError && <div className="alert alert-danger" role="alert">{ticketError}</div>}
    {!visible.length ? <EmptyState title={reservations.length ? t('agent.noResults') : t('agent.noReservations')} description={reservations.length ? t('agent.noReservationMatches') : t('agent.backendNoReservations')} /> : <div className="table-responsive"><table className="data-table"><thead><tr><th>{t('agent.reservations')}</th><th>{t('agent.client')}</th><th>{t('agent.trip')}</th><th>{t('agent.seat')}</th><th>{t('agent.amount')}</th><th>{t('agent.payment')}</th><th>{t('agent.actions')}</th></tr></thead><tbody>{visible.slice(0, 50).map((item) => { const ticketCode = item.tickets?.[0]?.ticketCode; return <tr key={item.id}><td><strong>{item.reservationCode}</strong><br /><small>{dateTime(item.createdAt, lang)}</small></td><td>{item.customerName}<br /><small>{item.customerPhone}</small></td><td>{route(item)}<br /><small>{item.trip?.departureAt ? dateTime(item.trip.departureAt, lang) : '-'}</small></td><td>{item.seatNumber}</td><td>{money(item.totalAmount, item.currency, lang)}</td><td><StatusBadge status={item.payments?.[0]?.status || 'PENDING'} /></td><td className="agent-inline-actions"><Link to="/transport/reservations" className="button secondary sm">{t('agent.view')}</Link>{hasPermission(user, 'VIEW_PAYMENT') && <Link to="/transport/operations" className="button secondary sm">{t('agent.paymentAction')}</Link>}{ticketCode && <><Link to={`/transport/tickets/${encodeURIComponent(ticketCode)}`} className="button secondary sm">{t('ticket.view')}</Link><button type="button" className="button secondary sm" disabled={Boolean(printingTicketCode)} onClick={() => printTicket(ticketCode)}>{printingTicketCode === ticketCode ? t('ticket.printing') : t('ticket.print')}</button></>}</td></tr> })}</tbody></table></div>}
  </section>
}

export function AgentPayments({ payments, lang, canManagePayments }) {
  const { t } = useLanguage()
  const pending = payments.pending || []
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>{t('agent.payments')}</h2><p>{t('agent.cashValidation')}</p></div><Link to="/transport/operations" className="button secondary sm">{t('agent.operations')}</Link></div>
    {!pending.length && !payments.validatedToday?.length ? <EmptyState title={t('agent.noPayments')} description={t('agent.noPendingPayments')} /> : <><div className="agent-payment-summary">{t('agent.pendingCash').replace('{count}', String(pending.length))}</div>{pending.length > 0 && <div className="table-responsive"><table className="data-table"><thead><tr><th>{t('agent.reservations')}</th><th>{t('agent.channel')}</th><th>{t('agent.amount')}</th><th>{t('agent.method')}</th><th>{t('agent.reference')}</th><th>{t('agent.date')}</th>{canManagePayments && <th>{t('agent.actions')}</th>}</tr></thead><tbody>{pending.map((item) => <tr key={item.id}><td>{item.reservation?.reservationCode || '-'}</td><td>{item.channel === 'AGENCY' ? t('agent.cashAgency') : item.channel}</td><td>{money(item.amount, item.currency, lang)}</td><td>{item.method || 'CASH'}</td><td>{item.reference || '-'}</td><td>{dateTime(item.createdAt, lang)}</td>{canManagePayments && <td><Link className="button sm" to="/transport/operations">{t('agent.operations')}</Link></td>}</tr>)}</tbody></table></div>}{!!payments.validatedToday?.length && <div className="agent-subsection"><h3>{t('agent.validatedToday')}</h3><div className="table-responsive"><table className="data-table"><thead><tr><th>{t('agent.reservations')}</th><th>{t('agent.amount')}</th><th>{t('agent.method')}</th><th>{t('agent.reference')}</th><th>{t('agent.validatedBy')}</th><th>{t('agent.date')}</th></tr></thead><tbody>{payments.validatedToday.map((item) => <tr key={item.id}><td>{item.reservation?.reservationCode || '-'}</td><td>{money(item.amount, item.currency, lang)}</td><td>{item.method || '-'}</td><td>{item.reference || '-'}</td><td>{item.validatedBy ? `${item.validatedBy.firstName} ${item.validatedBy.lastName}` : '-'}</td><td>{dateTime(item.validatedAt, lang)}</td></tr>)}</tbody></table></div></div>}</>}
  </section>
}

export function AgentTicketControl({ data, onScan, lang }) {
  const { t } = useLanguage()
  const scans = data.tickets?.recentScans || []
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>{t('agent.ticketControl')}</h2><p>{t('agent.scansStored')}</p></div><Button icon={QrCode} onClick={onScan}>{t('agent.scanTicket')}</Button></div>{!scans.length ? <EmptyState title={t('agent.noRecentScans')} description={t('agent.scanHistory')} /> : <div className="table-responsive"><table className="data-table"><thead><tr><th>{t('agent.ticket')}</th><th>{t('agent.result')}</th><th>{t('agent.statusLabel')}</th><th>{t('agent.agent')}</th><th>{t('agent.date')}</th></tr></thead><tbody>{scans.map((scan) => <tr key={scan.id}><td>{scan.ticket?.ticketCode || '-'}</td><td>{scan.result}</td><td><StatusBadge status={scan.ticket?.status} /></td><td>{scan.scannedBy ? `${scan.scannedBy.firstName} ${scan.scannedBy.lastName}` : '-'}</td><td>{dateTime(scan.scannedAt, lang)}</td></tr>)}</tbody></table></div>}</section>
}

export function AgentParcels({ parcels }) {
  const { t } = useLanguage()
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>{t('agent.parcels')}</h2><p>{t('agent.parcelAgencyScope')}</p></div><Link to="/transport/parcels" className="button secondary sm">{t('agent.manageParcels')}</Link></div><div className="agent-parcel-grid"><div><strong>{parcels.registered}</strong><span>{t('agent.registered')}</span></div><div><strong>{parcels.inTransit}</strong><span>{t('agent.inTransit')}</span></div><div><strong>{parcels.arrived}</strong><span>{t('agent.arrived')}</span></div><div><strong>{parcels.readyForPickup}</strong><span>{t('agent.readyForPickup')}</span></div></div></section>
}

export function AgentDashboard() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const client = useQueryClient()
  const [showScanner, setShowScanner] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => localDate())
  const query = useQuery({ queryKey: queryKey(user?.id, selectedDate), queryFn: async () => { const response = await api.get('/api/agent/dashboard', { params: { date: selectedDate } }); if (!response.data?.success) throw new Error(t('agent.dashboardInvalid')); return response.data.data }, enabled: Boolean(user), staleTime: 15000 })
  if (!user) return null
  if (query.isPending) return <section className="page agent-workspace"><LoadingState message={t('agent.dashboardLoading')} /></section>
  if (query.isError) return <section className="page agent-workspace"><ErrorState title={t('agent.dashboardError')} message={errorMessage(query.error, t)} onRetry={query.refetch} /></section>
  const data = query.data
  const daily = data.agentDaily || { ticketsSold: 0, revenueByCurrency: {}, revenueHistory: [], activity: [] }
  const currencies = [...new Set(daily.revenueHistory.flatMap((day) => Object.keys(day.currencies || {})))]
  const primaryCurrency = currencies[0] || 'USD'
  const dailyRevenue = Object.entries(daily.revenueByCurrency || {})
  const todayTrips = data.departures?.today || []
  const seatsLeft = todayTrips.reduce((total, trip) => total + Number(trip.seatsRemaining || 0), 0)
  const activity = daily.activity || []
  const reservationAllowed = hasPermission(user, 'CREATE_RESERVATION')
  const selectedIsToday = selectedDate === localDate()
  const actions = [
    reservationAllowed && { label: t('agent.newReservation'), icon: UserRoundPlus, to: '/transport/reservations', primary: true },
    hasPermission(user, 'VIEW_RESERVATION') && { label: t('agent.tickets'), icon: Ticket, to: '/transport/tickets' },
    hasPermission(user, 'VIEW_PAYMENT') && { label: t('agent.cashPayments'), icon: CreditCard, to: '/transport/operations' },
    hasPermission(user, 'VIEW_TRIP') && { label: t('agent.nextDepartures'), icon: Bus, to: '/transport/trips' },
    hasPermission(user, 'CREATE_PARCEL') && { label: t('agent.registerParcel'), icon: Package, to: '/transport/parcels' },
  ].filter(Boolean)
  const occupancyLabel = (trip) => `${Math.min(Number(trip.occupancyRate || 0), 100)}%`
  return <section className="page agent-workspace agent-command">
    <header className="agent-command__hero">
      <div className="agent-command__identity"><span>{t('agent.todayDesk')}</span><h1>{t('agent.greetingShort')} <strong>{user.firstName} {user.lastName}</strong></h1><p>{user.agency?.name || user.agency?.code || t('agent.agencyUnavailable')}</p></div>
      <div className="agent-command__hero-side"><time>{new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${selectedDate}T12:00:00`))}</time>{reservationAllowed && <Link to="/transport/reservations" className="agent-command__primary">{t('agent.newReservation')} <ArrowUpRight size={17} /></Link>}</div>
    </header>
    <div className="agent-command__metrics">
      <article className="agent-command__metric agent-command__metric--accent"><span><Ticket size={17} />{t(selectedIsToday ? 'agent.soldToday' : 'agent.soldOnDate')}</span><strong>{hasPermission(user, 'VIEW_RESERVATION') ? daily.ticketsSold : '—'}</strong><small>{t('agent.validTicketsIssued')}</small></article>
      <article className="agent-command__metric"><span><CreditCard size={17} />{t(selectedIsToday ? 'agent.collectedToday' : 'agent.collectedOnDate')}</span>{!hasPermission(user, 'VIEW_PAYMENT') ? <strong>—</strong> : dailyRevenue.length ? dailyRevenue.map(([currency, amount]) => <strong className="agent-command__money" key={currency}>{money(amount, currency, lang)}</strong>) : <strong>{money(0, primaryCurrency, lang)}</strong>}<small>{t('agent.personalConfirmedPayments')}</small></article>
      <article className="agent-command__metric"><span><Bus size={17} />{t(selectedIsToday ? 'agent.scheduledToday' : 'agent.scheduledOnDate')}</span><strong>{hasPermission(user, 'VIEW_TRIP') ? todayTrips.length : '—'}</strong><small>{t(selectedIsToday ? 'agent.tripsInAgency' : 'agent.tripsInAgencyOnDate')}</small></article>
      <article className="agent-command__metric"><span><Armchair size={17} />{t(selectedIsToday ? 'agent.seatsRemainingToday' : 'agent.seatsRemainingOnDate')}</span><strong>{hasPermission(user, 'VIEW_TRIP') && hasPermission(user, 'VIEW_RESERVATION') ? seatsLeft : '—'}</strong><small>{t(selectedIsToday ? 'agent.availableAcrossTrips' : 'agent.availableAcrossTripsOnDate')}</small></article>
    </div>
    <section className="agent-command__panel agent-command__actions"><div className="agent-command__heading"><div><span>{t('agent.quickActions')}</span><h2>{t('agent.actionPrompt')}</h2></div></div><div className="agent-command__action-list">{actions.map(({ label, icon: Icon, to, primary }) => <Link key={label} to={to} className={primary ? 'agent-command__action is-primary' : 'agent-command__action'}><Icon size={17} />{label}<ArrowUpRight size={15} /></Link>)}</div></section>
    <div className="agent-command__columns">
      <section className="agent-command__panel agent-command__trips"><div className="agent-command__heading"><div><span>{t('agent.operationsSection')}</span><h2>{t(selectedIsToday ? 'agent.scheduledTrips' : 'agent.scheduledOnDate')}</h2></div>{hasPermission(user, 'VIEW_TRIP') && <Link to="/transport/trips">{t('agent.allTrips')} <ArrowUpRight size={15} /></Link>}</div>
        {!hasPermission(user, 'VIEW_TRIP') ? <p className="agent-command__empty">{t('agent.tripPermissionMissing')}</p> : !todayTrips.length ? <p className="agent-command__empty">{t('agent.noTripsToday')}</p> : <div className="agent-command__trip-list">{todayTrips.map((trip) => <article className="agent-command__trip" key={trip.id}><div className="agent-command__trip-time"><Clock3 size={16} /><strong>{time(trip.departureAt, lang)}</strong></div><div className="agent-command__trip-main"><h3>{trip.schedule?.route ? `${trip.schedule.route.departureCity} → ${trip.schedule.route.arrivalCity}` : '—'}</h3><p>{trip.schedule?.bus?.plateNumber || '—'} · {trip.schedule?.bus?.seats ?? 0} {t('agent.seatsUnit')}</p>{hasPermission(user, 'VIEW_RESERVATION') && <div className="agent-command__occupancy" role="img" aria-label={`${t('agent.occupancy')} ${occupancyLabel(trip)}`}><span style={{ width: occupancyLabel(trip) }} /></div>}</div><div className="agent-command__trip-seats"><strong>{hasPermission(user, 'VIEW_RESERVATION') ? trip.seatsReserved : '—'}</strong><small>{t('agent.reserved')}</small></div><div className="agent-command__trip-seats is-free"><strong>{hasPermission(user, 'VIEW_RESERVATION') ? trip.seatsRemaining : '—'}</strong><small>{t('agent.available')}</small></div><StatusBadge status={trip.status} /><Link className="agent-command__trip-link" to={`/transport/reservations?tripId=${encodeURIComponent(trip.id)}`} aria-label={`${t('agent.viewReservations')} ${trip.schedule?.route?.departureCity || ''} ${trip.schedule?.route?.arrivalCity || ''}`}><ArrowUpRight size={17} /></Link></article>)}</div>}
      </section>
      <section className="agent-command__panel agent-command__revenue"><div className="agent-command__heading"><div><span>{t('agent.personalPerformance')}</span><h2>{t('agent.revenueHistory')}</h2></div><label className="agent-command__date"><CalendarDays size={15} /><span className="sr-only">{t('agent.selectDay')}</span><input type="date" value={selectedDate} max={localDate()} onChange={(event) => { if (event.target.value) setSelectedDate(event.target.value) }} /></label></div>
        <div className="agent-command__chart" role="img" aria-label={t('agent.revenueHistory')}>
          {daily.revenueHistory.map((day) => { const amount = Number(day.currencies?.[primaryCurrency] || 0); const max = Math.max(...daily.revenueHistory.map((item) => Number(item.currencies?.[primaryCurrency] || 0)), 1); return <div className="agent-command__bar-column" key={day.date}><strong>{amount ? money(amount, primaryCurrency, lang) : ''}</strong><div><span style={{ height: `${Math.max((amount / max) * 100, amount ? 6 : 2)}%` }} /></div><small>{new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))}</small></div> })}
        </div>
        <p className="agent-command__chart-note">{currencies.length ? t('agent.chartCurrency', { currency: primaryCurrency }) : t('agent.noRevenueHistory')}</p>
      </section>
    </div>
    <section className="agent-command__panel agent-command__activity"><div className="agent-command__heading"><div><span>{t('agent.myOperations')}</span><h2>{t('agent.dailyActivity')}</h2></div><div className="agent-command__activity-filter"><CalendarDays size={15} /><span>{selectedDate}</span></div></div>
      {!hasPermission(user, 'VIEW_RESERVATION') && !hasPermission(user, 'VIEW_PAYMENT') && !hasPermission(user, 'VIEW_TICKET_SCAN') && !hasPermission(user, 'CREATE_PARCEL') ? <p className="agent-command__empty">{t('agent.activityPermissionMissing')}</p> : !activity.length ? <p className="agent-command__empty">{t('agent.noActivity')}</p> : <div className="agent-command__activity-list">{activity.map((item) => <article className="agent-command__activity-row" key={item.id}><span className={`agent-command__activity-icon is-${item.type}`}>{item.type === 'payment' ? <CreditCard size={16} /> : item.type === 'ticket' ? <Ticket size={16} /> : item.type === 'scan' ? <QrCode size={16} /> : item.type === 'parcel' ? <Package size={16} /> : <Activity size={16} />}</span><div><strong>{item.type === 'payment' ? t('agent.activityPayment') : item.type === 'ticket' ? t('agent.activityTicket') : item.type === 'cancellation' ? t('agent.activityCancellation') : item.type === 'scan' ? t('agent.activityScan') : item.type === 'parcel' ? t('agent.activityParcel') : t('agent.activityReservation')}</strong><small>{item.reference}{item.customer ? ` · ${item.customer}` : ''}</small></div><StatusBadge status={item.status} className="agent-command__activity-status" dot={false} />{item.amount != null && <strong className="agent-command__activity-amount">{money(item.amount, item.currency, lang)}</strong>}<time>{dateTime(item.at, lang)}</time></article>)}</div>}
    </section>
    {hasPermission(user, 'SCAN_TICKET') && <button type="button" className="agent-command__scan" onClick={() => setShowScanner(true)}><QrCode size={17} />{t('agent.scanTicket')}</button>}
    {showScanner && hasPermission(user, 'SCAN_TICKET') && <TicketScanner onClose={() => setShowScanner(false)} onSuccess={() => client.invalidateQueries({ queryKey: queryKey(user.id) })} />}
  </section>
}
