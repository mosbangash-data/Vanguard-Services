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

async function fetchReservationsByAgent(user) {
  if (!user) return []
  const params = { page: 1, limit: 200 }
  if (isAgentUser(user)) params.createdByUserId = user.id
  const response = await api.get('/api/vehicle-reservations', { params })
  return listItems(response.data?.data || response.data)
}

export function AutoSalesAgentPaymentsPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ reservationId: '', amount: '', method: 'CASH', reference: '', comment: '' })

  const canViewPayment = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN' || user?.role === 'SERVICE_ADMIN'
  const canManagePayment = hasPermission(user, 'MANAGE_VEHICLE_RESERVATION') || user?.role === 'SUPER_ADMIN' || user?.role === 'SERVICE_ADMIN'

  const reservationsQuery = useQuery({
    queryKey: ['autosales-agent-payments-reservations', user?.id],
    queryFn: () => fetchReservationsByAgent(user),
    enabled: !!user && canViewPayment,
  })

  const paymentsQuery = useQuery({
    queryKey: ['autosales-agent-payments', user?.id, statusFilter],
    queryFn: async () => {
      const response = await api.get('/api/vehicle-payments', { params: { page: 1, limit: 100, status: statusFilter } })
      const payload = response.data?.data || response.data
      return (payload?.items || []).map((payment) => ({ ...payment, reservation: payment.vehicleReservation, vehicle: payment.vehicleReservation?.vehicle }))
    },
    enabled: !!user && canViewPayment,
  })

  const validateMutation = useMutation({
    mutationFn: async (id) => api.post(`/api/vehicle-payments/${id}/validate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-payments'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-payments-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-workspace-reservations'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }) => api.post(`/api/vehicle-payments/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-payments'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-payments-reservations'] })
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => api.post('/api/vehicle-payments', paymentForm),
    onSuccess: () => {
      setPaymentForm({ reservationId: '', amount: '', method: 'CASH', reference: '', comment: '' })
      setShowCreate(false)
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-payments'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-payments-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-workspace-reservations'] })
    },
  })

  const payments = useMemo(() => paymentsQuery.data || [], [paymentsQuery.data])

  if (!canViewPayment) {
    return (
      <section className="page">
        <div className="card">
          <h1>{t('autosalesAgent.payments.title')}</h1>
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
          <h1>{t('autosalesAgent.payments.title')}</h1>
        </div>
        {canManagePayment && <button type="button" className="button" onClick={() => setShowCreate((current) => !current)}>Enregistrer un paiement</button>}
        <Link className="button secondary" to="/automobile/agent">{t('autosalesAgent.back')}</Link>
      </div>

      {showCreate && canManagePayment && <div className="card"><h2>Enregistrer un paiement de réservation</h2><div className="vehicle-form-grid">
        <label><span>Réservation</span><select value={paymentForm.reservationId} onChange={(event) => setPaymentForm((current) => ({ ...current, reservationId: event.target.value }))}><option value="">Sélectionner une réservation</option>{(reservationsQuery.data || []).filter((reservation) => ['PENDING', 'CONFIRMED'].includes(reservation.status)).map((reservation) => <option key={reservation.id} value={reservation.id}>{reservation.reservationCode} · {reservation.customerName} · {reservation.vehicle?.brand} {reservation.vehicle?.model}</option>)}</select></label>
        <label><span>Montant</span><input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} /></label>
        <label><span>Mode de paiement</span><input value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value.toUpperCase() }))} /></label>
        <label><span>Référence</span><input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} /></label>
        <label><span>Note</span><input value={paymentForm.comment} onChange={(event) => setPaymentForm((current) => ({ ...current, comment: event.target.value }))} /></label>
        <div className="button-row full-width"><button type="button" className="button" disabled={createMutation.isPending || !paymentForm.reservationId || !paymentForm.amount} onClick={() => createMutation.mutate()}>Enregistrer en attente de validation</button>{createMutation.isError && <span className="error">{createMutation.error?.response?.data?.message || 'Échec de l’enregistrement.'}</span>}</div>
      </div></div>}

      <div className="card vehicle-toolbar">
        <div className="toolbar-grid">
          <label>
            <span>{t('autosalesAgent.status')}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">{t('autosalesAgent.all')}</option>
              {['PENDING', 'VERIFIED', 'REJECTED', 'COMPLETED'].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        {paymentsQuery.isPending && <p>{t('dashboard.loading')}</p>}
        {paymentsQuery.isError && <p className="error">{t('dashboard.errorState')}</p>}
        {!paymentsQuery.isPending && !paymentsQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autosalesAgent.reference')}</th>
                  <th>{t('autosalesAgent.customer')}</th>
                  <th>{t('autosalesAgent.vehicle')}</th>
                  <th>{t('autosalesAgent.amount')}</th>
                  <th>{t('autosalesAgent.paymentMethod')}</th>
                  <th>{t('autosalesAgent.status')}</th>
                  <th>{t('autosalesAgent.date')}</th>
                  <th>{t('autosalesAgent.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan="8"><p className="empty">{t('autosalesAgent.empty')}</p></td></tr>
                ) : payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.reference || payment.id}</td>
                    <td>{payment.reservation?.customerName || '—'}</td>
                    <td>{payment.vehicle ? `${payment.vehicle.brand} ${payment.vehicle.model}` : '—'}</td>
                    <td>{formatMoney(payment.amount, payment.currency || payment.vehicle?.currency || 'USD', lang)}</td>
                    <td>{payment.method}</td>
                    <td>{payment.status}</td>
                    <td>{formatDate(payment.createdAt, lang)}</td>
                    <td className="button-row">
                      {canManagePayment && payment.status === 'PENDING' && (
                        <button type="button" className="button sm" onClick={() => validateMutation.mutate(payment.id)} disabled={validateMutation.isPending}>{t('autosalesAgent.validate')}</button>
                      )}
                      {canManagePayment && payment.status === 'PENDING' && (
                        <button type="button" className="button danger sm" onClick={() => rejectMutation.mutate({ id: payment.id, reason: t('autosalesAgent.paymentRejectReason') })} disabled={rejectMutation.isPending}>{t('autosalesAgent.reject')}</button>
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
