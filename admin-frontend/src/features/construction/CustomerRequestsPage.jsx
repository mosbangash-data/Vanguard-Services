import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Eye, Pencil, Search } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'

const CUSTOMER_REQUEST_STATUSES = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'WAITING_CLIENT', 'CONVERTED', 'RESOLVED', 'CLOSED']

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}
const toPage = (payload) => {
  const data = payload?.data || payload || {}
  return { items: toList(data), page: Number(data.page) || 1, limit: Number(data.limit) || 20, total: Number(data.total) || 0 }
}

const formatDate = (value, lang) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return '—'
  }
}

const statusLabel = (status, t) => {
  const labels = {
    NEW: t('construction.requests.statuses.NEW') || 'Nouvelle',
    CONTACTED: t('construction.requests.statuses.CONTACTED') || 'Contactée',
    IN_PROGRESS: t('construction.requests.statuses.IN_PROGRESS') || 'En cours',
    WAITING_CLIENT: t('construction.requests.statuses.WAITING_CLIENT') || 'En attente client',
    CONVERTED: t('construction.requests.statuses.CONVERTED') || 'Convertie',
    RESOLVED: t('construction.requests.statuses.RESOLVED') || 'Résolue',
    CLOSED: t('construction.requests.statuses.CLOSED') || 'Clôturée',
  }
  return labels[status] || status || '—'
}

export function CustomerRequestsPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  const canView = hasPermission(user, 'VIEW_CUSTOMER_REQUEST') || user?.role === 'SUPER_ADMIN'
  const canUpdate = hasPermission(user, 'UPDATE_CUSTOMER_REQUEST') || user?.role === 'SUPER_ADMIN'

  const requestsQuery = useQuery({
    queryKey: ['construction-customer-requests', search, statusFilter, page],
    queryFn: async () => {
      const params = { page, limit: 20 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      const response = await api.get('/api/construction/customer-requests', { params })
      return toPage(response.data)
    },
    enabled: canView,
  })

  const requests = useMemo(() => requestsQuery.data?.items || [], [requestsQuery.data])

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return requests.filter((request) => {
      const matchesSearch = !query || [request.subject, request.customerName, request.customerPhone, request.customerEmail, request.message]
        .some((value) => String(value || '').toLowerCase().includes(query))
      const matchesStatus = statusFilter === 'ALL' || request.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [requests, search, statusFilter])

  if (!canView) {
    return (
      <section className="page">
        <div className="state-container">
          <AlertTriangle size={30} />
          <p>{t('construction.accessDenied')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{t('construction.requests.title')}</h1>
          <p>{t('construction.requests.subtitle')}</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters" style={{ flex: 1 }}>
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder={t('construction.requests.searchPlaceholder')}
            />
          </div>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className="select-filter">
            <option value="ALL">{t('construction.requests.allStatuses')}</option>
            {CUSTOMER_REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>{statusLabel(status, t)}</option>
            ))}
          </select>
        </div>
      </div>

      {requestsQuery.isPending ? (
        <div className="state-container">{t('construction.requests.loading')}</div>
      ) : requestsQuery.isError ? (
        <div className="state-container">
          <AlertTriangle size={30} />
          <p>{t('construction.requests.loadError')}</p>
          <button type="button" className="button secondary sm" onClick={() => requestsQuery.refetch()}>{t('dashboard.retry')}</button>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="state-container">
          <p>{t('construction.requests.empty')}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('construction.requests.subject')}</th>
                <th>{t('construction.requests.customer')}</th>
                <th>{t('construction.requests.contact')}</th>
                <th>{t('construction.requests.status')}</th>
                <th>{t('construction.requests.date')}</th>
                <th style={{ textAlign: 'right' }}>{t('construction.requests.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td><strong>{request.subject || '—'}</strong></td>
                  <td>{request.customerName || '—'}</td>
                  <td>{request.customerPhone || request.customerEmail || '—'}</td>
                  <td><span className="badge info">{statusLabel(request.status, t)}</span></td>
                  <td>{formatDate(request.createdAt, lang)}</td>
                  <td>
                    <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="action-btn" title={t('construction.requests.view')} aria-label={t('construction.requests.view')} onClick={() => navigate(`/construction/customer-requests/${request.id}`)}>
                        <Eye size={14} />
                      </button>
                      {canUpdate && (
                        <button type="button" className="action-btn" title={t('construction.requests.edit')} aria-label={t('construction.requests.edit')} onClick={() => navigate(`/construction/customer-requests/${request.id}`)}>
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!requestsQuery.isPending && !requestsQuery.isError && Number(requestsQuery.data?.total || 0) > Number(requestsQuery.data?.limit || 20) && <nav className="construction-pagination" aria-label={t('construction.requests.paginationLabel')}>
        <button type="button" className="button secondary sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t('construction.requests.previous')}</button>
        <span>{t('construction.requests.page', { page, pages: Math.ceil(requestsQuery.data.total / requestsQuery.data.limit) })}</span>
        <button type="button" className="button secondary sm" disabled={page >= Math.ceil(requestsQuery.data.total / requestsQuery.data.limit)} onClick={() => setPage((current) => Math.min(Math.ceil(requestsQuery.data.total / requestsQuery.data.limit), current + 1))}>{t('construction.requests.next')}</button>
      </nav>}
    </section>
  )
}

export function CustomerRequestDetailPage() {
  const { user } = useAuth()
  const { id } = useParams()
  const { lang, t } = useLanguage()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('NEW')
  const canView = hasPermission(user, 'VIEW_CUSTOMER_REQUEST') || user?.role === 'SUPER_ADMIN'
  const canUpdate = hasPermission(user, 'UPDATE_CUSTOMER_REQUEST') || user?.role === 'SUPER_ADMIN'

  const requestQuery = useQuery({
    queryKey: ['construction-customer-request', id],
    queryFn: async () => {
      const response = await api.get(`/api/construction/customer-requests/${id}`)
      return response.data?.data?.customerRequest || response.data?.data || {}
    },
    enabled: Boolean(id) && canView,
  })

  useEffect(() => {
    if (requestQuery.data) setStatus(requestQuery.data.status || 'NEW')
  }, [requestQuery.data])

  const updateMutation = useMutation({
    mutationFn: async (nextStatus) => api.put(`/api/construction/customer-requests/${id}`, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-customer-requests'] })
      queryClient.invalidateQueries({ queryKey: ['construction-customer-request', id] })
    },
  })

  const request = requestQuery.data || {}

  if (!canView) return <section className="page"><div className="state-container" role="alert">{t('construction.accessDenied')}</div></section>

  if (requestQuery.isPending) {
    return <section className="page"><div className="state-container">{t('construction.requests.loadingDetail')}</div></section>
  }

  if (requestQuery.isError) {
    return <section className="page"><div className="state-container" role="alert"><p>{t('construction.requests.detailError')}</p><button type="button" className="button secondary sm" onClick={() => requestQuery.refetch()}>{t('dashboard.retry')}</button></div></section>
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{request.subject || t('construction.requests.title')}</h1>
          <p>{t('construction.requests.detailSubtitle')}</p>
        </div>
        <Link className="button secondary" to="/construction/customer-requests">
          <ArrowLeft size={16} />
          <span>{t('construction.requests.back')}</span>
        </Link>
      </div>

      <div className="card">
        <div className="vehicle-form-grid">
          <div>
            <strong>{t('construction.requests.customer')}</strong>
            <p>{request.customerName || '—'}</p>
          </div>
          <div>
            <strong>{t('construction.requests.contact')}</strong>
            <p>{request.customerPhone || '—'}<br />{request.customerEmail || '—'}</p>
          </div>
          <div>
            <strong>{t('construction.requests.status')}</strong>
            <select value={status} disabled={!canUpdate} aria-label={t('construction.requests.status')} onChange={(event) => setStatus(event.target.value)}>
              {CUSTOMER_REQUEST_STATUSES.map((key) => (
                <option key={key} value={key}>{statusLabel(key, t)}</option>
              ))}
            </select>
          </div>
          <div>
            <strong>{t('construction.requests.date')}</strong>
            <p>{formatDate(request.createdAt, lang)}</p>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <strong>{t('construction.requests.message')}</strong>
          <p>{request.message || '—'}</p>
        </div>

        {updateMutation.isError && <p className="error" role="alert">{t('construction.requests.updateError')}</p>}
        {canUpdate && <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="button" onClick={() => updateMutation.mutate(status)} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t('construction.requests.saving') : t('construction.requests.saveStatus')}
          </button>
        </div>}
      </div>
    </section>
  )
}
