import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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

const getAssignedInquiries = async (user) => {
  if (!user) return []
  const params = { page: 1, limit: 100 }
  if (user.role === 'AGENT') params.assignedToUserId = user.id
  const response = await api.get('/api/vehicle-inquiries', { params })
  return asList(response.data?.data || response.data)
}

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

  const selectedInquiry = useMemo(() => inquiries.find((item) => item.id === selectedId) || null, [inquiries, selectedId])

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
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
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
                {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
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
  const [showCreate, setShowCreate] = useState(false)
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

  const canViewPayments = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN'
  const canValidatePayment = hasPermission(user, 'MANAGE_VEHICLE_RESERVATION') || user?.role === 'SUPER_ADMIN'

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
      const reservations = reservationsQuery.data || []
      const paymentEntries = await Promise.all(
        reservations.map(async (reservation) => {
          const response = await api.get(`/api/vehicle-payments/reservation/${reservation.id}`)
          return {
            reservationId: reservation.id,
            items: asList(response.data?.data?.payments || response.data?.data || []),
          }
        }),
      )
      const flat = paymentEntries.flatMap(({ reservationId, items }) => items.map((payment) => ({ ...payment, reservationId })))
      if (statusFilter === 'ALL') return flat
      return flat.filter((payment) => payment.status === statusFilter)
    },
    enabled: !!user && canViewPayments && !!reservationsQuery.data,
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

  const payments = paymentQuery.data || []

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
        <Link className="button secondary" to="/automobile">{t('autosalesCommercial.back')}</Link>
      </div>

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
                    <td>{formatMoney(payment.amount, 'USD', lang)}</td>
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
  const canViewSales = hasPermission(user, 'VIEW_RESERVATION') || user?.role === 'SUPER_ADMIN'

  const reservationsQuery = useQuery({
    queryKey: ['autosales-sales-reservations'],
    queryFn: async () => {
      const response = await api.get('/api/vehicle-reservations', { params: { page: 1, limit: 200 } })
      return asList(response.data?.data || response.data)
    },
    enabled: !!user && canViewSales,
  })

  const vehiclesQuery = useQuery({
    queryKey: ['autosales-sales-vehicles'],
    queryFn: getVehicleOptions,
    enabled: !!user && canViewSales,
  })

  const reservations = reservationsQuery.data || []
  const vehicles = vehiclesQuery.data || []
  const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))

  const sales = reservations.filter((reservation) => {
    const vehicle = vehicleMap.get(reservation.vehicleId)
    return reservation.status === 'COMPLETED' || reservation.paymentStatus === 'COMPLETED' || vehicle?.status === 'SOLD'
  })

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
        {reservationsQuery.isPending || vehiclesQuery.isPending ? <p>{t('dashboard.loading')}</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autosalesCommercial.vehicle')}</th>
                  <th>{t('autosalesCommercial.customer')}</th>
                  <th>{t('autosalesCommercial.amount')}</th>
                  <th>{t('autosalesCommercial.agent')}</th>
                  <th>{t('autosalesCommercial.status')}</th>
                  <th>{t('autosalesCommercial.date')}</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan="6"><p className="empty">{t('autosalesCommercial.empty')}</p></td></tr>
                ) : sales.map((reservation) => {
                  const vehicle = vehicleMap.get(reservation.vehicleId)
                  return (
                    <tr key={reservation.id}>
                      <td>{vehicle ? `${vehicle.brand} ${vehicle.model}` : '—'}</td>
                      <td>{reservation.customerName}</td>
                      <td>{formatMoney(reservation.reservationAmount, vehicle?.currency || 'USD', lang)}</td>
                      <td>{reservation.createdBy ? `${reservation.createdBy.firstName} ${reservation.createdBy.lastName}` : '—'}</td>
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
