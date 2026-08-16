import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'

const listItems = (payload) => Array.isArray(payload) ? payload : (payload?.items || payload?.data?.items || payload?.data || [])
const isAgentUser = (user) => ['AGENT', 'SALES_AGENT'].includes(user?.role)
const formatDate = (value, lang) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
const formatMoney = (amount, currency, lang) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
  style: 'currency',
  currency: currency || 'USD',
  maximumFractionDigits: 2,
}).format(Number(amount || 0))

async function fetchReservations(user) {
  if (!user) return []
  const params = { page: 1, limit: 200 }
  if (isAgentUser(user)) params.createdByUserId = user.id
  const response = await api.get('/api/vehicle-reservations', { params })
  return listItems(response.data?.data || response.data)
}

async function fetchVehicles() {
  const response = await api.get('/api/vehicles', { params: { page: 1, limit: 200 } })
  return listItems(response.data?.data || response.data)
}

export function AutoSalesAgentSalesPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()

  const canViewSales = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN' || user?.role === 'SERVICE_ADMIN'

  const reservationsQuery = useQuery({
    queryKey: ['autosales-agent-sales-reservations', user?.id],
    queryFn: () => fetchReservations(user),
    enabled: !!user && canViewSales,
  })

  const vehiclesQuery = useQuery({
    queryKey: ['autosales-agent-sales-vehicles'],
    queryFn: fetchVehicles,
    enabled: !!user && canViewSales,
  })

  const reservations = useMemo(() => reservationsQuery.data || [], [reservationsQuery.data])
  const vehicles = useMemo(() => vehiclesQuery.data || [], [vehiclesQuery.data])
  const vehicleById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles])

  const sales = reservations.filter((reservation) => {
    const vehicle = vehicleById.get(reservation.vehicleId)
    return reservation.status === 'COMPLETED' || reservation.paymentStatus === 'COMPLETED' || vehicle?.status === 'SOLD'
  })

  if (!canViewSales) {
    return (
      <section className="page">
        <div className="card">
          <h1>{t('autosalesAgent.sales.title')}</h1>
          <p className="empty">{t('autosalesAgent.accessDenied')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page autosales-vehicles-page">
      <div className="page-head">
        <div>
          <p className="autosales-eyebrow">VANGUARD SERVICES · AUTOSALES</p>
          <h1>{t('autosalesAgent.sales.title')}</h1>
        </div>
        <Link className="button secondary" to="/automobile/agent">{t('autosalesAgent.back')}</Link>
      </div>

      <div className="card">
        {(reservationsQuery.isPending || vehiclesQuery.isPending) && <p>{t('dashboard.loading')}</p>}
        {(reservationsQuery.isError || vehiclesQuery.isError) && <p className="error">{t('dashboard.errorState')}</p>}
        {!reservationsQuery.isPending && !vehiclesQuery.isPending && !reservationsQuery.isError && !vehiclesQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autosalesAgent.customer')}</th>
                  <th>{t('autosalesAgent.vehicle')}</th>
                  <th>{t('autosalesAgent.amount')}</th>
                  <th>{t('autosalesAgent.status')}</th>
                  <th>{t('autosalesAgent.date')}</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan="5"><p className="empty">{t('autosalesAgent.empty')}</p></td></tr>
                ) : sales.map((reservation) => {
                  const vehicle = vehicleById.get(reservation.vehicleId)
                  return (
                    <tr key={reservation.id}>
                      <td>{reservation.customerName}</td>
                      <td>{vehicle ? `${vehicle.brand} ${vehicle.model}` : '—'}</td>
                      <td>{formatMoney(reservation.reservationAmount, vehicle?.currency || 'USD', lang)}</td>
                      <td>{reservation.status}</td>
                      <td>{formatDate(reservation.createdAt, lang)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
