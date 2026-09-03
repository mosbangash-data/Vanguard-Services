import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../services/api'
import { useAuth } from '../../auth/authContext'
import { hasPermission } from '../../auth/permissions'

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
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [error, setError] = useState('')

  const canManageAgents = hasPermission(user, 'VIEW_USER') || hasPermission(user, 'CREATE_USER') || user?.role === 'SUPER_ADMIN'
  const departmentsQuery = useQuery({ queryKey: ['autosales-departments'], queryFn: fetchAutoSalesDepartment })
  const rolesQuery = useQuery({ queryKey: ['autosales-roles'], queryFn: fetchRoles })
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
        throw new Error('Le département AutoSales ou le rôle Agent est introuvable.')
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
      window.alert('Agent créé. Un parcours sécurisé de définition du mot de passe est requis.')
    },
    onError: (err) => {
      setError(err?.response?.data?.message || 'Échec de la création de l’agent.')
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
          <h1>Agents AutoSales</h1>
          <p className="empty">Vous n’avez pas les droits pour gérer les agents AutoSales.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Agents AutoSales</h1>
          <p>Gestion des comptes agents du département AutoSales.</p>
        </div>
        <Link className="button secondary" to="/automobile/agent">Retour espace agent</Link>
      </div>

      <div className="card">
        <h2>Créer un agent</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            createMutation.mutate()
          }}
          className="autosales-form-grid"
        >
          <label>
            <span>Prénom</span>
            <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
          </label>
          <label>
            <span>Nom</span>
            <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
          </label>
          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            <span>Téléphone</span>
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          {error && <p className="error">{error}</p>}
          <div>
            <button type="submit" className="button" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création...' : 'Créer l’agent'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Liste des agents</h2>
        {agentsQuery.isPending && <p>Chargement...</p>}
        {agentsQuery.isError && <p className="error">Impossible de charger les agents.</p>}
        {!agentsQuery.isPending && !agentsQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Statut</th>
                  <th>Actions</th>
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
                        {agent.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}
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
  const completedSales = reservations.filter((reservation) => reservation.status === 'COMPLETED' || reservation.paymentStatus === 'COMPLETED').length

  if (!isOperationalAutoSalesUser(user)) {
    return (
      <section className="page">
        <div className="card">
          <h1>Espace opérationnel</h1>
          <p className="empty">Cette zone est réservée à l’équipe AutoSales.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page autosales-dashboard">
      <div className="page-head">
        <div>
          <p className="autosales-eyebrow">VANGUARD SERVICES · AGENT</p>
          <h1>Espace opérationnel AutoSales</h1>
          <p>Bienvenue {user?.firstName || 'Agent'}.</p>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        <article className="stat-card">
          <small>Demandes assignées</small>
          <strong className="stat-value">{inquiriesQuery.isPending ? '…' : total}</strong>
        </article>
        <article className="stat-card">
          <small>Nouvelles</small>
          <strong className="stat-value">{newCount}</strong>
        </article>
        <article className="stat-card">
          <small>Suivi</small>
          <strong className="stat-value">{inProgress}</strong>
        </article>
        <article className="stat-card">
          <small>Réservations actives</small>
          <strong className="stat-value">{reservationsActive}</strong>
        </article>
        <article className="stat-card">
          <small>Paiements en attente</small>
          <strong className="stat-value">{pendingPayments}</strong>
        </article>
        <article className="stat-card">
          <small>Ventes clôturées</small>
          <strong className="stat-value">{completedSales}</strong>
        </article>
      </div>

      <section className="autosales-quick-actions">
        <h2>Actions</h2>
        <div>
          <Link className="button" to="/automobile/agent/inquiries">Mes demandes</Link>
          <Link className="button secondary" to="/automobile/reservations">Réservations</Link>
          <Link className="button secondary" to="/automobile/payments">Paiements</Link>
          <Link className="button secondary" to="/automobile/vehicles">Véhicules</Link>
          {hasPermission(user, 'VIEW_USER') && <Link className="button secondary" to="/automobile/agents">Agents</Link>}
        </div>
      </section>

      <section className="autosales-panel">
        <div className="autosales-panel__head">
          <h2>Demandes récentes</h2>
          <Link to="/automobile/agent/inquiries">Voir toutes</Link>
        </div>
        {inquiriesQuery.isPending ? <p>Chargement...</p> : inquiries.length === 0 ? <p className="empty">Aucune demande assignée.</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Véhicule</th>
                  <th>Statut</th>
                  <th>Créée</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.slice(0, 5).map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td>{inquiry.customerName}</td>
                    <td>{inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : '—'}</td>
                    <td>{inquiry.status}</td>
                    <td>{new Date(inquiry.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="autosales-panel">
        <div className="autosales-panel__head">
          <h2>Réservations récentes</h2>
          <Link to="/automobile/reservations">Voir toutes</Link>
        </div>
        {reservationsQuery.isPending ? <p>Chargement...</p> : reservations.length === 0 ? <p className="empty">Aucune réservation pour cet agent.</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Véhicule</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {reservations.slice(0, 5).map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.customerName}</td>
                    <td>{reservation.vehicle ? `${reservation.vehicle.brand} ${reservation.vehicle.model}` : '—'}</td>
                    <td>{Number(reservation.reservationAmount || 0).toFixed(2)}</td>
                    <td>{reservation.status}</td>
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
          <h1>Demandes AutoSales</h1>
          <p className="empty">Accès limité aux agents AutoSales.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Demandes AutoSales</h1>
          <p>Suivi des demandes assignées.</p>
        </div>
        <Link className="button secondary" to="/automobile/agent">Retour</Link>
      </div>

      <div className="card">
        {inquiriesQuery.isPending && <p>Chargement...</p>}
        {inquiriesQuery.isError && <p className="error">Impossible de charger les demandes.</p>}
        {!inquiriesQuery.isPending && !inquiriesQuery.isError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Véhicule</th>
                  <th>Statut</th>
                  <th>Créée</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td>{inquiry.customerName}</td>
                    <td>{inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : '—'}</td>
                    <td>{inquiry.status}</td>
                    <td>{new Date(inquiry.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td>
                      <button type="button" className="button secondary sm" onClick={() => navigate(`/automobile/agent/inquiries/${inquiry.id}`)}>
                        Ouvrir
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
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
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

  if (inquiryQuery.isPending) return <section className="page"><div className="card"><p>Chargement...</p></div></section>
  if (!inquiry) return <section className="page"><div className="card"><p className="empty">Demande introuvable.</p></div></section>

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Demande AutoSales</h1>
          <p>{inquiry.customerName} · {inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : 'Véhicule'}</p>
        </div>
        <button type="button" className="button secondary" onClick={() => navigate('/automobile/agent/inquiries')}>Retour</button>
      </div>

      <div className="card">
        <div className="autosales-detail-grid">
          <div>
            <p><strong>Client :</strong> {inquiry.customerName}</p>
            <p><strong>Email :</strong> {inquiry.customerEmail || '—'}</p>
            <p><strong>Téléphone :</strong> {inquiry.customerPhone}</p>
            <p><strong>Type :</strong> {inquiry.inquiryType}</p>
          </div>
          <div>
            <p><strong>Véhicule :</strong> {inquiry.vehicle ? `${inquiry.vehicle.brand} ${inquiry.vehicle.model}` : '—'}</p>
            <p><strong>Assigné à :</strong> {inquiry.assignedTo ? `${inquiry.assignedTo.firstName} ${inquiry.assignedTo.lastName}` : 'Non assigné'}</p>
            <p><strong>Statut actuel :</strong> {inquiry.status}</p>
          </div>
        </div>

        <div className="autosales-form-grid">
          <label>
            <span>Statut</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {inquiryStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Notes internes</span>
            <textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows="5" />
          </label>
        </div>

        <div>
          <button type="button" className="button" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </section>
  )
}
