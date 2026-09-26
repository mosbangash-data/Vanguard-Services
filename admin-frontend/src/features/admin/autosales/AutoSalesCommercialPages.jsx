import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'

const asList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

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

const formatMoney = (amount, currency, lang) => {
  const value = Number(amount ?? 0)
  const targetCurrency = currency || 'USD'
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
    style: 'currency',
    currency: targetCurrency,
    maximumFractionDigits: 2,
  }).format(value)
}

const statusOptions = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED']
const reservationStatusOptions = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED']
const paymentStatusOptions = ['PENDING', 'VERIFIED', 'REJECTED', 'COMPLETED']

const getAutoSalesDepartment = async () => {
  const response = await api.get('/api/departments', { params: { page: 1, limit: 100 } })
  return asList(response.data?.data || response.data)
}

const getAgentUsers = async () => {
  const departments = await getAutoSalesDepartment()
  const department = departments.find((item) => item.type === 'AUTO_SALES')
  if (!department) return []
  const roleResponse = await api.get('/api/roles', { params: { page: 1, limit: 100 } })
  const roles = asList(roleResponse.data?.data || roleResponse.data)
  const agentRole = roles.find((role) => role.name === 'AGENT')
  if (!agentRole) return []
  const response = await api.get('/api/users', {
    params: {
      page: 1,
      limit: 200,
      departmentId: department.id,
      roleId: agentRole.id,
    },
  })
  return asList(response.data?.data || response.data)
}

const getVehicleOptions = async () => {
  const response = await api.get('/api/vehicles', { params: { page: 1, limit: 200 } })
  return asList(response.data?.data || response.data)
}

export function AutoSalesInquiryPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [statusDraft, setStatusDraft] = useState('NEW')
  const [notesDraft, setNotesDraft] = useState('')

  const canManageInquiries = hasPermission(user, 'VIEW_VEHICLE_INQUIRY') || user?.role === 'SUPER_ADMIN'
  const canAssignInquiry = hasPermission(user, 'ASSIGN_VEHICLE_INQUIRY') || user?.role === 'SUPER_ADMIN'
  const canUpdateInquiry = hasPermission(user, 'UPDATE_VEHICLE_INQUIRY') || user?.role === 'SUPER_ADMIN'
  const allowedInquiryStatuses = statusOptions.filter((status) => status !== 'CLOSED' || hasPermission(user, 'CLOSE_VEHICLE_INQUIRY') || user?.role === 'SUPER_ADMIN')

  const inquiriesQuery = useQuery({
    queryKey: ['autosales-inquiries', search, statusFilter],
    queryFn: async () => {
      const params = { page: 1, limit: 200 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (user?.role === 'AGENT') params.assignedToUserId = user.id
      const response = await api.get('/api/vehicle-inquiries', { params })
      return asList(response.data?.data || response.data)
    },
    enabled: !!user && canManageInquiries,
  })

  const agentQuery = useQuery({
    queryKey: ['autosales-agents-list'],
    queryFn: getAgentUsers,
    enabled: canAssignInquiry,
  })

  const agents = agentQuery.data || []
  const inquiries = inquiriesQuery.data || []

  const selectedInquiry = useMemo(() => inquiriesQuery.data?.find((item) => item.id === selectedId) || null, [inquiriesQuery.data, selectedId])

  const openInquiry = (inquiry) => {
    setSelectedId(inquiry.id)
    setStatusDraft(inquiry.status || 'NEW')
    setNotesDraft(inquiry.internalNotes || '')
    setSelectedAgentId(inquiry.assignedToUserId || '')
  }

  const updateMutation = useMutation({
    mutationFn: async ({ inquiryId, payload }) => api.patch(`/api/vehicle-inquiries/${inquiryId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-inquiries'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-inquiries'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-dashboard-inquiries'] })
    },
  })

  const assignMutation = useMutation({
    mutationFn: async ({ inquiryId, assignedToUserId }) => api.patch(`/api/vehicle-inquiries/${inquiryId}/assign`, { assignedToUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-inquiries'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-inquiries'] })
    },
  })

  const saveInquiry = () => {
    if (!selectedInquiry) return
    const payload = {}
    if (statusDraft !== selectedInquiry.status) payload.status = statusDraft
    if (notesDraft !== (selectedInquiry.internalNotes || '')) payload.internalNotes = notesDraft || null
    if (Object.keys(payload).length > 0) {
      updateMutation.mutate({ inquiryId: selectedInquiry.id, payload })
    }
  }

  const saveAssignment = () => {
    if (!selectedInquiry || !selectedAgentId) return
    assignMutation.mutate({ inquiryId: selectedInquiry.id, assignedToUserId: selectedAgentId })
  }

  if (!canManageInquiries) {
    return <section className="page"><div className="card"><h1>{t('autosalesCommercial.inquiries.title')}</h1><p className="empty">{t('autosalesCommercial.accessDenied')}</p></div></section>
  }

  return (
    <section className="page autosales-vehicles-page">
      <div className="page-head">
        <div>
          <p className="autosales-eyebrow">VANGUARD SERVICES · AUTOSALES</p>
          <h1>{t('autosalesCommercial.inquiries.title')}</h1>
        </div>
        <Link className="button secondary" to="/automobile">{t('autosalesCommercial.back')}</Link>
      </div>

      <div className="card vehicle-toolbar">
        <div className="toolbar-grid">
          <label>
            <span>{t('autosalesCommercial.search')}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('autosalesCommercial.inquiries.searchPlaceholder')} />
          </label>
          <label>
            <span>{t('autosalesCommercial.status')}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">{t('autosalesCommercial.all')}</option>
              {allowedInquiryStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        {inquiriesQuery.isPending && <p>{t('dashboard.loading')}</p>}
        {inquiriesQuery.isError && <p className="error">{t('dashboard.errorState')}</p>}
        {!inquiriesQuery.isPending && !inquiriesQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autosalesCommercial.customer')}</th>
                  <th>{t('autosalesCommercial.vehicle')}</th>
                  <th>{t('autosalesCommercial.agent')}</th>
                  <th>{t('autosalesCommercial.status')}</th>
                  <th>{t('autosalesCommercial.date')}</th>
                  <th>{t('autosalesCommercial.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.length === 0 ? (
                  <tr><td colSpan="6"><p className="empty">{t('autosalesCommercial.empty')}</p></td></tr>
                ) : inquiries.map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td>{inquiry.customerName}</td>
                    <td>{inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : '—'}</td>
                    <td>{inquiry.assignedTo ? `${inquiry.assignedTo.firstName} ${inquiry.assignedTo.lastName}` : '—'}</td>
                    <td>{inquiry.status}</td>
                    <td>{formatDate(inquiry.createdAt, lang)}</td>
                    <td>
                      <button type="button" className="button secondary sm" onClick={() => openInquiry(inquiry)}>
                        {t('autosalesCommercial.view')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedInquiry && (
        <div className="card">
          <h2>{t('autosalesCommercial.inquiries.detail')}</h2>
          <div className="vehicle-form-grid">
            <label>
              <span>{t('autosalesCommercial.customer')}</span>
              <input value={selectedInquiry.customerName || ''} readOnly />
            </label>
            <label>
              <span>{t('autosalesCommercial.vehicle')}</span>
              <input value={selectedInquiry.vehicle ? `${selectedInquiry.vehicle.brand} ${selectedInquiry.vehicle.model}` : ''} readOnly />
            </label>
            <label>
              <span>{t('autosalesCommercial.inquiries.type')}</span>
              <input value={selectedInquiry.inquiryType || ''} readOnly />
            </label>
            <label>
              <span>{t('autosalesCommercial.status')}</span>
              <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)} disabled={!canUpdateInquiry}>
                {allowedInquiryStatuses.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="full-width">
              <span>{t('autosalesCommercial.notes')}</span>
              <textarea value={notesDraft} onChange={(event) => setNotesDraft(event.target.value)} rows="4" disabled={!canUpdateInquiry} />
            </label>
            {canAssignInquiry && (
              <label>
                <span>{t('autosalesCommercial.assignTo')}</span>
                <select value={selectedAgentId} onChange={(event) => setSelectedAgentId(event.target.value)}>
                  <option value="">{t('autosalesCommercial.unassigned')}</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{`${agent.firstName} ${agent.lastName}`}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="button-row full-width">
              {canUpdateInquiry && <button type="button" className="button" onClick={saveInquiry} disabled={updateMutation.isPending}>{t('autosalesCommercial.save')}</button>}
              {canAssignInquiry && <button type="button" className="button secondary" onClick={saveAssignment} disabled={assignMutation.isPending}>{t('autosalesCommercial.assign')}</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function AutoSalesReservationPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [reservationSearchParams] = useSearchParams()
  const [showCreate, setShowCreate] = useState(() => reservationSearchParams.get('create') === '1')
  const [form, setForm] = useState({
    vehicleId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    reservationAmount: '',
    depositAmount: '',
    reservationDate: '',
    expirationDate: '',
  })

  const canViewReservations = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN'
  const canCreateReservation = hasPermission(user, 'MANAGE_VEHICLE_RESERVATION') || user?.role === 'SUPER_ADMIN'
  const canCancelReservation = hasPermission(user, 'CANCEL_VEHICLE_RESERVATION') || user?.role === 'SUPER_ADMIN'

  const vehiclesQuery = useQuery({
    queryKey: ['autosales-reservation-vehicles'],
    queryFn: getVehicleOptions,
    enabled: canCreateReservation,
  })

  const reservationsQuery = useQuery({
    queryKey: ['autosales-reservations', statusFilter, search],
    queryFn: async () => {
      const params = { page: 1, limit: 200 }
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (search.trim()) params.search = search.trim()
      const response = await api.get('/api/vehicle-reservations', { params })
      return asList(response.data?.data || response.data)
    },
    enabled: !!user && canViewReservations,
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => api.post('/api/vehicle-reservations', payload),
    onSuccess: () => {
      setShowCreate(false)
      setForm({
        vehicleId: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        reservationAmount: '',
        depositAmount: '',
        reservationDate: '',
        expirationDate: '',
      })
      queryClient.invalidateQueries({ queryKey: ['autosales-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-dashboard-vehicles'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }) => api.post(`/api/vehicle-reservations/${id}/cancel`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['autosales-reservations'] }),
  })

  const submitCreate = () => {
    createMutation.mutate({
      ...form,
      reservationDate: form.reservationDate || new Date().toISOString(),
      expirationDate: form.expirationDate || new Date(Date.now() + 86400000).toISOString(),
    })
  }

  const reservations = reservationsQuery.data || []

  if (!canViewReservations) {
    return <section className="page"><div className="card"><h1>{t('autosalesCommercial.reservations.title')}</h1><p className="empty">{t('autosalesCommercial.accessDenied')}</p></div></section>
  }

  return (
    <section className="page autosales-vehicles-page">
      <div className="page-head">
        <div>
          <p className="autosales-eyebrow">VANGUARD SERVICES · AUTOSALES</p>
          <h1>{t('autosalesCommercial.reservations.title')}</h1>
        </div>
        {canCreateReservation && <button type="button" className="button" onClick={() => setShowCreate((current) => !current)}>{t('autosalesCommercial.create')}</button>}
      </div>

      {showCreate && (
        <div className="card">
          <h2>{t('autosalesCommercial.reservations.create')}</h2>
          <div className="vehicle-form-grid">
            <label>
              <span>{t('autosalesCommercial.vehicle')}</span>
              <select value={form.vehicleId} onChange={(event) => setForm((current) => ({ ...current, vehicleId: event.target.value }))}>
                <option value="">{t('autosalesCommercial.selectVehicle')}</option>
                {(vehiclesQuery.data || []).map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{`${vehicle.brand} ${vehicle.model}`}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('autosalesCommercial.customer')}</span>
              <input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} />
            </label>
            <label>
              <span>{t('autosalesCommercial.phone')}</span>
              <input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} />
            </label>
            <label>
              <span>{t('autosalesCommercial.email')}</span>
              <input value={form.customerEmail} onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))} />
            </label>
            <label>
              <span>{t('autosalesCommercial.amount')}</span>
              <input value={form.reservationAmount} onChange={(event) => setForm((current) => ({ ...current, reservationAmount: event.target.value }))} />
            </label>
            <label>
              <span>{t('autosalesCommercial.deposit')}</span>
              <input value={form.depositAmount} onChange={(event) => setForm((current) => ({ ...current, depositAmount: event.target.value }))} />
            </label>
            <label>
              <span>{t('autosalesCommercial.date')}</span>
              <input type="datetime-local" value={form.reservationDate} onChange={(event) => setForm((current) => ({ ...current, reservationDate: event.target.value }))} />
            </label>
            <label>
              <span>{t('autosalesCommercial.expiration')}</span>
              <input type="datetime-local" value={form.expirationDate} onChange={(event) => setForm((current) => ({ ...current, expirationDate: event.target.value }))} />
            </label>
            <div className="button-row full-width">
              <button type="button" className="button" onClick={submitCreate} disabled={createMutation.isPending}>{t('autosalesCommercial.save')}</button>
              <button type="button" className="button secondary" onClick={() => setShowCreate(false)}>{t('autosalesCommercial.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card vehicle-toolbar">
        <div className="toolbar-grid">
          <label>
            <span>{t('autosalesCommercial.search')}</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            <span>{t('autosalesCommercial.status')}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">{t('autosalesCommercial.all')}</option>
              {reservationStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
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
                  <th>{t('autosalesCommercial.reference')}</th>
                  <th>{t('autosalesCommercial.customer')}</th>
                  <th>{t('autosalesCommercial.vehicle')}</th>
                  <th>{t('autosalesCommercial.amount')}</th>
                  <th>{t('autosalesCommercial.status')}</th>
                  <th>{t('autosalesCommercial.agent')}</th>
                  <th>{t('autosalesCommercial.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {reservations.length === 0 ? (
                  <tr><td colSpan="7"><p className="empty">{t('autosalesCommercial.empty')}</p></td></tr>
                ) : reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.reservationCode || reservation.id}</td>
                    <td>{reservation.customerName}</td>
                    <td>{reservation.vehicle ? `${reservation.vehicle.brand} ${reservation.vehicle.model}` : '—'}</td>
                    <td>{formatMoney(reservation.reservationAmount, reservation.vehicle?.currency || 'USD', lang)}</td>
                    <td>{reservation.status}</td>
                    <td>{reservation.createdBy ? `${reservation.createdBy.firstName} ${reservation.createdBy.lastName}` : '—'}</td>
                    <td>
                      {canCancelReservation && reservation.status !== 'CANCELLED' && reservation.status !== 'COMPLETED' && (
                        <button type="button" className="button danger sm" onClick={() => cancelMutation.mutate({ id: reservation.id, reason: t('autosalesCommercial.cancelledByUser') })} disabled={cancelMutation.isPending}>
                          {t('autosalesCommercial.cancel')}
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

export function AutoSalesPaymentPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [searchParams] = useSearchParams()
  const [showCreate, setShowCreate] = useState(() => searchParams.get('create') === '1')
  const [paymentForm, setPaymentForm] = useState({ reservationId: '', amount: '', method: 'CASH', reference: '', comment: '' })

  const canViewPayments = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN'
  const canValidatePayment = hasPermission(user, 'MANAGE_VEHICLE_RESERVATION') || user?.role === 'SUPER_ADMIN'
  const canCreatePayment = hasPermission(user, 'MANAGE_VEHICLE_RESERVATION') || user?.role === 'SUPER_ADMIN'

  const reservationsQuery = useQuery({
    queryKey: ['autosales-payment-reservations'],
    queryFn: async () => {
      const response = await api.get('/api/vehicle-reservations', { params: { page: 1, limit: 200 } })
      return asList(response.data?.data || response.data)
    },
    enabled: !!user && canViewPayments,
  })

  const paymentQuery = useQuery({
    queryKey: ['autosales-payments', statusFilter],
    queryFn: async () => {
      const response = await api.get('/api/vehicle-payments', { params: { page: 1, limit: 100, status: statusFilter } })
      return response.data?.data || response.data
    },
    enabled: !!user && canViewPayments,
  })

  const validateMutation = useMutation({
    mutationFn: async (id) => api.post(`/api/vehicle-payments/${id}/validate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-payments'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-reservations'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }) => api.post(`/api/vehicle-payments/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-payments'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-reservations'] })
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => api.post('/api/vehicle-payments', paymentForm),
    onSuccess: () => {
      setPaymentForm({ reservationId: '', amount: '', method: 'CASH', reference: '', comment: '' })
      setShowCreate(false)
      queryClient.invalidateQueries({ queryKey: ['autosales-payments'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-payment-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-dashboard'] })
    },
  })

  const payments = paymentQuery.data?.items || []

  if (!canViewPayments) {
    return <section className="page"><div className="card"><h1>{t('autosalesCommercial.payments.title')}</h1><p className="empty">{t('autosalesCommercial.accessDenied')}</p></div></section>
  }

  return (
    <section className="page autosales-vehicles-page">
      <div className="page-head">
        <div>
          <p className="autosales-eyebrow">VANGUARD SERVICES · AUTOSALES</p>
          <h1>{t('autosalesCommercial.payments.title')}</h1>
        </div>
        {canCreatePayment && <button type="button" className="button" onClick={() => setShowCreate((current) => !current)}>Enregistrer un paiement</button>}
        <Link className="button secondary" to="/automobile">{t('autosalesCommercial.back')}</Link>
      </div>

      {showCreate && canCreatePayment && <div className="card"><h2>Enregistrer un paiement de réservation</h2><div className="vehicle-form-grid">
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
            <span>{t('autosalesCommercial.status')}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">{t('autosalesCommercial.all')}</option>
              {paymentStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        {paymentQuery.isPending && <p>{t('dashboard.loading')}</p>}
        {paymentQuery.isError && <p className="error">{t('dashboard.errorState')}</p>}
        {!paymentQuery.isPending && !paymentQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autosalesCommercial.reference')}</th>
                  <th>{t('autosalesCommercial.customer')}</th>
                  <th>{t('autosalesCommercial.vehicle')}</th>
                  <th>{t('autosalesCommercial.amount')}</th>
                  <th>{t('autosalesCommercial.method')}</th>
                  <th>{t('autosalesCommercial.status')}</th>
                  <th>{t('autosalesCommercial.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan="7"><p className="empty">{t('autosalesCommercial.empty')}</p></td></tr>
                ) : payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.reference || payment.id}</td>
                    <td>{payment.vehicleReservation?.customerName || '—'}</td>
                    <td>{payment.vehicleReservation?.vehicle ? `${payment.vehicleReservation.vehicle.brand} ${payment.vehicleReservation.vehicle.model}` : '—'}</td>
                    <td>{formatMoney(payment.amount, payment.currency || payment.vehicleReservation?.vehicle?.currency || 'USD', lang)}</td>
                    <td>{payment.method}</td>
                    <td>{payment.status}</td>
                    <td className="button-row">
                      {canValidatePayment && payment.status === 'PENDING' && (
                        <button type="button" className="button sm" onClick={() => validateMutation.mutate(payment.id)} disabled={validateMutation.isPending}>{t('autosalesCommercial.validate')}</button>
                      )}
                      {canValidatePayment && payment.status === 'PENDING' && (
                        <button type="button" className="button danger sm" onClick={() => rejectMutation.mutate({ id: payment.id, reason: t('autosalesCommercial.rejectReason') })} disabled={rejectMutation.isPending}>{t('autosalesCommercial.reject')}</button>
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

export function AutoSalesSalesPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const canViewSales = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN'

  const reservationsQuery = useQuery({
    queryKey: ['autosales-sales-reservations', page],
    queryFn: async () => {
      const response = await api.get('/api/vehicle-reservations', { params: { page, limit: pageSize, status: 'COMPLETED' } })
      return response.data?.data || response.data
    },
    enabled: !!user && canViewSales,
  })

  const sales = reservationsQuery.data?.items || []
  const total = reservationsQuery.data?.total || 0

  if (!canViewSales) {
    return <section className="page"><div className="card"><h1>{t('autosalesCommercial.sales.title')}</h1><p className="empty">{t('autosalesCommercial.accessDenied')}</p></div></section>
  }

  return (
    <section className="page autosales-vehicles-page">
      <div className="page-head">
        <div>
          <p className="autosales-eyebrow">VANGUARD SERVICES · AUTOSALES</p>
          <h1>{t('autosalesCommercial.sales.title')}</h1>
        </div>
        <Link className="button secondary" to="/automobile">{t('autosalesCommercial.back')}</Link>
      </div>

      <div className="card">
        {reservationsQuery.isPending ? <p>{t('dashboard.loading')}</p> : reservationsQuery.isError ? <p className="error">{t('dashboard.errorState')}</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autosalesCommercial.vehicle')}</th>
                  <th>{t('autosalesCommercial.customer')}</th>
                  <th>Montant de vente</th>
                  <th>Paiements encaissés</th>
                  <th>Solde</th>
                  <th>{t('autosalesCommercial.agent')}</th>
                  <th>{t('autosalesCommercial.status')}</th>
                  <th>Date de clôture</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan="8"><p className="empty">{t('autosalesCommercial.empty')}</p></td></tr>
                ) : sales.map((reservation) => {
                  const vehicle = reservation.vehicle
                  const validatedPayments = (reservation.payments || []).filter((payment) => ['VERIFIED', 'COMPLETED'].includes(payment.status) && (payment.currency || 'USD') === (reservation.vehicle?.currency || 'USD'))
                  const paid = validatedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
                  const remaining = Math.max(Number(reservation.reservationAmount || 0) - paid, 0)
                  const currency = vehicle?.currency || 'USD'
                  return (
                    <tr key={reservation.id}>
                      <td>{vehicle ? `${vehicle.brand} ${vehicle.model}` : '—'}</td>
                      <td>{reservation.customerName}</td>
                      <td>{formatMoney(reservation.reservationAmount, currency, lang)}</td>
                      <td>{formatMoney(paid, currency, lang)}</td>
                      <td>{formatMoney(remaining, currency, lang)}</td>
                      <td>{reservation.createdBy ? `${reservation.createdBy.firstName} ${reservation.createdBy.lastName}` : '—'}</td>
                      <td>{reservation.status}</td>
                      <td>{formatDate(reservation.updatedAt, lang)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="button-row" style={{ justifyContent: 'space-between', padding: 12 }}>
              <span>{total} vente(s) · page {page}</span>
              <div className="button-row"><button className="button secondary sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>Précédent</button><button className="button secondary sm" disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Suivant</button></div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
