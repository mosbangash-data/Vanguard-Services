import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'
import { useLanguage } from '../../../i18n/useLanguage'

const inquiryStatuses = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED']
const listItems = (payload) => Array.isArray(payload) ? payload : (payload?.items || payload?.data?.items || payload?.data || [])
const isAgentUser = (user) => ['AGENT'].includes(user?.role)
const isOperationalAutoSalesUser = (user) => isAgentUser(user) || user?.role === 'SERVICE_ADMIN' || user?.role === 'SUPER_ADMIN'

async function fetchAutoSalesDepartment() {
  const response = await api.get('/api/departments?limit=100')
  return response.data?.data?.items || response.data?.data || []
}

async function fetchRoles() {
  const response = await api.get('/api/roles?limit=100')
  return response.data?.data?.items || response.data?.data || []
}

async function fetchAgents() {
  const departments = await fetchAutoSalesDepartment()
  const roles = await fetchRoles()
  const autoSalesDepartment = departments.find((department) => department.type === 'AUTO_SALES')
  const agentRole = roles.find((role) => role.name === 'AGENT')
  if (!autoSalesDepartment || !agentRole) return []
  const response = await api.get('/api/users', {
    params: {
      page: 1,
      limit: 100,
      departmentId: autoSalesDepartment.id,
      roleId: agentRole.id,
    },
  })
  return response.data?.data?.items || []
}

async function fetchAssignedInquiries(user) {
  if (!user) return []
  const params = { page: 1, limit: 100 }
  if (isAgentUser(user)) params.assignedToUserId = user.id
  const response = await api.get('/api/vehicle-inquiries', { params })
  return listItems(response.data?.data || response.data)
}

async function fetchAgentReservations(user) {
  if (!user) return []
  const params = { page: 1, limit: 100 }
  if (isAgentUser(user)) params.createdByUserId = user.id
  const response = await api.get('/api/vehicle-reservations', { params })
  return listItems(response.data?.data || response.data)
}

async function fetchAgentPayments(user, reservations = []) {
  if (!user || reservations.length === 0) return []
  const paymentEntries = await Promise.all(
    reservations.map(async (reservation) => {
      const response = await api.get(`/api/vehicle-payments/reservation/${reservation.id}`)
      const items = listItems(response.data?.data?.payments || response.data?.data || response.data)
      return items.map((payment) => ({ ...payment, reservationId: reservation.id, reservation }))
    }),
  )
  return paymentEntries.flat()
}

export function AutoSalesAgentManagementPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [error, setError] = useState('')

  const canManageAgents = hasPermission(user, 'VIEW_USER') || hasPermission(user, 'CREATE_USER') || user?.role === 'SUPER_ADMIN'
  const departmentsQuery = useQuery({ queryKey: ['autosales-departments'], queryFn: fetchAutoSalesDepartment, enabled: canManageAgents })
  const rolesQuery = useQuery({ queryKey: ['autosales-roles'], queryFn: fetchRoles, enabled: canManageAgents })
  const agentsQuery = useQuery({
    queryKey: ['autosales-agents'],
    queryFn: fetchAgents,
    enabled: canManageAgents,
  })

  const autoSalesDepartment = useMemo(
    () => (departmentsQuery.data || []).find((department) => department.type === 'AUTO_SALES'),
    [departmentsQuery.data],
  )
  const agentRole = useMemo(
    () => (rolesQuery.data || []).find((role) => role.name === 'AGENT'),
    [rolesQuery.data],
  )

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!autoSalesDepartment || !agentRole) {
        throw new Error(t('autoAgentUi.departmentMissing'))
      }
      return api.post('/api/users', {
        ...form,
        roleId: agentRole.id,
        departmentId: autoSalesDepartment.id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-agents'] })
      setForm({ firstName: '', lastName: '', email: '', phone: '' })
      setError('')
      window.alert(t('autoAgentUi.createdNotice'))
    },
    onError: (err) => {
      setError(err?.response?.data?.message || t('autoAgentUi.createFailed'))
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => api.patch(`/api/users/${id}/status`, { status: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['autosales-agents'] }),
  })

  if (!canManageAgents) {
    return (
      <section className="page">
        <div className="card">
          <h1>{t('autoAgentUi.accessTitle')}</h1>
          <p className="empty">{t('autoAgentUi.accessDenied')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{t('autoAgentUi.accessTitle')}</h1>
          <p>{t('autoAgentUi.agentAccounts')}</p>
        </div>
        <Link className="button secondary" to="/automobile/agent">{t('autoAgentUi.backWorkspace')}</Link>
      </div>

      <div className="card">
        <h2>{t('autoAgentUi.createAgent')}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            createMutation.mutate()
          }}
          className="autosales-form-grid"
        >
          <label>
            <span>{t('autoAgentUi.firstName')}</span>
            <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
          </label>
          <label>
            <span>{t('autoAgentUi.lastName')}</span>
            <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
          </label>
          <label>
            <span>{t('autoAgentUi.email')}</span>
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            <span>{t('autoAgentUi.phone')}</span>
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          {error && <p className="error">{error}</p>}
          <div>
            <button type="submit" className="button" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('autoAgentUi.creating') : t('autoAgentUi.create')}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>{t('autoAgentUi.agentList')}</h2>
        {agentsQuery.isPending && <p>{t('autoAgentUi.loading')}</p>}
        {agentsQuery.isError && <p className="error">{t('autoAgentUi.loadFailed')}</p>}
        {!agentsQuery.isPending && !agentsQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autoAgentUi.name')}</th>
                  <th>{t('autoAgentUi.email')}</th>
                  <th>{t('autoAgentUi.status')}</th>
                  <th>{t('autoAgentUi.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(agentsQuery.data || []).map((agent) => (
                  <tr key={agent.id}>
                    <td>{agent.firstName} {agent.lastName}</td>
                    <td>{agent.email}</td>
                    <td>{agent.status}</td>
                    <td>
                      <button
                        type="button"
                        className="button secondary sm"
                        onClick={() => toggleStatusMutation.mutate({ id: agent.id, status: agent.status })}
                        disabled={toggleStatusMutation.isPending}
                      >
                        {agent.status === 'ACTIVE' ? t('autoAgentUi.deactivate') : t('autoAgentUi.activate')}
                      </button>
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

export function AutoSalesAgentWorkspacePage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()

  const inquiriesQuery = useQuery({
    queryKey: ['autosales-agent-workspace-inquiries', user?.id],
    queryFn: () => fetchAssignedInquiries(user),
    enabled: !!user,
  })

  const reservationsQuery = useQuery({
    queryKey: ['autosales-agent-workspace-reservations', user?.id],
    queryFn: () => fetchAgentReservations(user),
    enabled: !!user,
  })

  const inquiries = inquiriesQuery.data || []
  const reservations = reservationsQuery.data || []

  const paymentsQuery = useQuery({
    queryKey: ['autosales-agent-workspace-payments', user?.id],
    queryFn: () => fetchAgentPayments(user, reservations),
    enabled: !!user && reservations.length > 0,
  })

  const payments = paymentsQuery.data || []
  const total = inquiries.length
  const newCount = inquiries.filter((inquiry) => inquiry.status === 'NEW').length
  const inProgress = inquiries.filter((inquiry) => ['CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT'].includes(inquiry.status)).length
  const reservationsActive = reservations.filter((reservation) => ['PENDING', 'CONFIRMED'].includes(reservation.status)).length
  const pendingPayments = payments.filter((payment) => payment.status === 'PENDING').length
  const completedSales = reservations.filter((reservation) => reservation.status === 'COMPLETED').length

  if (!isOperationalAutoSalesUser(user)) {
    return (
      <section className="page">
        <div className="card">
          <h1>{t('autoAgentUi.workspace')}</h1>
          <p className="empty">{t('autoAgentUi.workspaceRestricted')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page autosales-dashboard">
      <div className="page-head">
        <div>
          <p className="autosales-eyebrow">VANGUARD SERVICES · {t('roleUi.roleLabels.AGENT')}</p>
          <h1>{t('autoAgentUi.workspace')}</h1>
          <p>{t('autoAgentUi.welcome', { name: user?.firstName || t('navigation.sections.agentDashboard') })}</p>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <article className="stat-card">
          <small>{t('autoAgentUi.assignedInquiries')}</small>
          <strong className="stat-value">{inquiriesQuery.isPending ? '…' : total}</strong>
        </article>
        <article className="stat-card">
          <small>{t('autoAgentUi.newInquiries')}</small>
          <strong className="stat-value">{newCount}</strong>
        </article>
        <article className="stat-card">
          <small>{t('autoAgentUi.followUp')}</small>
          <strong className="stat-value">{inProgress}</strong>
        </article>
        <article className="stat-card">
          <small>{t('autoAgentUi.activeReservations')}</small>
          <strong className="stat-value">{reservationsActive}</strong>
        </article>
        <article className="stat-card">
          <small>{t('autoAgentUi.pendingPayments')}</small>
          <strong className="stat-value">{pendingPayments}</strong>
        </article>
        <article className="stat-card">
          <small>{t('autoAgentUi.closedSales')}</small>
          <strong className="stat-value">{completedSales}</strong>
        </article>
      </div>

      <section className="autosales-quick-actions">
        <h2>{t('autoAgentUi.quickActions')}</h2>
        <div>
          <Link className="button" to="/automobile/agent/inquiries">{t('autoAgentUi.myInquiries')}</Link>
          <Link className="button secondary" to="/automobile/reservations">{t('autoAgentUi.reservations')}</Link>
          <Link className="button secondary" to="/automobile/payments">{t('autoAgentUi.payments')}</Link>
          <Link className="button secondary" to="/automobile/vehicles">{t('autoAgentUi.vehicles')}</Link>
          {hasPermission(user, 'VIEW_USER') && <Link className="button secondary" to="/automobile/agents">{t('autoAgentUi.agents')}</Link>}
        </div>
      </section>

      <section className="autosales-panel">
        <div className="autosales-panel__head">
          <h2>{t('autoAgentUi.recentInquiries')}</h2>
          <Link to="/automobile/agent/inquiries">{t('autoAgentUi.seeAll')}</Link>
        </div>
        {inquiriesQuery.isPending ? <p>{t('autoAgentUi.loading')}</p> : inquiries.length === 0 ? <p className="empty">{t('autoAgentUi.noAssignedInquiries')}</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autoAgentUi.customer')}</th>
                  <th>{t('autoAgentUi.vehicle')}</th>
                  <th>{t('autoAgentUi.status')}</th>
                  <th>{t('autoAgentUi.created')}</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.slice(0, 5).map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td>{inquiry.customerName}</td>
                    <td>{inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : '—'}</td>
                    <td>{t(`status.${inquiry.status.toLowerCase()}`, {}, inquiry.status)}</td>
                    <td>{new Date(inquiry.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'sw' ? 'sw-TZ' : 'fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="autosales-panel">
        <div className="autosales-panel__head">
          <h2>{t('autoAgentUi.recentReservations')}</h2>
          <Link to="/automobile/reservations">{t('autoAgentUi.seeAllReservations')}</Link>
        </div>
        {reservationsQuery.isPending ? <p>{t('autoAgentUi.loading')}</p> : reservations.length === 0 ? <p className="empty">{t('autoAgentUi.noAgentReservations')}</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autoAgentUi.customer')}</th>
                  <th>{t('autoAgentUi.vehicle')}</th>
                  <th>{t('autosalesAgent.amount')}</th>
                  <th>{t('autoAgentUi.status')}</th>
                </tr>
              </thead>
              <tbody>
                {reservations.slice(0, 5).map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.customerName}</td>
                    <td>{reservation.vehicle ? `${reservation.vehicle.brand} ${reservation.vehicle.model}` : '—'}</td>
                    <td>{Number(reservation.reservationAmount || 0).toFixed(2)}</td>
                    <td>{t(`status.${reservation.status.toLowerCase()}`, {}, reservation.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

export function AutoSalesAgentInquiryPage() {
  const { lang, t } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const inquiriesQuery = useQuery({
    queryKey: ['autosales-agent-inquiries', user?.id],
    queryFn: () => fetchAssignedInquiries(user),
    enabled: !!user,
  })

  const inquiries = inquiriesQuery.data || []

  if (!isOperationalAutoSalesUser(user)) {
    return (
      <section className="page">
        <div className="card">
          <h1>{t('autoAgentUi.inquiryTitle')}</h1>
          <p className="empty">{t('autoAgentUi.agentOnly')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{t('autoAgentUi.inquiryTitle')}</h1>
          <p>{t('autoAgentUi.assignedFollowUp')}</p>
        </div>
        <Link className="button secondary" to="/automobile/agent">{t('autoAgentUi.back')}</Link>
      </div>

      <div className="card">
        {inquiriesQuery.isPending && <p>{t('autoAgentUi.loadingInquiries')}</p>}
        {inquiriesQuery.isError && <p className="error">{t('autoAgentUi.inquiriesFailed')}</p>}
        {!inquiriesQuery.isPending && !inquiriesQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('autoAgentUi.customer')}</th>
                  <th>{t('autoAgentUi.vehicle')}</th>
                  <th>{t('autoAgentUi.status')}</th>
                  <th>{t('autoAgentUi.created')}</th>
                  <th>{t('autoAgentUi.action')}</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td>{inquiry.customerName}</td>
                    <td>{inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : '—'}</td>
                    <td>{t(`status.${inquiry.status.toLowerCase()}`, {}, inquiry.status)}</td>
                    <td>{new Date(inquiry.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'sw' ? 'sw-TZ' : 'fr-FR')}</td>
                    <td>
                      <button type="button" className="button secondary sm" onClick={() => navigate(`/automobile/agent/inquiries/${inquiry.id}`)}>
                        {t('autoAgentUi.open')}
                      </button>
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

export function AutoSalesAgentInquiryDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('NEW')
  const [internalNotes, setInternalNotes] = useState('')

  const inquiryQuery = useQuery({
    queryKey: ['autosales-agent-inquiry', id],
    queryFn: async () => {
      const response = await api.get(`/api/vehicle-inquiries/${id}`)
      return response.data?.data?.vehicleInquiry || null
    },
    enabled: !!id,
  })

  const inquiry = inquiryQuery.data

  useEffect(() => {
    if (inquiry?.status && status !== inquiry.status) setStatus(inquiry.status)
  }, [inquiry, status])

  useEffect(() => {
    if (inquiry?.internalNotes && internalNotes !== inquiry.internalNotes) setInternalNotes(inquiry.internalNotes)
  }, [inquiry, internalNotes])

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = {}
      if (status) payload.status = status
      if (internalNotes.trim()) payload.internalNotes = internalNotes.trim()
      if (Object.keys(payload).length === 0) return inquiry
      return api.patch(`/api/vehicle-inquiries/${id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-inquiries'] })
      queryClient.invalidateQueries({ queryKey: ['autosales-agent-inquiry', id] })
      navigate('/automobile/agent/inquiries')
    },
  })

  if (inquiryQuery.isPending) return <section className="page"><div className="card"><p>{t('autoAgentUi.loadingDetail')}</p></div></section>
  if (!inquiry) return <section className="page"><div className="card"><p className="empty">{t('autoAgentUi.inquiryNotFound')}</p></div></section>

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{t('autoAgentUi.inquiryTitle')}</h1>
          <p>{inquiry.customerName} · {inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : t('autoAgentUi.vehicleFallback')}</p>
        </div>
        <button type="button" className="button secondary" onClick={() => navigate('/automobile/agent/inquiries')}>{t('autoAgentUi.back')}</button>
      </div>

      <div className="card">
        <div className="autosales-detail-grid">
          <div>
            <p><strong>{t('autoAgentUi.customerLabel')}</strong> {inquiry.customerName}</p>
            <p><strong>{t('autoAgentUi.emailLabel')}</strong> {inquiry.customerEmail || '—'}</p>
            <p><strong>{t('autoAgentUi.phoneLabel')}</strong> {inquiry.customerPhone}</p>
            <p><strong>{t('autoAgentUi.typeLabel')}</strong> {inquiry.inquiryType}</p>
          </div>
          <div>
            <p><strong>{t('autoAgentUi.vehicleLabel')}</strong> {inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : '—'}</p>
            <p><strong>{t('autoAgentUi.assignedToLabel')}</strong> {inquiry.assignedTo ? `${inquiry.assignedTo.firstName} ${inquiry.assignedTo.lastName}` : t('autoAgentUi.unassigned')}</p>
            <p><strong>{t('autoAgentUi.currentStatus')}</strong> {t(`status.${inquiry.status.toLowerCase()}`, {}, inquiry.status)}</p>
          </div>
        </div>

        <div className="autosales-form-grid">
          <label>
            <span>{t('autoAgentUi.status')}</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {inquiryStatuses.map((item) => <option key={item} value={item}>{t(`status.${item.toLowerCase()}`, {}, item)}</option>)}
            </select>
          </label>
          <label>
            <span>{t('autoAgentUi.internalNotes')}</span>
            <textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows="5" />
          </label>
        </div>

        <div>
          <button type="button" className="button" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t('autoAgentUi.saving') : t('autoAgentUi.save')}
          </button>
        </div>
      </div>
    </section>
  )
}
