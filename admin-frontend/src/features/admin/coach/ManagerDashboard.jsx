import { useQuery } from '@tanstack/react-query'
import { Activity, BusFront, CalendarDays, CreditCard, Package, Users, Wallet, AlertTriangle, Building2, RotateCw } from 'lucide-react'
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

function Panel({ title, subtitle, action, children }) {
  return <section className="dashboard-panel manager-panel"><div className="section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>
}

function Table({ headers, children }) {
  return <div className="table-responsive"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}

export function ManagerDashboard() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const query = useQuery({
    queryKey: ['manager-dashboard', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/manager/dashboard')
      if (!response.data?.success || !response.data.data?.scope || !response.data.data?.kpis) throw new Error('La réponse du tableau de bord est invalide.')
      return response.data.data
    },
    enabled: Boolean(user?.id && user.role === 'MANAGER'),
    refetchInterval: 60000,
  })
  if (!user) return null
  if (query.isPending) return <section className="page manager-workspace"><LoadingState message="Chargement du pilotage départemental…" /></section>
  if (query.isError) return <section className="page manager-workspace"><ErrorState title="Tableau de bord indisponible" message="Impossible de charger les données métier. Réessayez dans un instant." onRetry={query.refetch} /></section>
  const data = query.data
  const kpis = data.kpis
  const cards = [
    { label: 'Voyages aujourd’hui', value: kpis.todayTrips, note: `${kpis.upcomingTrips} prochains départs`, icon: BusFront },
    { label: 'Réservations aujourd’hui', value: kpis.todayReservations, note: `${kpis.pendingReservations} en attente`, icon: CalendarDays },
    { label: 'Passagers du jour', value: kpis.todayPassengers, note: `${kpis.totalPassengers} passagers confirmés au total`, icon: Users },
    { label: 'Revenus encaissés', value: Object.entries(kpis.revenue || {}).map(([currency, amount]) => money(amount, currency, lang)).join(' · ') || money(0, 'USD', lang), note: 'Paiements vérifiés ou terminés', icon: Wallet },
    { label: 'Paiements en attente', value: kpis.pendingPayments, note: Object.entries(kpis.pendingPaymentAmount || {}).map(([currency, amount]) => money(amount, currency, lang)).join(' · ') || money(0, 'USD', lang), icon: CreditCard },
    { label: 'Occupation du jour', value: `${kpis.occupancyRate}%`, note: 'Sièges réservés / capacité', icon: Activity },
  ]
  const canTrip = hasPermission(user, 'VIEW_TRIP')
  const canReservation = hasPermission(user, 'VIEW_RESERVATION')
  const canPayment = hasPermission(user, 'VIEW_PAYMENT')
  const canParcel = hasPermission(user, 'VIEW_PARCEL')
  const trips = data.operations?.todayTrips || []
  return <section className="page manager-workspace">
    <header className="manager-header"><div><p className="eyebrow">VANGUARD COACH / PILOTAGE</p><h1>Bonjour {user.firstName}</h1><p>{data.scope.departmentName}{data.scope.agencyName ? ` · ${data.scope.agencyName}` : ' · Vue départementale'}</p></div><button className="button secondary sm" onClick={() => query.refetch()} disabled={query.isFetching}><RotateCw size={15} /> Actualiser</button></header>
    <div className="manager-kpi-grid">{cards.map(({ label, value, note, icon: Icon }) => <article className="manager-kpi" key={label}><span className="manager-kpi-icon"><Icon size={18} /></span><span className="manager-kpi-label">{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="manager-overview-strip"><span>Voyages terminés : <strong>{kpis.completedTrips}</strong></span><span>Annulés : <strong>{kpis.cancelledTrips}</strong></span><span>Réservations annulées : <strong>{kpis.cancelledReservations}</strong></span><span>Agents actifs : <strong>{data.agents?.active ?? 0}</strong></span><span>Agents inactifs : <strong>{data.agents?.inactive ?? 0}</strong></span><span>Colis actifs : <strong>{kpis.activeParcels}</strong></span></div>
    <div className="manager-content-grid">
      <Panel title="Actions requises" subtitle="Alertes calculées depuis les opérations" action={<AlertTriangle size={18} />}>{data.alerts?.length ? <ul className="manager-alert-list">{data.alerts.map((alert) => <li key={alert.id}><span className={`manager-alert-dot ${alert.type}`} /><span>{alert.message}</span><strong>{alert.count}</strong></li>)}</ul> : <EmptyState title="Aucune action requise" description="Les opérations ne signalent aucune anomalie pour le moment." />}</Panel>
      <Panel title="Agences du périmètre" subtitle="Indicateurs limités à votre agence si votre compte y est rattaché">{data.agencies?.length ? <div className="manager-agency-list">{data.agencies.map((agency) => <div key={agency.id}><Building2 size={17} /><span><strong>{agency.name}</strong><small>{agency.code}</small></span></div>)}</div> : <EmptyState title="Aucune agence disponible" />}</Panel>
    </div>
    {canTrip && <Panel title="Voyages du jour" subtitle="Voyages sur des horaires, lignes et bus actifs" action={<Link className="button secondary sm" to="/transport/operations">Gérer les opérations</Link>}>{trips.length ? <Table headers={['Départ', 'Itinéraire', 'Bus', 'Agence', 'Sièges', 'Occupation', 'Statut']}>
      {trips.map((trip) => <tr key={trip.id}><td>{dateTime(trip.departureAt, lang)}</td><td>{trip.route}</td><td>{trip.bus}</td><td>{trip.agency}</td><td>{trip.reservedSeats}/{trip.capacity}</td><td>{trip.occupancyRate}%</td><td><StatusBadge status={trip.status} /></td></tr>)}
    </Table> : <EmptyState title="Aucun voyage prévu aujourd’hui" description="Les départs à venir apparaîtront ici." />}</Panel>}
    {canTrip && <Panel title="Prochains départs" subtitle="Voyages programmés avec ligne et véhicule actifs" action={<Link className="button secondary sm" to="/transport/operations">Tous les voyages</Link>}>{data.operations?.upcomingTrips?.length ? <Table headers={['Départ', 'Itinéraire', 'Bus', 'Agence', 'Sièges disponibles', 'Occupation']}>
      {data.operations.upcomingTrips.map((trip) => <tr key={trip.id}><td>{dateTime(trip.departureAt, lang)}</td><td>{trip.route}</td><td>{trip.bus}</td><td>{trip.agency}</td><td>{trip.availableSeats}/{trip.capacity}</td><td>{trip.occupancyRate}%</td></tr>)}
    </Table> : <EmptyState title="Aucun prochain départ" description="Aucun voyage opérationnel n’est programmé après aujourd’hui." />}</Panel>}
    <div className="manager-content-grid">
      {canReservation && <Panel title="Réservations récentes" subtitle="Clients et réservations dans votre périmètre" action={<Link className="button secondary sm" to="/transport/operations">Voir les opérations</Link>}>{data.reservations?.length ? <Table headers={['Code', 'Client', 'Voyage', 'Siège', 'Montant', 'Statut']}>
        {data.reservations.slice(0, 6).map((reservation) => <tr key={reservation.id}><td>{reservation.reservationCode}</td><td>{reservation.customerName}<small className="manager-cell-subtitle">{reservation.customerPhone}</small></td><td>{dateTime(reservation.trip?.departureAt, lang)}<small className="manager-cell-subtitle">{reservation.trip?.schedule?.route?.departureCity} – {reservation.trip?.schedule?.route?.arrivalCity}</small></td><td>{reservation.seatNumber}</td><td>{money(reservation.totalAmount, 'USD', lang)}</td><td><StatusBadge status={reservation.status} /><small className="manager-cell-subtitle">Paiement : {reservation.payments?.map((payment) => payment.status).join(', ') || '—'}</small></td></tr>)}
      </Table> : <EmptyState title="Aucune réservation récente" />}</Panel>}
      {canPayment && <Panel title="Paiements récents" subtitle="Supervision uniquement · validation selon les permissions Agent" action={<Link className="button secondary sm" to="/transport/operations">Ouvrir les opérations</Link>}><div className="manager-payment-summary"><span>Agence / cash <strong>{data.paymentSummary?.byChannel?.AGENCY || 0}</strong></span><span>En ligne <strong>{data.paymentSummary?.byChannel?.ONLINE || 0}</strong></span><span>Vérifiés <strong>{data.paymentSummary?.byStatus?.VERIFIED || 0}</strong></span><span>Terminés <strong>{data.paymentSummary?.byStatus?.COMPLETED || 0}</strong></span><span>Rejetés <strong>{data.paymentSummary?.byStatus?.REJECTED || 0}</strong></span></div>{data.payments?.length ? <Table headers={['Référence', 'Réservation / colis', 'Canal', 'Montant', 'Statut', 'Validé par']}>
        {data.payments.slice(0, 6).map((payment) => <tr key={payment.id}><td>{payment.reference || '—'}</td><td>{payment.reservation?.reservationCode || payment.parcel?.trackingCode || '—'}<small className="manager-cell-subtitle">{payment.reservation?.customerName || payment.parcel?.recipientName || '—'}</small></td><td>{payment.channel} · {payment.method}</td><td>{money(payment.amount, payment.currency, lang)}</td><td><StatusBadge status={payment.status} /></td><td>{payment.validatedBy ? `${payment.validatedBy.firstName} ${payment.validatedBy.lastName}` : '—'}</td></tr>)}
      </Table> : <EmptyState title="Aucun paiement récent" />}</Panel>}
    </div>
    {canParcel && <Panel title="Colis" subtitle={`${kpis.pendingParcelPayments} paiement(s) de colis en attente`} action={<Link className="button secondary sm" to="/transport/parcels">Gérer les colis</Link>}><div className="manager-parcel-grid">{Object.entries(data.parcels?.statuses || {}).map(([status, count]) => <div key={status}><span>{status.replaceAll('_', ' ')}</span><strong>{count}</strong></div>)}</div>{data.parcels?.recentAlerts?.length ? <div className="table-responsive"><Table headers={['Suivi', 'Destinataire', 'Statut', 'Mis à jour']}>{data.parcels.recentAlerts.map((parcel) => <tr key={parcel.id}><td>{parcel.trackingCode}</td><td>{parcel.recipientName}</td><td><StatusBadge status={parcel.status} /></td><td>{dateTime(parcel.updatedAt, lang)}</td></tr>)}</Table></div> : <p className="manager-muted">Aucune alerte colis.</p>}</Panel>}
    <Panel title="Activité récente" subtitle="Réservations, paiements et alertes colis" action={<Activity size={18} />}>{data.recentActivity?.length ? <ol className="manager-activity-list">{data.recentActivity.map((item) => <li key={item.id}><span className="manager-activity-icon"><Package size={15} /></span><span>{item.label}</span><time>{dateTime(item.at, lang)}</time></li>)}</ol> : <EmptyState title="Aucune activité récente" />}</Panel>
  </section>
}
