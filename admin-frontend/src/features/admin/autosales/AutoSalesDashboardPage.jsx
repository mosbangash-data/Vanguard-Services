import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'

const items = (data) => data?.items || data?.data?.items || data?.data || data || []
const statusLabel = (status, t) => t(`status.${String(status).toLowerCase()}`) || status
const money = (amount, currency, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(Number(amount || 0))

export function AutoSalesDashboardPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()

  const canViewVehicles = hasPermission(user, 'VIEW_VEHICLE') || user?.role === 'SUPER_ADMIN'
  const canViewInquiries = hasPermission(user, 'VIEW_VEHICLE_INQUIRY') || user?.role === 'SUPER_ADMIN'
  const canViewReservations = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN'
  const canViewPayments = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN'

  const vehicles = useQuery({
    queryKey: ['autosales-dashboard-vehicles'],
    queryFn: async () => {
      const response = await api.get('/api/vehicles', { params: { page: 1, limit: 100 } })
      return response.data?.data || response.data
    },
    enabled: canViewVehicles,
  })

  const inquiries = useQuery({
    queryKey: ['autosales-dashboard-inquiries'],
    queryFn: async () => {
      const response = await api.get('/api/vehicle-inquiries', { params: { page: 1, limit: 100 } })
      return response.data?.data || response.data
    },
    enabled: canViewInquiries,
  })

  const reservations = useQuery({
    queryKey: ['autosales-dashboard-reservations'],
    queryFn: async () => {
      const response = await api.get('/api/vehicle-reservations', { params: { page: 1, limit: 200 } })
      return response.data?.data || response.data
    },
    enabled: canViewReservations,
  })

  const paymentEntries = useQuery({
    queryKey: ['autosales-dashboard-payments'],
    queryFn: async () => {
      const reservationList = items(reservations.data)
      if (reservationList.length === 0) return []

      const responses = await Promise.all(
        reservationList.map(async (reservation) => {
          const response = await api.get(`/api/vehicle-payments/reservation/${reservation.id}`)
          const list = response.data?.data?.payments || response.data?.data || response.data || []
          return items(list).map((payment) => ({ ...payment, reservationId: reservation.id }))
        }),
      )

      return responses.flat()
    },
    enabled: canViewPayments && !!reservations.data,
  })

  const vehicleList = items(vehicles.data)
  const inquiryList = items(inquiries.data)
  const reservationList = items(reservations.data)
  const paymentList = items(paymentEntries.data)

  const vehicleStats = ['AVAILABLE', 'RESERVED', 'SOLD', 'IN_MAINTENANCE'].map((status) => ({
    status,
    value: vehicleList.filter((vehicle) => String(vehicle.status).toUpperCase() === status).length,
  }))

  const inquiryStats = ['NEW', 'IN_PROGRESS', 'CONVERTED'].map((status) => ({
    status,
    value: inquiryList.filter((inquiry) => String(inquiry.status).toUpperCase() === status).length,
  }))

  const activeReservationCount = reservationList.filter((reservation) => ['PENDING', 'CONFIRMED'].includes(String(reservation.status).toUpperCase())).length
  const pendingPaymentCount = paymentList.filter((payment) => String(payment.status).toUpperCase() === 'PENDING').length
  const convertedSalesCount = reservationList.filter((reservation) => ['COMPLETED', 'CONVERTED'].includes(String(reservation.status).toUpperCase()) || String(reservation.paymentStatus || '').toUpperCase() === 'COMPLETED').length
  const conversionCount = inquiryList.filter((inquiry) => String(inquiry.status).toUpperCase() === 'CONVERTED').length

  const loading = (canViewVehicles && vehicles.isPending)
    || (canViewInquiries && inquiries.isPending)
    || (canViewReservations && reservations.isPending)
    || (canViewPayments && paymentEntries.isPending)

  const error = (canViewVehicles && vehicles.isError)
    || (canViewInquiries && inquiries.isError)
    || (canViewReservations && reservations.isError)
    || (canViewPayments && paymentEntries.isError)

  return <section className="page autosales-dashboard">
    <div className="page-head"><div><p className="autosales-eyebrow">VANGUARD SERVICES · AUTOSALES</p><h1>{t('autosales.title')}</h1><p>{t('autosales.subtitle')}</p></div></div>
    {loading && <p>{t('dashboard.loading')}</p>}
    {error && <p className="error">{t('dashboard.errorState')}</p>}
    {!loading && !error && <>
      <div className="dashboard-stats-grid">
        {canViewVehicles && <article className="stat-card"><small>{t('autosales.totalVehicles')}</small><strong className="stat-value">{vehicleList.length}</strong></article>}
        {canViewReservations && <article className="stat-card"><small>{t('autosales.nav.reservations')}</small><strong className="stat-value">{reservationList.length}</strong></article>}
        {canViewPayments && <article className="stat-card"><small>{t('autosales.nav.payments')}</small><strong className="stat-value">{paymentList.length}</strong></article>}
        {canViewReservations && <article className="stat-card"><small>{t('autosales.nav.sales')}</small><strong className="stat-value">{convertedSalesCount}</strong></article>}
        {vehicleStats.filter(({ status }) => canViewVehicles && status !== 'IN_MAINTENANCE').map(({ status, value }) => <article className="stat-card" key={status}><small>{statusLabel(status, t)}</small><strong className="stat-value">{value}</strong></article>)}
        {inquiryStats.map(({ status, value }) => canViewInquiries && <article className="stat-card" key={status}><small>{t(`autosales.${status.toLowerCase()}Inquiries`)}</small><strong className="stat-value">{value}</strong></article>)}
        {canViewReservations && <article className="stat-card"><small>{t('autosales.nav.reservations')} actives</small><strong className="stat-value">{activeReservationCount}</strong></article>}
        {canViewPayments && <article className="stat-card"><small>{t('autosales.nav.payments')} en attente</small><strong className="stat-value">{pendingPaymentCount}</strong></article>}
        {canViewInquiries && <article className="stat-card"><small>{t('autosales.convertedInquiries')}</small><strong className="stat-value">{conversionCount}</strong></article>}
      </div>

      <section className="autosales-quick-actions"><h2>{t('autosales.quickActions')}</h2><div>{hasPermission(user, 'CREATE_VEHICLE') && <Link className="button" to="/automobile/vehicles">{t('autosales.addVehicle')}</Link>}{canViewVehicles && <Link className="button secondary" to="/automobile/vehicles">{t('autosales.viewVehicles')}</Link>}{canViewInquiries && <Link className="button secondary" to="/automobile/inquiries">{t('autosales.viewInquiries')}</Link>}{canViewReservations && <Link className="button secondary" to="/automobile/reservations">{t('autosales.nav.reservations')}</Link>}{canViewPayments && <Link className="button secondary" to="/automobile/payments">{t('autosales.nav.payments')}</Link>}{hasPermission(user, 'ASSIGN_VEHICLE_INQUIRY') && <Link className="button secondary" to="/automobile/inquiries">{t('autosales.assignInquiry')}</Link>}</div></section>

      {canViewVehicles && <section className="autosales-panel"><div className="autosales-panel__head"><h2>{t('autosales.recentVehicles')}</h2><Link to="/automobile/vehicles">{t('autosales.viewAll')}</Link></div>{vehicleList.length === 0 ? <p className="empty">{t('autosales.noVehicles')}</p> : <div className="autosales-vehicle-grid">{vehicleList.slice(0, 5).map((vehicle) => { const primaryMedia = vehicle.media?.find((media) => media.isPrimary)?.media?.url; return <article className="autosales-vehicle" key={vehicle.id}>{primaryMedia ? <img src={primaryMedia} alt={`${vehicle.brand} ${vehicle.model}`} /> : <div className="autosales-vehicle__fallback" aria-label={t('autosales.noImage')}>{t('autosales.noImage')}</div>}<div><strong>{vehicle.brand} {vehicle.model}</strong><span>{vehicle.year} · {money(vehicle.price, vehicle.currency, lang)}</span><span className={`status-${String(vehicle.status).toLowerCase()}`}>{statusLabel(vehicle.status, t)}</span></div></article> })}</div>}</section>}

      {canViewInquiries && <section className="autosales-panel"><div className="autosales-panel__head"><h2>{t('autosales.recentInquiries')}</h2><Link to="/automobile/inquiries">{t('autosales.viewAll')}</Link></div>{inquiryList.length === 0 ? <p className="empty">{t('autosales.noInquiries')}</p> : <div className="table-wrap"><table><thead><tr><th>{t('autosales.customer')}</th><th>{t('autosales.vehicle')}</th><th>{t('autosales.agent')}</th><th>{t('statusLabel')}</th><th>{t('date')}</th></tr></thead><tbody>{inquiryList.slice(0, 6).map((inquiry) => <tr key={inquiry.id}><td>{inquiry.customerName}</td><td>{inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : '—'}</td><td>{inquiry.assignedTo ? `${inquiry.assignedTo.firstName} ${inquiry.assignedTo.lastName}` : '—'}</td><td>{statusLabel(inquiry.status, t)}</td><td>{new Date(inquiry.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR')}</td></tr>)}</tbody></table></div>}</section>}
    </>}
  </section>
}
