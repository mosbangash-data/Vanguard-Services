import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Building2,
  ClipboardList,
  FileText,
  ImageIcon,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { api } from '../../services/api'

async function fetchConstructionOverview() {
  const response = await api.get('/api/dashboard/overview')
  return response.data?.data || response.data || {}
}

const formatNumber = (value, lang = 'fr') => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'fr-FR').format(numeric)
}

const getStatusLabel = (status, t) => {
  const labels = {
    DRAFT: t('dashboard.draft'),
    PUBLISHED: t('dashboard.published'),
    ARCHIVED: t('dashboard.archived'),
    NEW: t('status.new'),
    IN_PROGRESS: t('status.in_progress'),
    COMPLETED: t('status.completed'),
    CANCELLED: t('status.cancelled'),
    WAITING_FOR_CLIENT: t('dashboard.waitingForClient'),
    WAITING_CLIENT: t('dashboard.waitingForClient'),
    CLOSED: t('status.closed'),
    ACTIVE: t('dashboard.active'),
    SUSPENDED: t('status.cancelled'),
  }

  return labels[status] || status?.replace(/_/g, ' ') || '—'
}

function StatCard({ label, value, sub, icon: Icon, accent = 'default' }) {
  return (
    <article className={`stat-card stat-card--${accent}`}>
      <div className="stat-header">
        <span>{label}</span>
        <Icon size={18} className="stat-icon" aria-hidden="true" />
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </article>
  )
}

function StatusList({ values, t }) {
  const entries = Object.entries(values || {}).filter(([key]) => key !== 'total')
  if (!entries.length) return null

  return (
    <div className="status-grid">
      {entries.map(([key, count]) => (
        <div key={key} className="status-item">
          <span>{getStatusLabel(key, t)}</span>
          <strong>{formatNumber(count, 'fr')}</strong>
        </div>
      ))}
    </div>
  )
}

function ActivityList({ items, t }) {
  if (!items || !items.length) {
    return <div className="empty-state">{t('dashboard.noActivity')}</div>
  }

  return (
    <div className="activity-list">
      {items.map((item) => {
        const details = item.details && typeof item.details === 'object' ? JSON.stringify(item.details) : item.details
        return (
          <article key={item.id || `${item.action}-${item.createdAt}`} className="activity-item">
            <div className="activity-topline">
              <strong>{item.action || t('dashboard.activity')}</strong>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            <div className="activity-meta">
              {item.actorId ? `${t('dashboard.actor')}: ${item.actorId}` : t('dashboard.system')}
            </div>
            {details ? <div className="activity-details">{details}</div> : null}
          </article>
        )
      })}
    </div>
  )
}

export function ConstructionDashboardPage() {
  const { lang, t } = useLanguage()
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['construction-dashboard-overview'],
    queryFn: fetchConstructionOverview,
  })

  if (isPending) {
    return (
      <section className="page">
        <div className="page-head">
          <div>
            <h1>{t('construction.title')}</h1>
            <p>{t('construction.subtitle')}</p>
          </div>
        </div>
        <div className="dashboard-stats-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="stat-card skeleton-pulse">
              <div className="stat-header">
                <div className="skeleton-line" style={{ width: '60%', height: '16px' }} />
                <div className="skeleton-line" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
              </div>
              <div className="stat-value" style={{ margin: '16px 0 8px' }}>
                <div className="skeleton-line" style={{ width: '40%', height: '36px' }} />
              </div>
              <div className="stat-sub">
                <div className="skeleton-line" style={{ width: '80%', height: '14px' }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (isError) {
    const errorMsg = error?.response?.data?.message || t('dashboard.errorState')
    return (
      <section className="page">
        <div className="page-head">
          <div>
            <h1>{t('construction.title')}</h1>
            <p>{t('construction.subtitle')}</p>
          </div>
        </div>
        <div className="state-container">
          <AlertTriangle size={36} style={{ color: 'var(--color-danger)' }} />
          <h3 style={{ margin: '12px 0 6px', color: 'var(--color-dark)' }}>{t('dashboard.errorTitle')}</h3>
          <p style={{ color: 'var(--color-medium-gray)', marginBottom: '16px' }}>{errorMsg}</p>
          <button type="button" className="button secondary" onClick={() => refetch()}>
            <RefreshCw size={16} />
            <span>{t('dashboard.retry')}</span>
          </button>
        </div>
      </section>
    )
  }

  const overview = data || {}
  const construction = overview.construction || {}
  const recentActivity = overview.recentActivity || []

  const stats = [
    {
      label: t('construction.stats.totalProjects'),
      value: formatNumber(construction.projects?.total || 0, lang),
      sub: t('construction.stats.totalProjectsSub'),
      icon: Building2,
      accent: 'primary',
    },
    {
      label: t('construction.stats.activeProjects'),
      value: formatNumber(construction.projects?.PUBLISHED || 0, lang),
      sub: t('construction.stats.activeProjectsSub'),
      icon: TrendingUp,
      accent: 'success',
    },
    {
      label: t('construction.stats.completedProjects'),
      value: formatNumber(construction.projects?.ARCHIVED || 0, lang),
      sub: t('construction.stats.completedProjectsSub'),
      icon: ClipboardList,
      accent: 'secondary',
    },
    {
      label: t('construction.stats.pendingQuoteRequests'),
      value: formatNumber(construction.quoteRequests?.NEW || 0, lang),
      sub: t('construction.stats.pendingQuoteRequestsSub'),
      icon: FileText,
      accent: 'neutral',
    },
  ]

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>{t('construction.title')}</h1>
          <p>{t('construction.subtitle')}</p>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} sub={stat.sub} icon={stat.icon} accent={stat.accent} />
        ))}
      </div>

      <div className="panel-grid two-column">
        <section className="dashboard-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <Building2 size={18} className="panel-icon" aria-hidden="true" />
              <h2>{t('construction.projects.title')}</h2>
            </div>
          </div>
          <StatusList values={construction.projects} t={t} />
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <FileText size={18} className="panel-icon" aria-hidden="true" />
              <h2>{t('construction.quoteRequests.title')}</h2>
            </div>
          </div>
          <StatusList values={construction.quoteRequests} t={t} />
        </section>
      </div>

      <div className="panel-grid two-column">
        <section className="dashboard-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <Activity size={18} className="panel-icon" aria-hidden="true" />
              <h2>{t('dashboard.recentActivity')}</h2>
            </div>
          </div>
          <ActivityList items={recentActivity} t={t} />
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <Users size={18} className="panel-icon" aria-hidden="true" />
              <h2>{t('construction.quickAccess.title')}</h2>
            </div>
          </div>
          <div className="quick-links-grid">
            <div className="quick-link-box">
              <ImageIcon size={18} />
              <span>{t('construction.quickAccess.gallery')}</span>
            </div>
            <div className="quick-link-box">
              <ClipboardList size={18} />
              <span>{t('construction.quickAccess.requests')}</span>
            </div>
            <div className="quick-link-box">
              <FileText size={18} />
              <span>{t('construction.quickAccess.quotes')}</span>
            </div>
            <div className="quick-link-box">
              <Users size={18} />
              <span>{t('construction.quickAccess.team')}</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
