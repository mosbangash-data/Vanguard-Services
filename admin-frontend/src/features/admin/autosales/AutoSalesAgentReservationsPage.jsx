import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'

const listItems = (payload) => Array.isArray(payload) ? payload : (payload?.items || payload?.data?.items || payload?.data || [])
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

async function fetchAgentReservations(user) {
  if (!user) return []
  const params = { page: 1, limit: 200 }
  if (isAgentUser(user)) params.createdByUserId = user.id
  const response = await api.get('/api/vehicle-reservations', { params })
  return listItems(response.data?.data || response.data)
}

export function AutoSalesAgentReservationsPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const canViewReservations = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN' || user?.role === 'SERVICE_ADMIN'
  const canCancelReservation = hasPermission(user, 'CANCEL_VEHICLE_RESERVATION') || user?.role === 'SUPER_ADMIN'

  const reservationsQuery = useQuery({
    queryKey: ['autosales-agent-reservations', user?.id, search, statusFilter],
    queryFn: async () => {
      const params = { page: 1, limit: 200 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (isAgentUser(user)) params.createdByUserId = user.id
      const response = await api.get('/api/vehicle-reservations', { params })
      return listItems(response.data?.data || response.data)
    },
    enabled: !!user && canViewReservations,
  })

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }) => api.post(`/api/vehicle-reservations/${id}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-workspace-reservations'] })
    },
  })

  const reservations = useMemo(() => reservationsQuery.data || [], [reservationsQuery.data])

  if (!canViewReservations) {
    return (
      <section className="page">
        <div className="card">
          <h1>{t('autosalesAgent.reservations.title')}</h1>
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
          <h1>{t('autosalesAgent.reservations.title')}</h1>
        </div>
        <Link className="button secondary" to="/automobile/agent">{t('autosalesAgent.back')}</Link>
      </div>

      <div className="card vehicle-toolbar">
        <div className="toolbar-grid">
          <label>
            <span>{t('autosalesAgent.search')}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('autosalesAgent.reservations.searchPlaceholder')} />
          </label>
          <label>
            <span>{t('autosalesAgent.status')}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">{t('autosalesAgent.all')}</option>
              {['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED'].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        {reservationsQuery.isPending && <p>{t('dashboard.loading')}</p>}
        {reservationsQuery.isError && <p className="error">{t('dashboard.errorState')}</p>}
        {!reservationsQuery.isPending && !reservationsQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autosalesAgent.reference')}</th>
                  <th>{t('autosalesAgent.customer')}</th>
                  <th>{t('autosalesAgent.vehicle')}</th>
                  <th>{t('autosalesAgent.date')}</th>
                  <th>{t('autosalesAgent.amount')}</th>
                  <th>{t('autosalesAgent.status')}</th>
                  <th>{t('autosalesAgent.paymentStatus')}</th>
                  <th>{t('autosalesAgent.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {reservations.length === 0 ? (
                  <tr><td colSpan="8"><p className="empty">{t('autosalesAgent.empty')}</p></td></tr>
                ) : reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.reservationCode || reservation.id}</td>
                    <td>{reservation.customerName}</td>
                    <td>{reservation.vehicle ? `${reservation.vehicle.brand} ${reservation.vehicle.model}` : '—'}</td>
                    <td>{formatDate(reservation.reservationDate || reservation.createdAt, lang)}</td>
                    <td>{formatMoney(reservation.reservationAmount, reservation.vehicle?.currency || 'USD', lang)}</td>
                    <td>{reservation.status}</td>
                    <td>{reservation.paymentStatus || '—'}</td>
                    <td>
                      {canCancelReservation && reservation.status !== 'CANCELLED' && reservation.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          className="button danger sm"
                          onClick={() => cancelMutation.mutate({ id: reservation.id, reason: t('autosalesAgent.reservations.cancelReason') })}
                          disabled={cancelMutation.isPending}
                        >
                          {t('autosalesAgent.cancel')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
