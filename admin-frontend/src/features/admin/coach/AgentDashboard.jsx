import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, CreditCard, Package, QrCode, Search, Ticket, UserRoundPlus } from 'lucide-react'
import { useAuth } from '../../auth/authContext'
import { useLanguage } from '../../../i18n/useLanguage'
import { hasPermission } from '../../auth/permissions'
import { api } from '../../../services/api'
import { Button, EmptyState, ErrorState, LoadingState, StatCard, StatusBadge } from '../../../components/ui'
import { TicketScanner } from './TicketScanner'

const queryKey = (id) => ['agent-dashboard', id]
const errorMessage = (error) => {
  if (error?.response?.status === 401) return 'Votre session a expire. Connectez-vous a nouveau.'
  if (error?.response?.status === 403) return 'Vous n avez pas les permissions necessaires pour cet espace.'
  return error?.response?.data?.message || error?.message || 'Le serveur n a pas pu charger les donnees.'
}
const dateTime = (value, lang) => new Date(value).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const time = (value, lang) => new Date(value).toLocaleTimeString(lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })
const money = (value, currency, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: currency || 'USD' }).format(Number(value || 0))
const route = (item) => item?.trip?.schedule?.route ? `${item.trip.schedule.route.departureCity} -> ${item.trip.schedule.route.arrivalCity}` : '-'

export function AgentOverview({ data }) {
  return <section className="agent-section"><div className="section-heading"><div><h2>Vue d ensemble</h2><p>Activite reelle de votre agence.</p></div></div><div className="dashboard-stats-grid">
    <StatCard icon={CalendarDays} title="Departs aujourd hui" value={data.overview.todayTrips} />
    <StatCard icon={Ticket} title="Reservations aujourd hui" value={data.overview.todayReservations} />
    <StatCard icon={CreditCard} title="Paiements a traiter" value={data.overview.pendingPayments} />
    <StatCard icon={CheckCircle2} title="Billets a controler" value={data.overview.ticketsToControl} />
  </div></section>
}

export function AgentQuickActions({ user, onScan }) {
  const actions = [
    hasPermission(user, 'CREATE_RESERVATION') && ['Nouvelle reservation', UserRoundPlus, '/transport/reservations'],
    hasPermission(user, 'VIEW_RESERVATION') && ['Gerer les reservations', Ticket, '/transport/reservations'],
    hasPermission(user, 'VIEW_PAYMENT') && ['Traiter les paiements', CreditCard, '/transport/operations'],
    hasPermission(user, 'SCAN_TICKET') && ['Scanner un billet', QrCode, null],
    hasPermission(user, 'VIEW_RESERVATION') && ['Rechercher un client', Search, '/transport/reservations'],
    hasPermission(user, 'CREATE_PARCEL') && ['Enregistrer un colis', Package, '/transport/parcels'],
  ].filter(Boolean)
  return <section className="agent-section agent-actions"><div className="section-heading"><div><h2>Actions rapides</h2><p>Operations disponibles pour votre compte.</p></div></div><div className="agent-actions__grid">
    {actions.map(([label, Icon, to]) => to ? <Link key={label} to={to} className="button"><Icon size={16} />{label}</Link> : <button key={label} type="button" className="button" onClick={onScan}><Icon size={16} />{label}</button>)}
    {!actions.length && <p className="empty">Aucune action autorisee.</p>}
  </div></section>
}

export function AgentDepartures({ data, lang }) {
  const departures = data.departures?.upcoming || []
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>Prochains departs</h2><p>Voyages du perimetre autorise.</p></div><Link to="/transport/trips" className="button secondary sm">Voir les voyages</Link></div>
    {!departures.length ? <EmptyState title="Aucun depart a venir" description="Le backend ne retourne aucun voyage pour votre agence." /> : <div className="table-responsive"><table className="data-table"><thead><tr><th>Heure</th><th>Trajet</th><th>Bus</th><th>Sieges</th><th>Reservees</th><th>Disponibles</th><th>Statut</th></tr></thead><tbody>{departures.map((trip) => <tr key={trip.id}><td><strong>{time(trip.departureAt, lang)}</strong><br /><small>{dateTime(trip.departureAt, lang)}</small></td><td>{trip.schedule?.route ? `${trip.schedule.route.departureCity} -> ${trip.schedule.route.arrivalCity}` : '-'}</td><td>{trip.schedule?.bus?.plateNumber || '-'}</td><td>{trip.schedule?.bus?.seats ?? '-'}</td><td>{trip.seatsReserved}</td><td>{trip.seatsRemaining}</td><td><StatusBadge status={trip.status} /></td></tr>)}</tbody></table></div>}
  </section>
}

export function AgentReservations({ reservations, lang }) {
  const [search, setSearch] = useState('')
  const [ticketError, setTicketError] = useState(null)
  const term = search.trim().toLowerCase()
  const visible = reservations.filter((item) => !term || [item.reservationCode, item.customerName, item.customerPhone].some((value) => String(value || '').toLowerCase().includes(term)))
  const printTicket = async (ticketCode) => {
    try {
      setTicketError(null)
      const response = await api.get(`/api/tickets/${ticketCode}/print`, { responseType: 'blob' })
      window.open(URL.createObjectURL(response.data), '_blank', 'noopener,noreferrer')
    } catch (error) {
      setTicketError(errorMessage(error))
    }
  }
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>Reservations</h2><p>Consultation et traitements autorises.</p></div><Link to="/transport/reservations" className="button secondary sm">Ouvrir la gestion</Link></div><div className="agent-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Code, client ou telephone" aria-label="Rechercher une reservation" /></div>{ticketError && <div className="alert alert-danger" role="alert">{ticketError}</div>}
    {!visible.length ? <EmptyState title={reservations.length ? 'Aucun resultat' : 'Aucune reservation'} description={reservations.length ? 'Aucune reservation ne correspond a la recherche.' : 'Le backend ne retourne aucune reservation.'} /> : <div className="table-responsive"><table className="data-table"><thead><tr><th>Reservation</th><th>Client</th><th>Voyage</th><th>Siege</th><th>Montant</th><th>Paiement</th><th>Actions</th></tr></thead><tbody>{visible.slice(0, 50).map((item) => { const ticketCode = item.tickets?.[0]?.ticketCode; return <tr key={item.id}><td><strong>{item.reservationCode}</strong><br /><small>{dateTime(item.createdAt, lang)}</small></td><td>{item.customerName}<br /><small>{item.customerPhone}</small></td><td>{route(item)}<br /><small>{item.trip?.departureAt ? dateTime(item.trip.departureAt, lang) : '-'}</small></td><td>{item.seatNumber}</td><td>{money(item.totalAmount, item.currency, lang)}</td><td><StatusBadge status={item.payments?.[0]?.status || 'PENDING'} /></td><td className="agent-inline-actions"><Link to="/transport/reservations" className="button secondary sm">Consulter</Link><Link to="/transport/operations" className="button secondary sm">Paiement</Link>{ticketCode && <button type="button" className="button secondary sm" onClick={() => printTicket(ticketCode)}>Ticket</button>}</td></tr> })}</tbody></table></div>}
  </section>
}

export function AgentPayments({ payments, userId, lang }) {
  const client = useQueryClient()
  const [error, setError] = useState(null)
  const validate = useMutation({ mutationFn: (id) => api.post(`/api/reservation-payments/${id}/validate`), onSuccess: () => { setError(null); client.invalidateQueries({ queryKey: queryKey(userId) }) }, onError: (errorValue) => setError(errorMessage(errorValue)) })
  const pending = payments.pending || []
  const cash = pending.filter((item) => item.channel !== 'ONLINE')
  const online = pending.filter((item) => item.channel === 'ONLINE')
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>Paiements</h2><p>Validation executee par l API backend.</p></div><Link to="/transport/operations" className="button secondary sm">Operations</Link></div>{error && <div className="alert alert-danger" role="alert">{error}</div>}
    {!pending.length && !payments.validatedToday?.length ? <EmptyState title="Aucun paiement" description="Aucun paiement reel a traiter ou valide aujourd hui." /> : <><div className="agent-payment-summary">{cash.length} cash a traiter, {online.length} online en attente.</div>{pending.length > 0 && <div className="table-responsive"><table className="data-table"><thead><tr><th>Reservation</th><th>Canal</th><th>Montant</th><th>Methode</th><th>Reference</th><th>Date</th><th>Action</th></tr></thead><tbody>{pending.map((item) => <tr key={item.id}><td>{item.reservation?.reservationCode || '-'}</td><td>{item.channel === 'ONLINE' ? 'Online' : 'Cash / agence'}</td><td>{money(item.amount, item.currency, lang)}</td><td>{item.method || '-'}</td><td>{item.reference || '-'}</td><td>{dateTime(item.createdAt, lang)}</td><td>{item.channel === 'ONLINE' ? <StatusBadge status={item.status} /> : <Button size="sm" loading={validate.isPending && validate.variables === item.id} onClick={() => validate.mutate(item.id)}>Valider cash</Button>}</td></tr>)}</tbody></table></div>}{!!payments.validatedToday?.length && <div className="agent-subsection"><h3>Valides aujourd hui</h3><div className="table-responsive"><table className="data-table"><thead><tr><th>Reservation</th><th>Montant</th><th>Methode</th><th>Reference</th><th>Valide par</th><th>Date</th></tr></thead><tbody>{payments.validatedToday.map((item) => <tr key={item.id}><td>{item.reservation?.reservationCode || '-'}</td><td>{money(item.amount, item.currency, lang)}</td><td>{item.method || '-'}</td><td>{item.reference || '-'}</td><td>{item.validatedBy ? `${item.validatedBy.firstName} ${item.validatedBy.lastName}` : '-'}</td><td>{dateTime(item.validatedAt, lang)}</td></tr>)}</tbody></table></div></div>}</>}
  </section>
}

export function AgentTicketControl({ data, onScan, lang }) {
  const scans = data.tickets?.recentScans || []
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>Tickets / controle</h2><p>Les scans sont enregistres par le backend.</p></div><Button icon={QrCode} onClick={onScan}>Scanner un billet</Button></div>{!scans.length ? <EmptyState title="Aucun scan recent" description="L historique de votre agence apparaitra ici." /> : <div className="table-responsive"><table className="data-table"><thead><tr><th>Billet</th><th>Resultat</th><th>Statut</th><th>Agent</th><th>Date</th></tr></thead><tbody>{scans.map((scan) => <tr key={scan.id}><td>{scan.ticket?.ticketCode || '-'}</td><td>{scan.result}</td><td><StatusBadge status={scan.ticket?.status} /></td><td>{scan.scannedBy ? `${scan.scannedBy.firstName} ${scan.scannedBy.lastName}` : '-'}</td><td>{dateTime(scan.scannedAt, lang)}</td></tr>)}</tbody></table></div>}</section>
}

export function AgentParcels({ parcels }) {
  return <section className="dashboard-panel agent-section"><div className="section-heading"><div><h2>Colis</h2><p>Suivi des colis lies a votre agence.</p></div><Link to="/transport/parcels" className="button secondary sm">Gerer les colis</Link></div><div className="agent-parcel-grid"><div><strong>{parcels.registered}</strong><span>Enregistres</span></div><div><strong>{parcels.inTransit}</strong><span>En transit</span></div><div><strong>{parcels.arrived}</strong><span>Arrives</span></div><div><strong>{parcels.readyForPickup}</strong><span>Prets a retirer</span></div></div></section>
}

export function AgentDashboard() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const client = useQueryClient()
  const [showScanner, setShowScanner] = useState(false)
  const query = useQuery({ queryKey: queryKey(user?.id), queryFn: async () => { const response = await api.get('/api/agent/dashboard'); if (!response.data?.success) throw new Error('La reponse du dashboard est invalide.'); return response.data.data }, enabled: Boolean(user), staleTime: 15000 })
  if (!user) return null
  if (query.isPending) return <section className="page agent-workspace"><LoadingState message="Chargement de votre espace de travail..." /></section>
  if (query.isError) return <section className="page agent-workspace"><ErrorState title="Espace Agent indisponible" message={errorMessage(query.error)} onRetry={query.refetch} /></section>
  const data = query.data
  return <section className="page agent-workspace"><div className="agent-header"><div><p className="eyebrow">VANGUARD COACH / POSTE OPERATIONNEL</p><h1>Espace Agent</h1><p>Bonjour {user.firstName}. Les informations proviennent du backend.</p></div><span className="badge active">Session active</span></div><AgentQuickActions user={user} onScan={() => setShowScanner(true)} /><AgentOverview data={data} /><AgentDepartures data={data} lang={lang} /><AgentReservations reservations={data.reservations || []} lang={lang} /><AgentPayments payments={data.payments || { pending: [], validatedToday: [] }} userId={user.id} lang={lang} /><AgentTicketControl data={data} lang={lang} onScan={() => setShowScanner(true)} /><AgentParcels parcels={data.parcels || { registered: 0, inTransit: 0, arrived: 0, readyForPickup: 0 }} />{showScanner && <TicketScanner onClose={() => setShowScanner(false)} onSuccess={() => client.invalidateQueries({ queryKey: queryKey(user.id) })} />}</section>
}
