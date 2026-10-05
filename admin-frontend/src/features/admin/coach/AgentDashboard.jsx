import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, CreditCard, Package, QrCode, Search, Ticket, UserRoundPlus } from 'lucide-react'
import { useAuth } from '../../auth/authContext'
import { useLanguage } from '../../../i18n/useLanguage'
import { hasPermission } from '../../auth/permissions'
import { api } from '../../../services/api'
import { Button, EmptyState, ErrorState, LoadingState, StatCard, StatusBadge } from '../../../components/ui'
import { TicketScanner } from './TicketScanner'
import { printTicket as printTicketDocument } from './ticketPrint'

const queryKey = (id) => ['agent-dashboard', id]
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
  const query = useQuery({ queryKey: queryKey(user?.id), queryFn: async () => { const response = await api.get('/api/agent/dashboard'); if (!response.data?.success) throw new Error(t('agent.dashboardInvalid')); return response.data.data }, enabled: Boolean(user), staleTime: 15000 })
  if (!user) return null
  if (query.isPending) return <section className="page agent-workspace"><LoadingState message={t('agent.dashboardLoading')} /></section>
  if (query.isError) return <section className="page agent-workspace"><ErrorState title={t('agent.dashboardError')} message={errorMessage(query.error, t)} onRetry={query.refetch} /></section>
  const data = query.data
  return <section className="page agent-workspace"><div className="agent-header"><div><p className="eyebrow">VANGUARD COACH / {t('agent.workspaceEyebrow')}</p><h1>{t('agent.dashboardTitle')}</h1><p>{t('agent.greeting', { name: user.firstName })}</p></div><div className="agent-header-actions"><span className="badge active">{t('agent.sessionActive')}</span></div></div><AgentOverview data={data} user={user} />{data.tickets?.missing?.length > 0 && <div className="alert alert-warning" role="alert"><strong>{t('agent.missingTicketsNotice')}</strong><ul>{data.tickets.missing.map((item) => <li key={item.id}>{item.reservationCode} · {item.customerName}</li>)}</ul></div>}<AgentQuickActions user={user} onScan={() => setShowScanner(true)} />{hasPermission(user, 'VIEW_PAYMENT') && <AgentPayments payments={data.payments || { pending: [], validatedToday: [] }} lang={lang} canManagePayments={hasPermission(user, 'MANAGE_RESERVATION_PAYMENT')} />}{hasPermission(user, 'VIEW_RESERVATION') && <AgentReservations reservations={data.reservations || []} lang={lang} user={user} />}{hasPermission(user, 'VIEW_TRIP') && <AgentDepartures data={data} lang={lang} />}{hasPermission(user, 'VIEW_TICKET_SCAN') && <AgentTicketControl data={data} lang={lang} onScan={() => setShowScanner(true)} />}{(hasPermission(user, 'VIEW_PARCEL') || hasPermission(user, 'CREATE_PARCEL')) && <AgentParcels parcels={data.parcels || { registered: 0, inTransit: 0, arrived: 0, readyForPickup: 0 }} />}{showScanner && hasPermission(user, 'SCAN_TICKET') && <TicketScanner onClose={() => setShowScanner(false)} onSuccess={() => client.invalidateQueries({ queryKey: queryKey(user.id) })} />}</section>
}
