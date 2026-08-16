import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Hammer,
  HardHat,
  ListTodo,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useAuth } from '../auth/authContext'
import { useLanguage } from '../../i18n/useLanguage'

const toList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
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

const formatDateTime = (value, locale) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function ConstructionEngineerDashboardPage() {
  const { user } = useAuth()
  const { lang, t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Fetch engineer's assigned projects
  const projectsQuery = useQuery({
    queryKey: ['construction-engineer-projects'],
    queryFn: async () => {
      const response = await api.get('/api/construction/engineer/projects', { params: { limit: 100 } })
      return toList(response.data?.data || response.data)
    },
  })

  // Fetch personal notifications
  const notificationsQuery = useQuery({
    queryKey: ['engineer-notifications'],
    queryFn: async () => {
      const response = await api.get('/api/notifications')
      return toList(response.data?.data || response.data)
    },
  })

  // Mark notification as read
  const markReadMutation = useMutation({
    mutationFn: async (id) => api.put(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engineer-notifications'] })
    },
  })

  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data])
  const notifications = useMemo(() => notificationsQuery.data || [], [notificationsQuery.data])

  const stats = useMemo(() => {
    const total = projects.length
    const published = projects.filter((p) => p.status === 'PUBLISHED').length
    const archived = projects.filter((p) => p.status === 'ARCHIVED').length
    const draft = projects.filter((p) => p.status === 'DRAFT').length
    return { total, published, archived, draft }
  }, [projects])

  const recentProjects = useMemo(() => {
    return [...projects].slice(0, 5)
  }, [projects])

  if (projectsQuery.isPending) {
    return (
      <section className="page">
        <div className="page-head">
          <div>
            <h1>{t('construction.engineer.dashboard.title')}</h1>
            <p>{t('construction.engineer.dashboard.subtitle')}</p>
          </div>
        </div>
        <div className="state-container">
          <Clock size={28} className="spin" />
          <p>{t('construction.engineer.dashboard.loading')}</p>
        </div>
      </section>
    )
  }

  if (projectsQuery.isError) {
    return (
      <section className="page">
        <div className="page-head">
          <div>
            <h1>{t('construction.engineer.dashboard.title')}</h1>
            <p>{t('construction.engineer.dashboard.subtitle')}</p>
          </div>
        </div>
        <div className="state-container">
          <AlertTriangle size={32} style={{ color: 'var(--color-danger)' }} />
          <h3>{t('dashboard.errorTitle')}</h3>
          <p>{t('construction.engineer.dashboard.errorLoading')}</p>
          <button type="button" className="button secondary" onClick={() => projectsQuery.refetch()}>
            <RefreshCw size={16} />
            <span>{t('dashboard.retry')}</span>
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <HardHat size={22} style={{ color: 'var(--color-dark)' }} />
            <h1>{t('construction.engineer.dashboard.title')}</h1>
          </div>
          <p>
            {t('construction.engineer.dashboard.welcomePrefix')}{' '}
            <strong>{user?.firstName} {user?.lastName}</strong> — {t('construction.engineer.dashboard.subtitle')}
          </p>
        </div>
        <div className="page-actions">
          <Link to="/construction/engineer/projects" className="button">
            <Building2 size={16} />
            <span>{t('construction.engineer.dashboard.viewAllProjects')}</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="dashboard-stats-grid">
        <article className="stat-card stat-card--primary">
          <div className="stat-header">
            <span>{t('construction.engineer.stats.assignedProjects')}</span>
            <Building2 size={18} className="stat-icon" aria-hidden="true" />
          </div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-sub">{t('construction.engineer.stats.assignedProjectsSub')}</div>
        </article>

        <article className="stat-card stat-card--success">
          <div className="stat-header">
            <span>{t('construction.engineer.stats.activeSites')}</span>
            <TrendingUp size={18} className="stat-icon" aria-hidden="true" />
          </div>
          <div className="stat-value">{stats.published}</div>
          <div className="stat-sub">{t('construction.engineer.stats.activeSitesSub')}</div>
        </article>

        <article className="stat-card stat-card--secondary">
          <div className="stat-header">
            <span>{t('construction.engineer.stats.completedSites')}</span>
            <CheckCircle2 size={18} className="stat-icon" aria-hidden="true" />
          </div>
          <div className="stat-value">{stats.archived}</div>
          <div className="stat-sub">{t('construction.engineer.stats.completedSitesSub')}</div>
        </article>

        <article className="stat-card stat-card--neutral">
          <div className="stat-header">
            <span>{t('construction.engineer.stats.draftSites')}</span>
            <Hammer size={18} className="stat-icon" aria-hidden="true" />
          </div>
          <div className="stat-value">{stats.draft}</div>
          <div className="stat-sub">{t('construction.engineer.stats.draftSitesSub')}</div>
        </article>
      </div>

      {/* Panels: Assigned Projects & Notifications */}
      <div className="panel-grid two-column">
        {/* Panel 1: Mes Chantiers Affectés */}
        <section className="dashboard-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <Building2 size={18} className="panel-icon" aria-hidden="true" />
              <h2>{t('construction.engineer.dashboard.mySitesTitle')}</h2>
            </div>
            <Link to="/construction/engineer/projects" className="button secondary sm">
              {t('construction.engineer.dashboard.viewAll')}
            </Link>
          </div>

          {recentProjects.length === 0 ? (
            <div className="empty-state">{t('construction.engineer.dashboard.noAssignedProjects')}</div>
          ) : (
            <div className="engineer-projects-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  style={{
                    padding: '12px 14px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-white)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{project.title}</strong>
                      <span className={`badge ${project.status === 'PUBLISHED' ? 'success' : project.status === 'ARCHIVED' ? 'secondary' : 'info'}`}>
                        {project.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-medium-gray)', marginTop: '2px' }}>
                      {project.location ? `📍 ${project.location}` : t('construction.engineer.dashboard.noLocation')} · {formatDate(project.createdAt, lang)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button secondary sm"
                    onClick={() => navigate(`/construction/engineer/projects/${project.id}`)}
                    title={t('construction.engineer.dashboard.openProject')}
                  >
                    <ExternalLink size={14} />
                    <span>{t('construction.engineer.dashboard.open')}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Panel 2: Mes Notifications */}
        <section className="dashboard-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <Bell size={18} className="panel-icon" aria-hidden="true" />
              <h2>{t('construction.engineer.dashboard.notificationsTitle')}</h2>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="empty-state">{t('construction.engineer.dashboard.noNotifications')}</div>
          ) : (
            <div className="activity-list">
              {notifications.slice(0, 5).map((notification) => (
                <article
                  key={notification.id}
                  className="activity-item"
                  style={{
                    opacity: notification.read ? 0.7 : 1,
                    borderLeft: notification.read ? 'none' : '3px solid var(--color-dark)',
                    paddingLeft: notification.read ? '12px' : '16px',
                  }}
                >
                  <div className="activity-topline">
                    <strong>{notification.title || notification.type}</strong>
                    <span>{formatDateTime(notification.createdAt, lang)}</span>
                  </div>
                  <p style={{ margin: '4px 0 6px', fontSize: '0.85rem' }}>{notification.message}</p>
                  {!notification.read && (
                    <button
                      type="button"
                      className="button secondary sm"
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      onClick={() => markReadMutation.mutate(notification.id)}
                    >
                      {t('construction.engineer.dashboard.markRead')}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Roadmap & Coming Soon Section (Transparent non-simulated features) */}
      <section className="dashboard-panel" style={{ marginTop: '24px' }}>
        <div className="panel-header">
          <div className="panel-title-wrap">
            <Calendar size={18} className="panel-icon" aria-hidden="true" />
            <h2>{t('construction.engineer.roadmap.title')}</h2>
          </div>
          <span className="badge info">{t('construction.engineer.roadmap.badge')}</span>
        </div>
        <p style={{ color: 'var(--color-medium-gray)', fontSize: '0.875rem', marginBottom: '16px' }}>
          {t('construction.engineer.roadmap.description')}
        </p>
        <div className="panel-grid three-column" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <div
            style={{
              padding: '16px',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--color-dark)' }} />
              <strong>{t('construction.engineer.roadmap.planningTitle')}</strong>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--color-medium-gray)', margin: 0 }}>
              {t('construction.engineer.roadmap.planningDesc')}
            </p>
          </div>

          <div
            style={{
              padding: '16px',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FileCheck2 size={18} style={{ color: 'var(--color-dark)' }} />
              <strong>{t('construction.engineer.roadmap.reportsTitle')}</strong>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--color-medium-gray)', margin: 0 }}>
              {t('construction.engineer.roadmap.reportsDesc')}
            </p>
          </div>

          <div
            style={{
              padding: '16px',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ListTodo size={18} style={{ color: 'var(--color-dark)' }} />
              <strong>{t('construction.engineer.roadmap.tasksTitle')}</strong>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--color-medium-gray)', margin: 0 }}>
              {t('construction.engineer.roadmap.tasksDesc')}
            </p>
          </div>
        </div>
      </section>
    </section>
  )
}
