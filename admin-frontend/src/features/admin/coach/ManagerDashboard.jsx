import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight, BusFront, CalendarDays, CreditCard, Package, Users, Wallet, AlertTriangle, Building2, RotateCw, QrCode } from 'lucide-react'
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

function Panel({ title, subtitle, action, children }) {
  return <section className="dashboard-panel manager-panel"><div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>
}

function Table({ headers, children }) {
  return <div className="table-responsive"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
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
  const cards = [
    { label: t('managerWorkspace.todayTrips'), value: kpis.todayTrips, note: t('managerWorkspace.upcomingCount', { count: kpis.upcomingTrips }), icon: BusFront, allowed: canTrip },
    { label: t('managerWorkspace.todayReservations'), value: kpis.todayReservations, note: t('managerWorkspace.pendingCount', { count: kpis.pendingReservations }), icon: CalendarDays, allowed: canReservation },
    { label: t('managerWorkspace.todayPassengers'), value: kpis.todayPassengers, note: t('managerWorkspace.totalPassengers', { count: kpis.totalPassengers }), icon: Users, allowed: canReservation },
    { label: t('managerWorkspace.todayRevenue'), value: Object.entries(kpis.todayRevenue || {}).map(([currency, amount]) => money(amount, currency, lang)).join(' · ') || money(0, data.scope.currency || 'USD', lang), note: `${t('managerWorkspace.totalPaid')}: ${Object.entries(kpis.revenue || {}).map(([currency, amount]) => money(amount, currency, lang)).join(' · ') || money(0, data.scope.currency || 'USD', lang)}`, icon: Wallet, allowed: canPayment },
    { label: t('managerWorkspace.cashToValidate'), value: kpis.pendingCashToValidate, note: t('managerWorkspace.cashWorkflow'), icon: CreditCard, allowed: canPayment },
    { label: t('managerWorkspace.occupancy'), value: `${kpis.occupancyRate}%`, note: t('managerWorkspace.seatsOccupancy'), icon: Activity, allowed: canOccupancy },
    { label: t('managerWorkspace.activeParcels'), value: kpis.activeParcels, note: t('managerWorkspace.parcelScope'), icon: Package, allowed: canParcel },
  ]
  const trips = data.operations?.todayTrips || []
  const alertLinks = { payments: canPayment ? '/transport/operations' : canViewParcelPayments && canParcel ? '/transport/parcels' : null, reservations: canReservation && '/transport/reservations', parcels: canParcel && '/transport/parcels', 'low-occupancy': canTrip && '/transport/trips', 'near-departure': canTrip && '/transport/trips' }
  const todayLabel = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'full' }).format(new Date())
  return <section className="page manager-workspace">
    <header className="manager-header"><div><p className="eyebrow">{t('managerWorkspace.eyebrow')}</p><h1>{t('managerWorkspace.greeting', { name: user.firstName })}</h1><p>{data.scope.departmentName}{data.scope.agencyName ? ` · ${data.scope.agencyName}` : ` · ${t('managerWorkspace.departmentScope')}`} · {todayLabel}</p></div><button className="button secondary sm" onClick={() => query.refetch()} disabled={query.isFetching}><RotateCw size={15} aria-hidden="true" /> {t('dashboard.refresh')}</button></header>
    <div className="manager-kpi-grid">{cards.filter((card) => card.allowed).map(({ label, value, note, icon: Icon }) => <article className="manager-kpi" key={label}><span className="manager-kpi-icon"><Icon size={18} /></span><span className="manager-kpi-label">{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="manager-overview-strip">{canTrip && <><span>Voyages terminés : <strong>{kpis.completedTrips}</strong></span><span>Annulés : <strong>{kpis.cancelledTrips}</strong></span></>}{canReservation && <span>Réservations annulées : <strong>{kpis.cancelledReservations}</strong></span>}{canViewAgents && <><span>Agents actifs : <strong>{data.agents?.active ?? 0}</strong></span><span>Agents inactifs : <strong>{data.agents?.inactive ?? 0}</strong></span></>}{canParcel && <span>Colis actifs : <strong>{kpis.activeParcels}</strong></span>}</div>
    <div className="manager-content-grid">
      <Panel title={t('managerWorkspace.requiredActions')} subtitle={t('managerWorkspace.alertsSubtitle')} action={<AlertTriangle size={18} aria-hidden="true" />}>{data.alerts?.length ? <ul className="manager-alert-list">{data.alerts.map((alert) => <li key={alert.id}><span className={`manager-alert-dot ${alert.type}`} /><span>{alert.message}</span><strong>{alert.count}</strong>{alertLinks[alert.id] && <Link className="manager-alert-action" to={alertLinks[alert.id]} aria-label={`${t('managerWorkspace.openRelated')}: ${alert.message}`}><ArrowRight size={16} aria-hidden="true" /></Link>}</li>)}</ul> : <EmptyState title={t('managerWorkspace.noRequiredActions')} description={t('managerWorkspace.noOperationalIssue')} />}</Panel>
      <Panel title="Agences du périmètre" subtitle="Votre agence pour les Managers · périmètre Coach pour le Service Admin">{data.agencies?.length ? <div className="manager-agency-list">{data.agencies.map((agency) => <div key={agency.id}><Building2 size={17} /><span><strong>{agency.name}</strong><small>{agency.code} · {agency.city || 'Ville non renseignée'} · {agency.isActive ? 'Active' : 'Inactive'}</small><span className="manager-agency-stats">{agency.trips !== undefined && <span>Voyages <strong>{agency.trips}</strong></span>}{agency.reservations !== undefined && <span>Réservations <strong>{agency.reservations}</strong></span>}{agency.payments !== undefined && <span>Paiements <strong>{agency.payments}</strong></span>}{agency.parcels !== undefined && <span>Colis <strong>{agency.parcels}</strong></span>}{agency.agents && <span>Agents <strong>{agency.agents.active} actifs · {agency.agents.inactive} inactifs</strong></span>}{agency.revenue && <span>Revenus <strong>{Object.entries(agency.revenue).map(([currency, amount]) => money(amount, currency, lang)).join(' · ') || '—'}</strong></span>}</span></span></div>)}</div> : <EmptyState title="Aucune agence disponible" />}</Panel>
    </div>
    {canTrip && <Panel title="Voyages du jour" subtitle="Voyages sur des horaires, lignes et bus actifs" action={<Link className="button secondary sm" to="/transport/trips">Gérer les voyages</Link>}>{trips.length ? <Table headers={['Départ', 'Itinéraire', 'Bus', 'Agence', ...(canOccupancy ? ['Sièges', 'Occupation'] : []), 'Statut']}>
      {trips.map((trip) => <tr key={trip.id}><td>{dateTime(trip.departureAt, lang)}</td><td>{trip.route}</td><td>{trip.bus}</td><td>{trip.agency}</td>{canOccupancy && <><td>{trip.reservedSeats}/{trip.capacity}</td><td>{trip.occupancyRate}%</td></>}<td><StatusBadge status={trip.status} /></td></tr>)}
    </Table> : <EmptyState title="Aucun voyage prévu aujourd’hui" description="Les départs à venir apparaîtront ici." />}</Panel>}
    {canTrip && <Panel title="Prochains départs" subtitle="Voyages programmés avec ligne et véhicule actifs" action={<Link className="button secondary sm" to="/transport/trips">Tous les voyages</Link>}>{data.operations?.upcomingTrips?.length ? <Table headers={['Départ', 'Itinéraire', 'Bus', 'Agence', ...(canOccupancy ? ['Sièges disponibles', 'Occupation'] : [])]}>
      {data.operations.upcomingTrips.map((trip) => <tr key={trip.id}><td>{dateTime(trip.departureAt, lang)}</td><td>{trip.route}</td><td>{trip.bus}</td><td>{trip.agency}</td>{canOccupancy && <><td>{trip.availableSeats}/{trip.capacity}</td><td>{trip.occupancyRate}%</td></>}</tr>)}
    </Table> : <EmptyState title="Aucun prochain départ" description="Aucun voyage opérationnel n’est programmé après aujourd’hui." />}</Panel>}
    {canReservation && <Panel title="Réservations à traiter" subtitle="Réservations actuellement en attente de confirmation" action={<Link className="button secondary sm" to="/transport/reservations">Traiter les réservations</Link>}>{data.operations?.pendingReservations?.length ? <Table headers={['Code', 'Client', 'Téléphone', 'Agence', 'Montant', 'Créée le']}>
      {data.operations.pendingReservations.map((reservation) => <tr key={reservation.id}><td>{reservation.reservationCode}</td><td>{reservation.customerName}</td><td>{reservation.customerPhone}</td><td>{reservation.agency?.name || '—'}</td><td>{money(reservation.totalAmount, reservation.payments?.[0]?.currency || data.scope.currency || 'USD', lang)}</td><td>{dateTime(reservation.createdAt, lang)}</td></tr>)}
    </Table> : <EmptyState title="Aucune réservation à traiter" />}</Panel>}
    <div className="manager-content-grid">
      {canReservation && <Panel title="Réservations récentes" subtitle="Clients et réservations dans votre périmètre" action={<Link className="button secondary sm" to="/transport/reservations">Voir les réservations</Link>}>{data.reservations?.length ? <Table headers={['Code', 'Client', 'Voyage', 'Agence', 'Siège', 'Montant', 'Statut']}>
        {data.reservations.slice(0, 6).map((reservation) => <tr key={reservation.id}><td>{reservation.reservationCode}</td><td>{reservation.customerName}<small className="manager-cell-subtitle">{reservation.customerPhone}</small></td><td>{dateTime(reservation.trip?.departureAt, lang)}<small className="manager-cell-subtitle">{reservation.trip?.schedule?.route?.departureCity} – {reservation.trip?.schedule?.route?.arrivalCity}</small></td><td>{reservation.agency?.name || '—'}</td><td>{reservation.seatNumber}</td><td>{money(reservation.totalAmount, reservation.payments?.[0]?.currency || 'USD', lang)}</td><td><StatusBadge status={reservation.status} />{canPayment && <small className="manager-cell-subtitle">Paiement : {reservation.payments?.map((payment) => payment.status).join(', ') || '—'}</small>}</td></tr>)}
      </Table> : <EmptyState title="Aucune réservation récente" />}</Panel>}
      {canPayment && <Panel title="Paiements récents" subtitle="Supervision uniquement · validation selon les permissions attribuées" action={<Link className="button secondary sm" to="/transport/operations">Ouvrir les opérations</Link>}><div className="manager-payment-summary"><span>Cash à valider <strong>{kpis.pendingCashToValidate}</strong></span><span>Online en attente <strong>{kpis.pendingOnline}</strong></span><span>Agence <strong>{data.paymentSummary?.byChannel?.AGENCY || 0}</strong></span><span>En ligne <strong>{data.paymentSummary?.byChannel?.ONLINE || 0}</strong></span>{['PENDING', 'PROCESSING', 'VERIFIED', 'COMPLETED', 'FAILED', 'REJECTED', 'CANCELLED', 'REFUNDED'].map((status) => <span key={status}>{status} <strong>{data.paymentSummary?.byStatus?.[status] || 0}</strong></span>)}</div>{data.payments?.length ? <Table headers={['Référence', 'Réservation / colis', 'Agence', 'Canal', 'Montant', 'Statut', 'Validé par', 'Date']}>
        {data.payments.slice(0, 6).map((payment) => <tr key={payment.id}><td>{payment.reference || '—'}</td><td>{payment.reservation?.reservationCode || payment.parcel?.trackingCode || '—'}<small className="manager-cell-subtitle">{payment.reservation?.customerName || payment.parcel?.recipientName || '—'}</small></td><td>{payment.agency?.name || '—'}</td><td>{payment.channel} · {payment.method}</td><td>{money(payment.amount, payment.currency, lang)}</td><td><StatusBadge status={payment.status} /></td><td>{payment.validatedBy ? `${payment.validatedBy.firstName} ${payment.validatedBy.lastName}` : '—'}</td><td>{dateTime(payment.createdAt, lang)}</td></tr>)}
      </Table> : <EmptyState title="Aucun paiement récent" />}</Panel>}
    </div>
    {canParcel && <Panel title="Colis" subtitle={`${canViewParcelPayments ? `${kpis.pendingParcelPayments} paiement(s) de colis en attente` : 'État opérationnel des colis du périmètre'}`} action={<Link className="button secondary sm" to="/transport/parcels">Gérer les colis</Link>}><div className="manager-parcel-grid">{Object.entries(data.parcels?.statuses || {}).map(([status, count]) => <div key={status}><span>{status.replaceAll('_', ' ')}</span><strong>{count}</strong></div>)}</div>{data.parcels?.recentAlerts?.length ? <div className="table-responsive"><Table headers={['Suivi', 'Expéditeur / destinataire', 'Agences', 'Statut', ...(canViewParcelPayments ? ['Paiement'] : []), 'Mis à jour']}>{data.parcels.recentAlerts.map((parcel) => <tr key={parcel.id}><td>{parcel.trackingCode}</td><td>{parcel.senderName}<small className="manager-cell-subtitle">{parcel.recipientName}</small></td><td>{parcel.originAgency?.name || '—'}<small className="manager-cell-subtitle">→ {parcel.destinationAgency?.name || '—'}</small></td><td><StatusBadge status={parcel.status} /></td>{canViewParcelPayments && <td>{parcel.payments?.map((payment) => payment.status).join(', ') || '—'}</td>}<td>{dateTime(parcel.updatedAt, lang)}</td></tr>)}</Table></div> : <p className="manager-muted">Aucune alerte colis.</p>}</Panel>}
    {canViewScans && <Panel title="Billets et contrôle QR" subtitle="Billets du périmètre et derniers scans enregistrés" action={canScanTickets ? <Link className="button secondary sm" to="/transport/scanner"><QrCode size={15} /> Scanner un billet</Link> : <Link className="button secondary sm" to="/transport/tickets">Voir les billets</Link>}><div className="manager-payment-summary">{Object.entries(data.tickets?.statuses || {}).map(([status, count]) => <span key={status}>{status.replaceAll('_', ' ')} <strong>{count}</strong></span>)}</div>{data.tickets?.recentScans?.length ? <Table headers={['Billet', 'Résultat', 'Statut', 'Agent', 'Date']}>
      {data.tickets.recentScans.map((scan) => <tr key={scan.id}><td>{scan.ticket.ticketCode}</td><td>{scan.result}</td><td><StatusBadge status={scan.ticket.status} /></td><td>{scan.scannedBy.firstName} {scan.scannedBy.lastName}</td><td>{dateTime(scan.scannedAt, lang)}</td></tr>)}
    </Table> : <EmptyState title="Aucun scan récent" description="L’historique apparaîtra après le contrôle des billets." />}</Panel>}
    <Panel title="Activité récente" subtitle="Réservations, paiements et alertes colis" action={<Activity size={18} />}>{data.recentActivity?.length ? <ol className="manager-activity-list">{data.recentActivity.map((item) => <li key={item.id}><span className="manager-activity-icon"><Package size={15} /></span><span>{item.label}</span><time>{dateTime(item.at, lang)}</time></li>)}</ol> : <EmptyState title="Aucune activité récente" />}</Panel>
  </section>
}
