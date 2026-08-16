import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Eye, Pencil, Search } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'

const QUOTE_REQUEST_STATUSES = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'CLOSED']

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
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
    NEW: t('construction.quoteRequests.statuses.NEW') || 'Nouvelle',
    IN_PROGRESS: t('construction.quoteRequests.statuses.IN_PROGRESS') || 'En cours',
    WAITING_FOR_CLIENT: t('construction.quoteRequests.statuses.WAITING_FOR_CLIENT') || 'En attente du client',
    CLOSED: t('construction.quoteRequests.statuses.CLOSED') || 'Clôturée',
  }
  return labels[status] || status || '—'
}

export function QuoteRequestsPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const canView = hasPermission(user, 'VIEW_QUOTE_REQUEST') || user?.role === 'SUPER_ADMIN'
  const canUpdate = hasPermission(user, 'UPDATE_QUOTE_REQUEST') || user?.role === 'SUPER_ADMIN'

  const requestsQuery = useQuery({
    queryKey: ['construction-quote-requests', search, statusFilter],
    queryFn: async () => {
      const params = { page: 1, limit: 200 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      const response = await api.get('/api/construction/quote-requests', { params })
      return toList(response.data?.data || response.data)
    },
    enabled: canView,
  })

  const requests = useMemo(() => requestsQuery.data || [], [requestsQuery.data])

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return requests.filter((request) => {
      const matchesSearch = !query || [request.customerName, request.customerPhone, request.customerEmail, request.description, request.projectType, request.budgetRange]
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
          <h1>{t('construction.quoteRequests.title')}</h1>
          <p>{t('construction.quoteRequests.subtitle')}</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-filters" style={{ flex: 1 }}>
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('construction.quoteRequests.searchPlaceholder')}
            />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="select-filter">
            <option value="ALL">{t('construction.quoteRequests.allStatuses')}</option>
            {QUOTE_REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>{statusLabel(status, t)}</option>
            ))}
          </select>
        </div>
      </div>

      {requestsQuery.isPending ? (
        <div className="state-container">{t('construction.quoteRequests.loading')}</div>
      ) : requestsQuery.isError ? (
        <div className="state-container">
          <AlertTriangle size={30} />
          <p>{t('construction.quoteRequests.loadError')}</p>
          <button type="button" className="button secondary sm" onClick={() => requestsQuery.refetch()}>{t('dashboard.retry')}</button>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="state-container">
          <p>{t('construction.quoteRequests.empty')}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('construction.quoteRequests.customer')}</th>
                <th>{t('construction.quoteRequests.projectType')}</th>
                <th>{t('construction.quoteRequests.contact')}</th>
                <th>{t('construction.quoteRequests.status')}</th>
                <th>{t('construction.quoteRequests.date')}</th>
                <th style={{ textAlign: 'right' }}>{t('construction.quoteRequests.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td><strong>{request.customerName || '—'}</strong></td>
                  <td>{request.projectType || '—'}</td>
                  <td>{request.customerPhone || request.customerEmail || '—'}</td>
                  <td><span className="badge info">{statusLabel(request.status, t)}</span></td>
                  <td>{formatDate(request.createdAt, lang)}</td>
                  <td>
                    <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="action-btn" title={t('construction.quoteRequests.view')} onClick={() => navigate(`/construction/quote-requests/${request.id}`)}>
                        <Eye size={14} />
                      </button>
                      {canUpdate && (
                        <button type="button" className="action-btn" title={t('construction.quoteRequests.edit')} onClick={() => navigate(`/construction/quote-requests/${request.id}`)}>
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
    </section>
  )
}

export function QuoteRequestDetailPage() {
  const { id } = useParams()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('NEW')

  const requestQuery = useQuery({
    queryKey: ['construction-quote-request', id],
    queryFn: async () => {
      const response = await api.get(`/api/construction/quote-requests/${id}`)
      return response.data?.data?.quoteRequest || response.data?.data || {}
    },
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (requestQuery.data) setStatus(requestQuery.data.status || 'NEW')
  }, [requestQuery.data])

  const updateMutation = useMutation({
    mutationFn: async (nextStatus) => api.put(`/api/construction/quote-requests/${id}`, { status: nextStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-quote-requests'] })
      queryClient.invalidateQueries({ queryKey: ['construction-quote-request', id] })
    },
  })

  const request = requestQuery.data || {}

  if (requestQuery.isPending) {
    return <section className="page"><div className="state-container">{t('construction.quoteRequests.loadingDetail')}</div></section>
  }

  if (requestQuery.isError) {
    return <section className="page"><div className="state-container">{t('construction.quoteRequests.detailError')}</div></section>
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{request.customerName || t('construction.quoteRequests.title')}</h1>
          <p>{t('construction.quoteRequests.detailSubtitle')}</p>
        </div>
        <Link className="button secondary" to="/construction/quote-requests">
          <ArrowLeft size={16} />
          <span>{t('construction.quoteRequests.back')}</span>
        </Link>
      </div>

      <div className="card">
        <div className="vehicle-form-grid">
          <div>
            <strong>{t('construction.quoteRequests.customer')}</strong>
            <p>{request.customerName || '—'}</p>
          </div>
          <div>
            <strong>{t('construction.quoteRequests.projectType')}</strong>
            <p>{request.projectType || '—'}</p>
          </div>
          <div>
            <strong>{t('construction.quoteRequests.contact')}</strong>
            <p>{request.customerPhone || '—'}<br />{request.customerEmail || '—'}</p>
          </div>
          <div>
            <strong>{t('construction.quoteRequests.status')}</strong>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {QUOTE_REQUEST_STATUSES.map((key) => (
                <option key={key} value={key}>{statusLabel(key, t)}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <strong>{t('construction.quoteRequests.description')}</strong>
          <p>{request.description || '—'}</p>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <strong>{t('construction.quoteRequests.budgetRange')}</strong>
          <p>{request.budgetRange || '—'}</p>
        </div>

        <div className="form-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="button" onClick={() => updateMutation.mutate(status)} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t('construction.quoteRequests.saving') : t('construction.quoteRequests.saveStatus')}
          </button>
        </div>
      </div>
    </section>
  )
}
