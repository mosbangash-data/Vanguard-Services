import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { hasPermission } from '../auth/permissions'
import { useLanguage } from '../../i18n/useLanguage'

const PROJECT_STATUS_OPTIONS = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

const money = (value, locale = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '—'
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(numeric)
}

const formatDate = (value, locale) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR')
  } catch {
    return '—'
  }
}

const statusLabel = (status, t) => {
  const labels = {
    DRAFT: t('status.draft') || 'Brouillon',
    PUBLISHED: t('status.published') || 'Publié',
    ARCHIVED: t('status.archived') || 'Archivé',
  }
  return labels[status] || status || '—'
}

export function ProjectListPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const canView = hasPermission(user, 'VIEW_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canCreate = hasPermission(user, 'CREATE_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canUpdate = hasPermission(user, 'UPDATE_PROJECT') || user?.role === 'SUPER_ADMIN'
  const canDelete = hasPermission(user, 'DELETE_PROJECT') || user?.role === 'SUPER_ADMIN'

  const projectsQuery = useQuery({
    queryKey: ['construction-projects', search, statusFilter],
    queryFn: async () => {
      const params = { page: 1, limit: 100 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      const response = await api.get('/api/construction/projects', { params })
      const items = toList(response.data?.data || response.data)
      return items
    },
    enabled: canView,
  })

  const deleteMutation = useMutation({
    mutationFn: async (projectId) => api.delete(`/api/construction/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-projects'] })
    },
  })

  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data])

  const filteredProjects = useMemo(() => {
    if (!search.trim() && statusFilter === 'ALL') return projects
    const query = search.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesSearch = !query || [project.title, project.location, project.description].some((value) => String(value || '').toLowerCase().includes(query))
      const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [projects, search, statusFilter])

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
          <h1>{t('construction.projects.title')}</h1>
          <p>{t('construction.projects.subtitle')}</p>
        </div>
        {canCreate && (
          <button type="button" className="button" onClick={() => navigate('/construction/projects/new')}>
            <Plus size={16} />
            <span>{t('construction.projects.new')}</span>
          </button>
        )}
      </div>

      <div className="toolbar">
        <div className="toolbar-filters" style={{ flex: 1 }}>
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('construction.projects.searchPlaceholder')}
            />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="select-filter">
            <option value="ALL">{t('construction.projects.allStatuses')}</option>
            {PROJECT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{statusLabel(status, t)}</option>
            ))}
          </select>
        </div>
      </div>

      {projectsQuery.isPending ? (
        <div className="state-container">{t('construction.projects.loading')}</div>
      ) : projectsQuery.isError ? (
        <div className="state-container">
          <AlertTriangle size={30} />
          <p>{t('construction.projects.loadError')}</p>
          <button type="button" className="button secondary sm" onClick={() => projectsQuery.refetch()}>{t('dashboard.retry')}</button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="state-container">
          <p>{t('construction.projects.empty')}</p>
          {canCreate && (
            <button type="button" className="button" onClick={() => navigate('/construction/projects/new')}>
              <Plus size={16} />
              <span>{t('construction.projects.new')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('construction.projects.name')}</th>
                <th>{t('construction.projects.location')}</th>
                <th>{t('construction.projects.status')}</th>
                <th>{t('construction.projects.publicationStatus')}</th>
                <th>{t('construction.projects.budget')}</th>
                <th>{t('construction.projects.createdAt')}</th>
                <th style={{ textAlign: 'right' }}>{t('construction.projects.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id}>
                  <td><strong>{project.title || '—'}</strong></td>
                  <td>{project.location || '—'}</td>
                  <td><span className="badge info">{statusLabel(project.status, t)}</span></td>
                  <td>{statusLabel(project.publicationStatus, t)}</td>
                  <td>{money(project.budget, lang)}</td>
                  <td>{formatDate(project.createdAt, lang)}</td>
                  <td>
                    <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="action-btn" title={t('construction.projects.view')} onClick={() => navigate(`/construction/projects/${project.id}`)}>
                        <Eye size={14} />
                      </button>
                      {canUpdate && (
                        <button type="button" className="action-btn" title={t('construction.projects.edit')} onClick={() => navigate(`/construction/projects/${project.id}/edit`)}>
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          className="action-btn danger"
                          title={t('construction.projects.delete')}
                          onClick={() => {
                            if (window.confirm(t('construction.projects.confirmDelete'))) {
                              deleteMutation.mutate(project.id)
                            }
                          }}
                        >
                          <Trash2 size={14} />
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
