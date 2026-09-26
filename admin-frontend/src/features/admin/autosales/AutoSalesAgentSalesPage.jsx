import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'

const isAgentUser = (user) => ['AGENT'].includes(user?.role)
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

async function fetchReservations(user, page) {
  if (!user) return { items: [], total: 0 }
  const params = { page, limit: 50, status: 'COMPLETED' }
  if (isAgentUser(user)) params.createdByUserId = user.id
  const response = await api.get('/api/vehicle-reservations', { params })
  return response.data?.data || response.data
}

export function AutoSalesAgentSalesPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const [page, setPage] = useState(1)

  const canViewSales = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN' || user?.role === 'SERVICE_ADMIN'

  const reservationsQuery = useQuery({
    queryKey: ['autosales-agent-sales-reservations', user?.id, page],
    queryFn: () => fetchReservations(user, page),
    enabled: !!user && canViewSales,
  })
  const sales = reservationsQuery.data?.items || []
  const total = reservationsQuery.data?.total || 0

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
        {reservationsQuery.isPending && <p>{t('dashboard.loading')}</p>}
        {reservationsQuery.isError && <p className="error">{t('dashboard.errorState')}</p>}
        {!reservationsQuery.isPending && !reservationsQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autosalesAgent.customer')}</th>
                  <th>{t('autosalesAgent.vehicle')}</th>
                  <th>{t('autosalesAgent.amount')}</th>
                  <th>Paiements encaissés</th>
                  <th>Solde</th>
                  <th>{t('autosalesAgent.status')}</th>
                  <th>Date de clôture</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan="7"><p className="empty">{t('autosalesAgent.empty')}</p></td></tr>
                ) : sales.map((reservation) => {
                  const vehicle = reservation.vehicle
                  const currency = vehicle?.currency || 'USD'
                  const paid = (reservation.payments || []).filter((payment) => ['VERIFIED', 'COMPLETED'].includes(payment.status) && (payment.currency || 'USD') === currency).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
                  const balance = Math.max(Number(reservation.reservationAmount || 0) - paid, 0)
                  return (
                    <tr key={reservation.id}>
                      <td>{reservation.customerName}</td>
                      <td>{vehicle ? `${vehicle.brand} ${vehicle.model}` : '—'}</td>
                      <td>{formatMoney(reservation.reservationAmount, currency, lang)}</td>
                      <td>{formatMoney(paid, currency, lang)}</td>
                      <td>{formatMoney(balance, currency, lang)}</td>
                      <td>{reservation.status}</td>
                      <td>{formatDate(reservation.updatedAt, lang)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="button-row" style={{ justifyContent: 'space-between', padding: 12 }}><span>{total} vente(s) · page {page}</span><div className="button-row"><button className="button secondary sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Précédent</button><button className="button secondary sm" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>Suivant</button></div></div>
          </div>
        )}
      </div>
    </section>
  )
}
