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
const localizedStatus = (status, t) => {
  const translated = t(`status.${String(status || '').toLowerCase()}`)
  return translated.startsWith('status.') ? String(status || '').replaceAll('_', ' ') : translated
}

function Panel({ title, to, children }) {
  const { t } = useLanguage()
  return <Card><CardHeader><CardTitle>{title}</CardTitle>{to && <Link to={to} style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>{t('autoDashboard.open')} →</Link>}</CardHeader><CardContent>{children}</CardContent></Card>
}

export function AutoSalesDashboardPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['autosales-dashboard'], queryFn: fetchDashboard })
  const data = query.data
  const can = (permission) => hasPermission(user, permission)

  if (query.isPending) return <div className="page"><PageHeader eyebrow={t('autoDashboard.eyebrow')} title={t('autoDashboard.title')} subtitle={t('autoDashboard.subtitle')} /><LoadingState type="cards" cardCount={4} /></div>
  if (query.isError || !data) return <div className="page"><PageHeader eyebrow={t('autoDashboard.eyebrow')} title={t('autoDashboard.title')} subtitle={t('autoDashboard.subtitle')} /><ErrorState title={query.error?.response?.status === 403 ? t('autoDashboard.unauthorized') : t('autoDashboard.unavailable')} message={query.error?.response?.data?.message || t('autoDashboard.loadError')} onRetry={() => query.refetch()} /></div>

  const stock = data.stock
  const inquiries = data.inquiries
  const reservations = data.reservations
  const payments = data.payments
  const sales = data.sales
  const quickActions = [
    can('CREATE_VEHICLE') && ['addVehicle', '/automobile/vehicles', Plus],
    can('VIEW_VEHICLE') && ['viewStock', '/automobile/vehicles', CarFront],
    can('VIEW_VEHICLE_INQUIRY') && ['viewInquiries', '/automobile/inquiries', FileSpreadsheet],
    can('MANAGE_VEHICLE_RESERVATION') && ['createReservation', '/automobile/reservations?create=1', Ticket],
    can('VIEW_RESERVATION') && ['viewReservations', '/automobile/reservations', Ticket],
    can('VIEW_RESERVATION') && ['viewPayments', '/automobile/payments', CreditCard],
    can('MANAGE_VEHICLE_RESERVATION') && ['registerPayment', '/automobile/payments?create=1', BadgeDollarSign],
    can('VIEW_RESERVATION') && ['viewSales', '/automobile/sales', CheckCircle2],
    can('VIEW_USER') && ['manageAgents', '/automobile/agents', Users],
  ].filter(Boolean)
  const inquiryStatuses = statuses(inquiries?.byStatus, ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED'])
  const reservationStatuses = statuses(reservations?.byStatus, ['PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'COMPLETED'])
  const paymentStatuses = statuses(payments?.byStatus, ['PENDING', 'VERIFIED', 'REJECTED', 'COMPLETED'])

  return (
    <div className="page autosales-dashboard">
      <PageHeader eyebrow={t('autoDashboard.eyebrow')} title={t('autoDashboard.title')} subtitle={t('autoDashboard.operational').replace('{currency}', data.scope?.currency || 'USD')}
        actions={<Button variant="secondary" size="sm" icon={RefreshCw} loading={query.isFetching} onClick={() => query.refetch()}>{t('autoDashboard.refresh')}</Button>} />

      {quickActions.length > 0 && <section className="autosales-quick-actions"><h2>{t('autoDashboard.quickActions')}</h2><div>{quickActions.map(([labelKey, path, Icon]) => <Button key={path + labelKey} variant="outline" size="sm" icon={Icon} onClick={() => navigate(path)}>{t(`autoDashboard.${labelKey}`)}</Button>)}</div></section>}

      <div className="vanguard-stats-grid">
        <StatCard title={t('autoDashboard.stockVehicles')} value={stock ? formatNumber(stock.total, lang) : '—'} subtitle={stock ? t('autoDashboard.availableAndReserved').replace('{available}', formatNumber(stock.byStatus.AVAILABLE, lang)).replace('{reserved}', formatNumber((reservations?.byStatus.PENDING || 0) + (reservations?.byStatus.CONFIRMED || 0), lang)) : t('autoDashboard.stockPermission')} icon={CarFront} accent="auto" onClick={stock ? () => navigate('/automobile/vehicles') : undefined} />
        <StatCard title={t('autoDashboard.newInquiries')} value={inquiries ? formatNumber(inquiries.byStatus.NEW, lang) : '—'} subtitle={inquiries ? t('autoDashboard.inquiriesScope').replace('{count}', formatNumber(inquiries.total, lang)) : t('autoDashboard.inquiryPermission')} icon={FileSpreadsheet} accent="primary" onClick={inquiries ? () => navigate('/automobile/inquiries') : undefined} />
        <StatCard title={t('autoDashboard.activeReservations')} value={reservations ? formatNumber((reservations.byStatus.PENDING || 0) + (reservations.byStatus.CONFIRMED || 0), lang) : '—'} subtitle={t('autoDashboard.activeReservationStatuses')} icon={Ticket} accent="warning" onClick={reservations ? () => navigate('/automobile/reservations') : undefined} />
        <StatCard title={t('autoDashboard.completedSales')} value={sales ? formatNumber(sales.count, lang) : '—'} subtitle={sales ? money(sales.revenueByCurrency, lang) : t('autoDashboard.reservationPermission')} icon={CheckCircle2} accent="revenue" onClick={sales ? () => navigate('/automobile/sales') : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
        <Panel title={t('autoDashboard.stockPanel')} to={stock ? '/automobile/vehicles' : null}>{stock ? <><div className="autosales-status-list">{statuses(stock.byStatus, ['AVAILABLE', 'RESERVED', 'SOLD', 'IN_MAINTENANCE']).map(({ status, count }) => <div key={status}><span>{localizedStatus(status, t)}</span><StatusBadge label={formatNumber(count, lang)} status={status} /></div>)}</div><h3 style={{ margin: '18px 0 8px' }}>{t('autoDashboard.latestVehicles')}</h3>{stock.recent.length ? stock.recent.map((vehicle) => <Link key={vehicle.id} to={`/automobile/vehicles/${vehicle.id}`} className="autosales-activity-row"><strong>{vehicle.brand} {vehicle.model} ({vehicle.year})</strong><span>{formatDate(vehicle.createdAt, lang)} · {money({ [vehicle.currency || data.scope.currency]: vehicle.price }, lang)}</span></Link>) : <p className="empty">{t('autoDashboard.noVehicles')}</p>}</> : <EmptyState title={t('autoDashboard.stockUnavailable')} description={t('autoDashboard.needsVehiclePermission')} />}</Panel>

        <Panel title={t('autoDashboard.inquiryPipeline')} to={inquiries ? '/automobile/inquiries' : null}>{inquiries ? <><div className="autosales-status-list">{inquiryStatuses.map(({ status, count }) => <div key={status}><span>{localizedStatus(status, t)}</span><StatusBadge label={formatNumber(count, lang)} status={status} /></div>)}</div><h3 style={{ margin: '18px 0 8px' }}>{t('autoDashboard.recentInquiries')}</h3>{inquiries.recent.length ? inquiries.recent.map((item) => <Link key={item.id} to={user?.role === 'AGENT' ? `/automobile/agent/inquiries/${item.id}` : '/automobile/inquiries'} className="autosales-activity-row"><strong>{item.customerName}</strong><span>{item.vehicle ? `${item.vehicle.brand} ${item.vehicle.model}` : t('resourceFields.vehicles')} · {formatDate(item.createdAt, lang)} · {localizedStatus(item.status, t)}</span></Link>) : <p className="empty">{t('autoDashboard.noInquiries')}</p>}</> : <EmptyState title={t('autoDashboard.inquiriesUnavailable')} description={t('autoDashboard.needsInquiryPermission')} />}</Panel>

        <Panel title={t('autoDashboard.reservations')} to={reservations ? '/automobile/reservations' : null}>{reservations ? <><div className="autosales-status-list">{reservationStatuses.map(({ status, count }) => <div key={status}><span>{localizedStatus(status, t)}</span><StatusBadge label={formatNumber(count, lang)} status={status} /></div>)}</div><h3 style={{ margin: '18px 0 8px' }}>{t('autoDashboard.latestReservations')}</h3>{reservations.recent.length ? reservations.recent.map((item) => <Link key={item.id} to="/automobile/reservations" className="autosales-activity-row"><strong>{item.reservationCode} · {item.customerName}</strong><span>{item.vehicle?.brand} {item.vehicle?.model} · {localizedStatus(item.status, t)} · {formatDate(item.createdAt, lang)}</span></Link>) : <p className="empty">{t('autoDashboard.noReservations')}</p>}</> : <EmptyState title={t('autoDashboard.reservationsUnavailable')} description={t('autoDashboard.role')} />}</Panel>

        <Panel title={t('autoDashboard.payments')} to={payments ? '/automobile/payments' : null}>{payments ? <><div className="autosales-status-list">{paymentStatuses.map(({ status, count }) => <div key={status}><span>{localizedStatus(status, t)}</span><StatusBadge label={formatNumber(count, lang)} status={status} /></div>)}</div><div style={{ display: 'grid', gap: 8, marginTop: 16 }}><div><strong>{t('autoDashboard.collected')}</strong><div>{money(payments.collectedByCurrency, lang)}</div></div><div><strong>{t('autoDashboard.balance')}</strong><div>{money(payments.outstandingByCurrency, lang)}</div></div></div><h3 style={{ margin: '18px 0 8px' }}>{t('autoDashboard.recentPayments')}</h3>{payments.recent.length ? payments.recent.map((item) => <Link key={item.id} to="/automobile/payments" className="autosales-activity-row"><strong>{item.reference || item.vehicleReservation?.reservationCode} · {item.vehicleReservation?.customerName}</strong><span>{money({ [item.currency || data.scope.currency]: item.amount }, lang)} · {localizedStatus(item.status, t)} · {formatDate(item.createdAt, lang)}</span></Link>) : <p className="empty">{t('autoDashboard.noPayments')}</p>}</> : <EmptyState title={t('autoDashboard.paymentsUnavailable')} description={t('autoDashboard.role')} />}</Panel>

        <Panel title={t('autoDashboard.sales')} to={sales ? '/automobile/sales' : null}>{sales ? <><p><strong>{formatNumber(sales.count, lang)}</strong> {t('autoDashboard.completedReservations')}</p><p>{t('autoDashboard.salesAmount')} <strong>{money(sales.revenueByCurrency, lang)}</strong></p><p>{t('autoDashboard.collectedPayments')} <strong>{money(sales.collectedByCurrency, lang)}</strong></p><p>{t('autoDashboard.remainingBalance')} <strong>{money(sales.outstandingByCurrency, lang)}</strong></p></> : <EmptyState title={t('autoDashboard.salesUnavailable')} description={t('autoDashboard.role')} />}</Panel>

        <Panel title={t('autoDashboard.actionsRequired')}>{data.actionsRequired.length ? <div>{data.actionsRequired.map((action) => <Link key={action.type} to={action.path} className="autosales-action-row"><span><strong>{formatNumber(action.count, lang)}</strong> {t(`autoDashboard.actionTypes.${action.type}`).startsWith('autoDashboard.actionTypes.') ? action.label : t(`autoDashboard.actionTypes.${action.type}`)}</span><span aria-hidden="true">→</span></Link>)}</div> : <EmptyState title={t('autoDashboard.noActions')} description={t('autoDashboard.noActionDescription')} icon={CheckCircle2} />}</Panel>
      </div>

      {can('VIEW_USER') && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><Link to="/automobile/agents">{t('autoDashboard.agentManagement')} →</Link></div>}
    </div>
  )
}
