import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, ExternalLink, RefreshCw, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
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
  if (!Number.isFinite(numeric) || value === null || value === undefined) return '—'
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(numeric)
}

const formatDate = (value, locale) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function ConstructionEngineerProjectsPage() {
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const projectsQuery = useQuery({
    queryKey: ['construction-engineer-projects-list', search, statusFilter],
    queryFn: async () => {
      const params = { page: 1, limit: 100 }
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'ALL') params.status = statusFilter
      const response = await api.get('/api/construction/engineer/projects', { params })
      return toList(response.data?.data || response.data)
    },
  })

  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data])

  const filteredProjects = useMemo(() => {
    if (!search.trim() && statusFilter === 'ALL') return projects
    const query = search.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesSearch =
        !query ||
        [project.title, project.location, project.description].some((value) =>
          String(value || '').toLowerCase().includes(query),
        )
      const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [projects, search, statusFilter])

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return <span className="badge success">{t('status.published')}</span>
      case 'ARCHIVED':
        return <span className="badge secondary">{t('status.archived')}</span>
      case 'DRAFT':
      default:
        return <span className="badge info">{t('status.draft')}</span>
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Building2 size={22} style={{ color: 'var(--color-dark)' }} />
            <h1>{t('construction.engineer.projects.title')}</h1>
          </div>
          <p>{t('construction.engineer.projects.subtitle')}</p>
        </div>
        <div className="page-actions">
          <Link to="/construction/engineer" className="button secondary">
            ← {t('construction.engineer.projects.backToDashboard')}
          </Link>
        </div>
      </div>

      {/* Toolbar with Search and Filters */}
      <div className="toolbar">
        <div className="toolbar-filters" style={{ flex: 1 }}>
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('construction.engineer.projects.searchPlaceholder')}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-filter"
          >
            <option value="ALL">{t('construction.engineer.projects.allStatuses')}</option>
            {PROJECT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'PUBLISHED'
                  ? t('status.published')
                  : status === 'ARCHIVED'
                  ? t('status.archived')
                  : t('status.draft')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {projectsQuery.isPending ? (
        <div className="state-container">
          <p>{t('construction.engineer.projects.loading')}</p>
        </div>
      ) : projectsQuery.isError ? (
        <div className="state-container">
          <AlertTriangle size={30} style={{ color: 'var(--color-danger)' }} />
          <p>{t('construction.engineer.projects.loadError')}</p>
          <button
            type="button"
            className="button secondary sm"
            onClick={() => projectsQuery.refetch()}
          >
            <RefreshCw size={14} />
            <span>{t('dashboard.retry')}</span>
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="state-container">
          <Building2 size={36} style={{ color: 'var(--color-medium-gray)', marginBottom: '8px' }} />
          <h3>{t('construction.engineer.projects.emptyTitle')}</h3>
          <p>{t('construction.engineer.projects.empty')}</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('construction.engineer.projects.name')}</th>
                <th>{t('construction.engineer.projects.location')}</th>
                <th>{t('construction.engineer.projects.status')}</th>
                <th>{t('construction.engineer.projects.budget')}</th>
                <th>{t('construction.engineer.projects.createdAt')}</th>
                <th style={{ textAlign: 'right' }}>{t('construction.engineer.projects.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <div>
                      <strong>{project.title || '—'}</strong>
                      {project.description && (
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--color-medium-gray)',
                            maxWidth: '320px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {project.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{project.location || '—'}</td>
                  <td>{getStatusBadge(project.status)}</td>
                  <td>{money(project.budget, lang)}</td>
                  <td>{formatDate(project.createdAt, lang)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="button secondary sm"
                      onClick={() => navigate(`/construction/engineer/projects/${project.id}`)}
                      title={t('construction.engineer.projects.viewDetail')}
                    >
                      <ExternalLink size={14} />
                      <span>{t('construction.engineer.projects.viewDetail')}</span>
                    </button>
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
