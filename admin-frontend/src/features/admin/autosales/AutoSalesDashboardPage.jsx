import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { CarFront, FileSpreadsheet, Ticket, CreditCard, Plus, RefreshCw, CheckCircle2, Users, BadgeDollarSign } from 'lucide-react'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardContent, Button, StatusBadge, LoadingState, ErrorState, EmptyState } from '../../../components/ui'

const fetchDashboard = async () => (await api.get('/api/dashboard/autosales')).data?.data
const statuses = (source, order) => order.map((status) => ({ status, count: source?.[status] || 0 }))
const formatNumber = (value, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(value || 0)
const formatDate = (value, lang) => value ? new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', { dateStyle: 'medium' }).format(new Date(value)) : '—'
const money = (values, lang) => {
  const entries = Object.entries(values || {})
  if (!entries.length) return '—'
  return entries.map(([currency, amount]) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0))).join(' · ')
}

function Panel({ title, to, children }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle>{to && <Link to={to} style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>Ouvrir →</Link>}</CardHeader><CardContent>{children}</CardContent></Card>
}

export function AutoSalesDashboardPage() {
  const { user } = useAuth()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['autosales-dashboard'], queryFn: fetchDashboard })
  const data = query.data
  const can = (permission) => hasPermission(user, permission)

  if (query.isPending) return <div className="page"><PageHeader eyebrow="VANGUARD SERVICES · AUTO SALES" title="Pilotage commercial" subtitle="Stock, demandes, réservations, paiements et ventes." /><LoadingState type="cards" cardCount={4} /></div>
  if (query.isError) return <div className="page"><PageHeader eyebrow="VANGUARD SERVICES · AUTO SALES" title="Pilotage commercial" subtitle="Stock, demandes, réservations, paiements et ventes." /><ErrorState title={query.error?.response?.status === 403 ? 'Accès non autorisé' : 'Dashboard indisponible'} message={query.error?.response?.data?.message || 'Impossible de charger les données commerciales AutoSales.'} onRetry={() => query.refetch()} /></div>

  const stock = data.stock
  const inquiries = data.inquiries
  const reservations = data.reservations
  const payments = data.payments
  const sales = data.sales
  const quickActions = [
    can('CREATE_VEHICLE') && ['Ajouter un véhicule', '/automobile/vehicles', Plus],
    can('VIEW_VEHICLE') && ['Voir le stock', '/automobile/vehicles', CarFront],
    can('VIEW_VEHICLE_INQUIRY') && ['Voir les demandes', '/automobile/inquiries', FileSpreadsheet],
    can('MANAGE_VEHICLE_RESERVATION') && ['Créer une réservation', '/automobile/reservations?create=1', Ticket],
    can('VIEW_RESERVATION') && ['Voir les réservations', '/automobile/reservations', Ticket],
    can('VIEW_RESERVATION') && ['Voir les paiements', '/automobile/payments', CreditCard],
    can('MANAGE_VEHICLE_RESERVATION') && ['Enregistrer un paiement', '/automobile/payments?create=1', BadgeDollarSign],
    can('VIEW_RESERVATION') && ['Voir les ventes', '/automobile/sales', CheckCircle2],
    can('VIEW_USER') && ['Gérer les agents', '/automobile/agents', Users],
  ].filter(Boolean)
  const inquiryStatuses = statuses(inquiries?.byStatus, ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED'])
  const reservationStatuses = statuses(reservations?.byStatus, ['PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'COMPLETED'])
  const paymentStatuses = statuses(payments?.byStatus, ['PENDING', 'VERIFIED', 'REJECTED', 'COMPLETED'])

  return (
    <div className="page autosales-dashboard">
      <PageHeader eyebrow="VANGUARD SERVICES · AUTO SALES" title="Pilotage commercial" subtitle={`Vue opérationnelle du département automobile · Devise configurée ${data.scope?.currency || 'USD'}.`}
        actions={<Button variant="secondary" size="sm" icon={RefreshCw} loading={query.isFetching} onClick={() => query.refetch()}>Actualiser</Button>} />

      {quickActions.length > 0 && <section className="autosales-quick-actions"><h2>Actions rapides</h2><div>{quickActions.map(([label, path, Icon]) => <Button key={path + label} variant="outline" size="sm" icon={Icon} onClick={() => navigate(path)}>{label}</Button>)}</div></section>}

      <div className="vanguard-stats-grid">
        <StatCard title="Véhicules en stock" value={stock ? formatNumber(stock.total, lang) : '—'} subtitle={stock ? `${formatNumber(stock.byStatus.AVAILABLE, lang)} disponibles · ${reservations ? formatNumber((reservations.byStatus.PENDING || 0) + (reservations.byStatus.CONFIRMED || 0), lang) : '—'} réservations actives` : 'Permission stock non attribuée'} icon={CarFront} accent="auto" onClick={stock ? () => navigate('/automobile/vehicles') : undefined} />
        <StatCard title="Nouvelles demandes" value={inquiries ? formatNumber(inquiries.byStatus.NEW, lang) : '—'} subtitle={inquiries ? `${formatNumber(inquiries.total, lang)} demandes dans votre périmètre` : 'Permission demandes non attribuée'} icon={FileSpreadsheet} accent="primary" onClick={inquiries ? () => navigate('/automobile/inquiries') : undefined} />
        <StatCard title="Réservations actives" value={reservations ? formatNumber((reservations.byStatus.PENDING || 0) + (reservations.byStatus.CONFIRMED || 0), lang) : '—'} subtitle="Statuts PENDING + CONFIRMED" icon={Ticket} accent="warning" onClick={reservations ? () => navigate('/automobile/reservations') : undefined} />
        <StatCard title="Ventes finalisées" value={sales ? formatNumber(sales.count, lang) : '—'} subtitle={sales ? money(sales.revenueByCurrency, lang) : 'Permission réservations non attribuée'} icon={CheckCircle2} accent="revenue" onClick={sales ? () => navigate('/automobile/sales') : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
        <Panel title="Stock véhicules" to={stock ? '/automobile/vehicles' : null}>{stock ? <><div className="autosales-status-list">{statuses(stock.byStatus, ['AVAILABLE', 'RESERVED', 'SOLD', 'IN_MAINTENANCE']).map(({ status, count }) => <div key={status}><span>{status.replaceAll('_', ' ')}</span><StatusBadge label={formatNumber(count, lang)} status={status} /></div>)}</div><h3 style={{ margin: '18px 0 8px' }}>Derniers véhicules ajoutés</h3>{stock.recent.length ? stock.recent.map((vehicle) => <Link key={vehicle.id} to={`/automobile/vehicles/${vehicle.id}`} className="autosales-activity-row"><strong>{vehicle.brand} {vehicle.model} ({vehicle.year})</strong><span>{formatDate(vehicle.createdAt, lang)} · {money({ [vehicle.currency || data.scope.currency]: vehicle.price }, lang)}</span></Link>) : <p className="empty">Aucun véhicule enregistré.</p>}</> : <EmptyState title="Données de stock non accessibles" description="Votre rôle ne dispose pas de VIEW_VEHICLE." />}</Panel>

        <Panel title="Pipeline des demandes" to={inquiries ? '/automobile/inquiries' : null}>{inquiries ? <><div className="autosales-status-list">{inquiryStatuses.map(({ status, count }) => <div key={status}><span>{status.replaceAll('_', ' ')}</span><StatusBadge label={formatNumber(count, lang)} status={status} /></div>)}</div><h3 style={{ margin: '18px 0 8px' }}>Demandes récentes</h3>{inquiries.recent.length ? inquiries.recent.map((item) => <Link key={item.id} to={user?.role === 'AGENT' ? `/automobile/agent/inquiries/${item.id}` : '/automobile/inquiries'} className="autosales-activity-row"><strong>{item.customerName}</strong><span>{item.vehicle ? `${item.vehicle.brand} ${item.vehicle.model}` : 'Véhicule'} · {formatDate(item.createdAt, lang)} · {item.status}</span></Link>) : <p className="empty">Aucune demande dans votre périmètre.</p>}</> : <EmptyState title="Demandes non accessibles" description="Votre rôle ne dispose pas de VIEW_VEHICLE_INQUIRY." />}</Panel>

        <Panel title="Réservations" to={reservations ? '/automobile/reservations' : null}>{reservations ? <><div className="autosales-status-list">{reservationStatuses.map(({ status, count }) => <div key={status}><span>{status}</span><StatusBadge label={formatNumber(count, lang)} status={status} /></div>)}</div><h3 style={{ margin: '18px 0 8px' }}>Dernières réservations</h3>{reservations.recent.length ? reservations.recent.map((item) => <Link key={item.id} to="/automobile/reservations" className="autosales-activity-row"><strong>{item.reservationCode} · {item.customerName}</strong><span>{item.vehicle?.brand} {item.vehicle?.model} · {item.status} · {formatDate(item.createdAt, lang)}</span></Link>) : <p className="empty">Aucune réservation dans votre périmètre.</p>}</> : <EmptyState title="Réservations non accessibles" description="Votre rôle ne dispose pas de VIEW_RESERVATION." />}</Panel>

        <Panel title="Paiements et encaissements" to={payments ? '/automobile/payments' : null}>{payments ? <><div className="autosales-status-list">{paymentStatuses.map(({ status, count }) => <div key={status}><span>{status}</span><StatusBadge label={formatNumber(count, lang)} status={status} /></div>)}</div><div style={{ display: 'grid', gap: 8, marginTop: 16 }}><div><strong>Encaissé</strong><div>{money(payments.collectedByCurrency, lang)}</div></div><div><strong>Solde des réservations actives et clôturées</strong><div>{money(payments.outstandingByCurrency, lang)}</div></div></div><h3 style={{ margin: '18px 0 8px' }}>Paiements récents</h3>{payments.recent.length ? payments.recent.map((item) => <Link key={item.id} to="/automobile/payments" className="autosales-activity-row"><strong>{item.reference || item.vehicleReservation?.reservationCode} · {item.vehicleReservation?.customerName}</strong><span>{money({ [item.currency || data.scope.currency]: item.amount }, lang)} · {item.status} · {formatDate(item.createdAt, lang)}</span></Link>) : <p className="empty">Aucun paiement enregistré.</p>}</> : <EmptyState title="Paiements non accessibles" description="Votre rôle ne dispose pas de VIEW_RESERVATION." />}</Panel>

        <Panel title="Ventes finalisées" to={sales ? '/automobile/sales' : null}>{sales ? <><p><strong>{formatNumber(sales.count, lang)}</strong> réservations clôturées comme ventes</p><p>Montant des ventes : <strong>{money(sales.revenueByCurrency, lang)}</strong></p><p>Paiements encaissés : <strong>{money(sales.collectedByCurrency, lang)}</strong></p><p>Solde restant : <strong>{money(sales.outstandingByCurrency, lang)}</strong></p></> : <EmptyState title="Ventes non accessibles" description="Votre rôle ne dispose pas de VIEW_RESERVATION." />}</Panel>

        <Panel title="Actions requises">{data.actionsRequired.length ? <div>{data.actionsRequired.map((action) => <Link key={action.type} to={action.path} className="autosales-action-row"><span><strong>{formatNumber(action.count, lang)}</strong> {action.label}</span><span aria-hidden="true">→</span></Link>)}</div> : <EmptyState title="Aucune action en attente" description="Aucune demande, réservation ou échéance ne nécessite actuellement votre intervention." icon={CheckCircle2} />}</Panel>
      </div>

      {can('VIEW_USER') && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><Link to="/automobile/agents">Gestion des agents →</Link></div>}
    </div>
  )
}
